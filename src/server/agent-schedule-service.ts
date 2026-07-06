import { and, desc, eq } from 'drizzle-orm'

import { db, schema } from '@/db/client'
import type {
  AgentAvailabilityDecision,
  AgentWorkingDaySchedule,
  AgentMaintenanceWindow,
  AgentOvertimePolicy,
  AgentScheduleCurrentStatus,
  AgentScheduleRow,
  AgentScheduleStatus,
  AgentVacationMode,
  AgentWeeklySchedule,
  WeekdayName,
} from '@/db/schema'
import { newAgentScheduleId } from '@/server/ids'
import { recordAuditLog } from '@/server/security-service'

export interface CreateAgentScheduleArgs {
  agentProfileId: string
  timezone?: string
  weeklySchedule: Partial<Record<WeekdayName, AgentWorkingDaySchedule>>
  maintenanceWindows?: AgentMaintenanceWindow[]
  overtimePolicy?: AgentOvertimePolicy
  vacationMode?: AgentVacationMode
  status?: AgentScheduleStatus
}

export interface EvaluateAgentAvailabilityArgs {
  scheduleId: string
  at?: number
  urgent?: boolean
  estimatedDurationMinutes?: number
}

const DEFAULT_OVERTIME: AgentOvertimePolicy = {
  acceptTasksOutsideHours: false,
  maxOvertimePerDay: '0h',
  notifyOnOvertime: true,
  urgentTasksBypassRestriction: true,
}

const DEFAULT_VACATION: AgentVacationMode = {
  enabled: false,
  startDate: null,
  endDate: null,
  behavior: 'queue_tasks',
  backupAgentId: null,
}

