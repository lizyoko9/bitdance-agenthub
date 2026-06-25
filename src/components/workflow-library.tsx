'use client'

import {
  CheckCircle2,
  Clock3,
  GitBranch,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Workflow,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { WorkflowRow, WorkflowRunRow } from '@/db/schema'
import { fetchWorkflowRuns, fetchWorkflows } from '@/lib/api'
import { cn } from '@/lib/utils'

interface WorkflowLibraryProps {
  onOpenWorkflow: (workflowId: string) => void
  onCreateWorkflow: () => void
}

export function WorkflowLibrary({ onOpenWorkflow, onCreateWorkflow }: WorkflowLibraryProps) {
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([])
  const [runs, setRuns] = useState<WorkflowRunRow[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextWorkflows, nextRuns] = await Promise.all([fetchWorkflows(), fetchWorkflowRuns()])
      setWorkflows(nextWorkflows)
      setRuns(nextRuns)
    } catch (err) {
      setError(formatError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const latestRunByWorkflowId = useMemo(() => {
    const map = new Map<string, WorkflowRunRow>()
    for (const run of runs) {
      const current = map.get(run.workflowId)
      if (!current || run.startedAt > current.startedAt) map.set(run.workflowId, run)
    }
    return map
  }, [runs])

  const filteredWorkflows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return workflows
    return workflows.filter((workflow) => {
      return (
        workflow.name.toLowerCase().includes(q) ||
        workflow.description.toLowerCase().includes(q) ||
        workflow.status.toLowerCase().includes(q)
      )
    })
  }, [query, workflows])

  const completedCount = useMemo(() => {
    return workflows.filter((workflow) => latestRunByWorkflowId.get(workflow.id)?.status === 'complete').length
  }, [latestRunByWorkflowId, workflows])

  const runningCount = useMemo(() => {
    return runs.filter((run) => run.status === 'running' || run.status === 'queued').length
  }, [runs])

  return (
    <div data-testid="workflow-library" className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <header className="shrink-0 border-b px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-base font-semibold">
              <Workflow className="size-4 text-primary" />
              <span>工作流</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              这里集中展示编排画布里保存和跑过的流程，点开即可回到画布继续编辑或运行。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => void reload()} disabled={loading}>
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              刷新
            </Button>
            <Button size="sm" className="h-8 gap-1" onClick={onCreateWorkflow}>
              <GitBranch className="size-3.5" />
              去画布新建
            </Button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
          <WorkflowMetric label="工作流" value={workflows.length} />
          <WorkflowMetric label="已完成" value={completedCount} />
          <WorkflowMetric label="运行中" value={runningCount} />
          <WorkflowMetric label="运行记录" value={runs.length} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
        <div className="mb-3 flex items-center gap-2">
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索工作流名称、描述或状态"
              className="pl-9"
            />
          </div>
        </div>

        {error ? (
          <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <ScrollArea className="min-h-0 flex-1">
          {loading ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              正在加载工作流
            </div>
          ) : filteredWorkflows.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-md border border-dashed text-center">
              <Workflow className="size-8 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">还没有工作流</div>
                <div className="mt-1 text-xs text-muted-foreground">去编排画布保存一个流程后，它会出现在这里。</div>
              </div>
              <Button size="sm" className="gap-1" onClick={onCreateWorkflow}>
                <GitBranch className="size-3.5" />
                去画布新建
              </Button>
            </div>
          ) : (
            <div data-testid="workflow-library-list" className="grid gap-2">
              {filteredWorkflows.map((workflow) => (
                <WorkflowListItem
                  key={workflow.id}
                  workflow={workflow}
                  latestRun={latestRunByWorkflowId.get(workflow.id) ?? null}
                  runCount={runs.filter((run) => run.workflowId === workflow.id).length}
                  onOpen={() => onOpenWorkflow(workflow.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}

function WorkflowMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  )
}

function WorkflowListItem({
  workflow,
  latestRun,
  runCount,
  onOpen,
}: {
  workflow: WorkflowRow
  latestRun: WorkflowRunRow | null
  runCount: number
  onOpen: () => void
}) {
  return (
    <article data-testid="workflow-library-card" className="rounded-md border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <WorkflowStatusIcon run={latestRun} />
            <h3 className="truncate text-sm font-semibold">{workflow.name}</h3>
            <WorkflowStatusBadge workflow={workflow} run={latestRun} />
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {workflow.description || '这个工作流还没有描述。'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
            <Badge variant="outline">版本 {workflow.version}</Badge>
            <Badge variant="outline">{runCount} 次运行</Badge>
            <Badge variant="outline">更新于 {formatTime(workflow.updatedAt)}</Badge>
            {latestRun ? <Badge variant="outline">最近运行 {formatTime(latestRun.startedAt)}</Badge> : null}
          </div>
        </div>
        <Button size="sm" className="h-8 gap-1" onClick={onOpen}>
          <GitBranch className="size-3.5" />
          打开画布
        </Button>
      </div>
    </article>
  )
}

function WorkflowStatusIcon({ run }: { run: WorkflowRunRow | null }) {
  if (run?.status === 'complete') return <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
  if (run?.status === 'running' || run?.status === 'queued') {
    return <Play className="size-4 shrink-0 text-primary" />
  }
  return <Clock3 className="size-4 shrink-0 text-muted-foreground" />
}

function WorkflowStatusBadge({ workflow, run }: { workflow: WorkflowRow; run: WorkflowRunRow | null }) {
  const label = run ? runStatusLabel(run.status) : workflowStatusLabel(workflow.status)
  return (
    <Badge
      variant="outline"
      className={cn(
        'shrink-0',
        run?.status === 'complete' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        (run?.status === 'running' || run?.status === 'queued') && 'border-primary/30 bg-primary/10 text-primary',
      )}
    >
      {label}
    </Badge>
  )
}

function workflowStatusLabel(status: WorkflowRow['status']): string {
  if (status === 'active') return '已启用'
  if (status === 'archived') return '已归档'
  return '草稿'
}

function runStatusLabel(status: WorkflowRunRow['status']): string {
  if (status === 'complete') return '已完成'
  if (status === 'running') return '运行中'
  if (status === 'queued') return '排队中'
  if (status === 'failed') return '失败'
  if (status === 'paused') return '已暂停'
  if (status === 'aborted') return '已取消'
  return status
}

function formatTime(value: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}