export async function createAgentSchedule(args: CreateAgentScheduleArgs): Promise<AgentScheduleRow> {
  const agent = await db.query.agentProfiles.findFirst({ where: eq(schema.agentProfiles.id, args.agentProfileId) })
  if (!agent) throw new Error(`Agent profile not found: ${args.agentProfileId}`)
  if (args.vacationMode?.backupAgentId) {
    const backup = await db.query.agentProfiles.findFirst({
      where: eq(schema.agentProfiles.id, args.vacationMode.backupAgentId),
    })
    if (!backup) throw new Error(`Backup Agent profile not found: ${args.vacationMode.backupAgentId}`)
  }
  const now = Date.now()
  const row: AgentScheduleRow = {
    id: newAgentScheduleId(),
    agentProfileId: agent.id,
    timezone: args.timezone?.trim() || 'UTC',
    weeklySchedule: normalizeWeeklySchedule(args.weeklySchedule),
    maintenanceWindows: args.maintenanceWindows ?? [],
    overtimePolicy: { ...DEFAULT_OVERTIME, ...(args.overtimePolicy ?? {}) },
    vacationMode: { ...DEFAULT_VACATION, ...(args.vacationMode ?? {}) },
    currentStatus: 'off_duty',
    lastDecision: null,
    status: args.status ?? 'active',
    lastEvaluatedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(schema.agentSchedules).values(row)
  await recordAuditLog({
    actorType: 'system',
    action: 'agent_schedule.create',
    resourceType: 'agent_schedule',
    resourceId: row.id,
    status: 'allowed',
    riskLevel: 'low',
    message: `Agent schedule ${row.id} created for ${agent.name}.`,
    metadata: { agentProfileId: agent.id, timezone: row.timezone, status: row.status },
  })
  return row
}

const WEEKDAYS: WeekdayName[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

function normalizeWeeklySchedule(
  weeklySchedule: Partial<Record<WeekdayName, AgentWorkingDaySchedule>>,
): AgentWeeklySchedule {
  return Object.fromEntries(
    WEEKDAYS.map((day) => [day, weeklySchedule[day] ?? { active: false }]),
  ) as AgentWeeklySchedule
}

export async function listAgentSchedules(args: {
  agentProfileId?: string
  status?: AgentScheduleStatus
  limit?: number
} = {}): Promise<AgentScheduleRow[]> {
  const filters = [
    args.agentProfileId ? eq(schema.agentSchedules.agentProfileId, args.agentProfileId) : undefined,
    args.status ? eq(schema.agentSchedules.status, args.status) : undefined,
  ].filter(Boolean)
  return db.query.agentSchedules.findMany({
    where: filters.length > 0 ? and(...filters) : undefined,
    orderBy: [desc(schema.agentSchedules.updatedAt)],
    limit: Math.min(Math.max(args.limit ?? 100, 1), 300),
  })
}

export async function evaluateAgentAvailability(
  args: EvaluateAgentAvailabilityArgs,
): Promise<{ schedule: AgentScheduleRow; decision: AgentAvailabilityDecision }> {
  const schedule = await getRequiredAgentSchedule(args.scheduleId)
  const at = args.at ?? Date.now()
  const decision = decideAvailability(schedule, at, args.urgent ?? false)
  await db
    .update(schema.agentSchedules)
    .set({
      currentStatus: decision.currentStatus,
      lastDecision: decision,
      lastEvaluatedAt: at,
      updatedAt: Date.now(),
    })
    .where(eq(schema.agentSchedules.id, schedule.id))
  const updated = await getRequiredAgentSchedule(schedule.id)
  await recordAuditLog({
    actorType: 'system',
    action: 'agent_schedule.evaluate',
    resourceType: 'agent_schedule',
    resourceId: schedule.id,
    status: decision.allowed ? 'allowed' : 'blocked',
    riskLevel: decision.currentStatus === 'overtime' ? 'medium' : 'low',
    message: decision.reason,
    metadata: {
      at,
      urgent: args.urgent ?? false,
      currentStatus: decision.currentStatus,
      delegateToAgentId: decision.delegateToAgentId,
      queueTask: decision.queueTask,
    },
  })
  return { schedule: updated, decision }
}

async function getRequiredAgentSchedule(id: string): Promise<AgentScheduleRow> {
  const row = await db.query.agentSchedules.findFirst({ where: eq(schema.agentSchedules.id, id) })
  if (!row) throw new Error(`Agent schedule not found: ${id}`)
  return row
}

function decideAvailability(
  schedule: AgentScheduleRow,
  at: number,
  urgent: boolean,
): AgentAvailabilityDecision {
  if (schedule.status !== 'active') {
    return decision(false, 'off_duty', 'Schedule is disabled.', false, null, false)
  }
  if (isVacation(schedule.vacationMode, at)) {
    const mode = schedule.vacationMode
    if (mode.behavior === 'delegate_to_backup') {
      return decision(false, 'vacation', 'Agent is on vacation; delegate to backup Agent.', false, mode.backupAgentId ?? null, true)
    }
    if (mode.behavior === 'queue_tasks') {
      return decision(false, 'vacation', 'Agent is on vacation; queue task until vacation ends.', true, null, true)
    }
    return decision(false, 'vacation', 'Agent is on vacation and rejects all tasks.', false, null, true)
  }
  const local = getLocalTime(schedule.timezone, at)
  const maintenance = schedule.maintenanceWindows.find(
    (window) => window.day === local.day && timeInRange(local.minutes, window.start, window.end),
  )
  if (maintenance) {
    return decision(false, 'maintenance', `Maintenance window: ${maintenance.reason}`, true, null, true)
  }
  const daySchedule = schedule.weeklySchedule[local.day]
  if (daySchedule?.active) {
    if (daySchedule.allDay || timeInRange(local.minutes, daySchedule.start ?? '00:00', daySchedule.end ?? '23:59')) {
      return decision(true, 'on_duty', 'Agent is within scheduled working hours.', false, null, false)
    }
  }
  if (schedule.overtimePolicy.acceptTasksOutsideHours || (urgent && schedule.overtimePolicy.urgentTasksBypassRestriction)) {
    return decision(
      true,
      'overtime',
      urgent ? 'Urgent task bypasses off-duty restriction.' : 'Agent accepts overtime tasks outside working hours.',
      false,
      null,
      schedule.overtimePolicy.notifyOnOvertime,
    )
  }
  return decision(false, 'off_duty', 'Agent is outside working hours.', true, null, false)
}

function decision(
  allowed: boolean,
  currentStatus: AgentScheduleCurrentStatus,
  reason: string,
  queueTask: boolean,
  delegateToAgentId: string | null,
  notifyUser: boolean,
): AgentAvailabilityDecision {
  return { allowed, currentStatus, reason, queueTask, delegateToAgentId, notifyUser }
}

function isVacation(mode: AgentVacationMode, at: number): boolean {
  if (!mode.enabled) return false
  const start = mode.startDate ?? Number.NEGATIVE_INFINITY
  const end = mode.endDate ?? Number.POSITIVE_INFINITY
  return at >= start && at <= end
}

function getLocalTime(timezone: string, at: number): { day: WeekdayName; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(at))
  const weekday = parts.find((part) => part.type === 'weekday')?.value.toLowerCase() as WeekdayName | undefined
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0)
  return { day: weekday ?? 'monday', minutes: hour * 60 + minute }
}

function timeInRange(minutes: number, start: string, end: string): boolean {
  const startMinutes = parseClock(start)
  const endMinutes = parseClock(end)
  if (startMinutes <= endMinutes) return minutes >= startMinutes && minutes <= endMinutes
  return minutes >= startMinutes || minutes <= endMinutes
}

function parseClock(value: string): number {
  const [hour, minute] = value.split(':').map((part) => Number(part))
  return hour * 60 + minute
}
