'use client'

import {
  Box,
  CheckCircle2,
  CircleDot,
  Layers,
  MousePointer2,
  Move,
  Plus,
  RotateCcw,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { PointerEvent, WheelEvent } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface CanvasItem {
  id: string
  title: string
  kind: 'agent' | 'tool' | 'artifact' | 'note'
  x: number
  y: number
  width: number
  height: number
}

type DragState =
  | {
      type: 'pan'
      pointerId: number
      startX: number
      startY: number
      originX: number
      originY: number
    }
  | {
      type: 'node'
      pointerId: number
      nodeId: string
      startX: number
      startY: number
      originX: number
      originY: number
    }
  | null

const initialItems: CanvasItem[] = [
  { id: 'item-agent', title: 'Agent 员工节点', kind: 'agent', x: 120, y: 100, width: 190, height: 96 },
  { id: 'item-tool', title: '工具能力节点', kind: 'tool', x: 430, y: 180, width: 190, height: 96 },
  { id: 'item-artifact', title: '交付物节点', kind: 'artifact', x: 780, y: 120, width: 190, height: 96 },
  { id: 'item-note', title: '画布便签', kind: 'note', x: 340, y: 380, width: 220, height: 110 },
]

const kindLabel: Record<CanvasItem['kind'], string> = {
  agent: '智能体',
  tool: '工具',
  artifact: '交付物',
  note: '便签',
}

const kindColor: Record<CanvasItem['kind'], string> = {
  agent: 'border-blue-500/70 bg-blue-500/10',
  tool: 'border-orange-500/70 bg-orange-500/10',
  artifact: 'border-emerald-500/70 bg-emerald-500/10',
  note: 'border-violet-500/70 bg-violet-500/10',
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function InfiniteCanvasModule() {
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState>(null)
  const [items, setItems] = useState<CanvasItem[]>(initialItems)
  const [selectedId, setSelectedId] = useState(initialItems[0].id)
  const [view, setView] = useState({ x: 80, y: 90, scale: 1 })

  const selectedItem = items.find((item) => item.id === selectedId) ?? items[0]

  const miniMapItems = useMemo(() => {
    if (items.length === 0) return []
    const minX = Math.min(...items.map((item) => item.x))
    const minY = Math.min(...items.map((item) => item.y))
    const maxX = Math.max(...items.map((item) => item.x + item.width))
    const maxY = Math.max(...items.map((item) => item.y + item.height))
    const width = Math.max(maxX - minX, 1)
    const height = Math.max(maxY - minY, 1)

    return items.map((item) => ({
      id: item.id,
      x: ((item.x - minX) / width) * 150,
      y: ((item.y - minY) / height) * 90,
      width: (item.width / width) * 150,
      height: (item.height / height) * 90,
    }))
  }, [items])

  const addItem = () => {
    const rect = canvasRef.current?.getBoundingClientRect()
    const centerX = rect ? (rect.width / 2 - view.x) / view.scale : 200
    const centerY = rect ? (rect.height / 2 - view.y) / view.scale : 200
    const id = `item-${Date.now().toString(36)}`
    const item: CanvasItem = {
      id,
      title: `画布节点 ${items.length + 1}`,
      kind: 'agent',
      x: Math.round(centerX - 95),
      y: Math.round(centerY - 48),
      width: 190,
      height: 96,
    }
    setItems((current) => [...current, item])
    setSelectedId(id)
  }

  const deleteSelected = () => {
    if (!selectedItem) return
    setItems((current) => current.filter((item) => item.id !== selectedItem.id))
    setSelectedId(items.find((item) => item.id !== selectedItem.id)?.id ?? '')
  }

  const resetView = () => {
    setView({ x: 80, y: 90, scale: 1 })
  }

  const zoomBy = (delta: number) => {
    setView((current) => ({ ...current, scale: clamp(current.scale + delta, 0.25, 2.5) }))
  }

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const nextScale = clamp(view.scale * (event.deltaY > 0 ? 0.9 : 1.1), 0.25, 2.5)
    const localX = event.clientX - rect.left
    const localY = event.clientY - rect.top
    const worldX = (localX - view.x) / view.scale
    const worldY = (localY - view.y) / view.scale

    setView({
      scale: nextScale,
      x: localX - worldX * nextScale,
      y: localY - worldY * nextScale,
    })
  }

  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      type: 'pan',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: view.x,
      originY: view.y,
    }
  }

  const startNodeDrag = (event: PointerEvent<HTMLButtonElement>, item: CanvasItem) => {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      type: 'node',
      pointerId: event.pointerId,
      nodeId: item.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: item.x,
      originY: item.y,
    }
    setSelectedId(item.id)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    if (drag.type === 'pan') {
      setView((current) => ({
        ...current,
        x: drag.originX + event.clientX - drag.startX,
        y: drag.originY + event.clientY - drag.startY,
      }))
      return
    }

    const dx = (event.clientX - drag.startX) / view.scale
    const dy = (event.clientY - drag.startY) / view.scale
    setItems((current) =>
      current.map((item) =>
        item.id === drag.nodeId ? { ...item, x: Math.round(drag.originX + dx), y: Math.round(drag.originY + dy) } : item,
      ),
    )
  }

  const endPointerAction = () => {
    dragRef.current = null
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">无限画布模块</h2>
            <Badge variant="outline">Leafer UI 风格</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            用独立模块承载拖拽、缩放、视口、图层和节点编辑能力，后续可以把编排画布迁移到这个底座。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => zoomBy(-0.1)}>
            <ZoomOut className="size-4" />
            缩小
          </Button>
          <Button variant="outline" onClick={() => zoomBy(0.1)}>
            <ZoomIn className="size-4" />
            放大
          </Button>
          <Button variant="outline" onClick={resetView}>
            <RotateCcw className="size-4" />
            复位
          </Button>
          <Button onClick={addItem}>
            <Plus className="size-4" />
            新节点
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_20rem] overflow-hidden">
        <div
          ref={canvasRef}
          className="relative min-h-0 cursor-grab overflow-hidden bg-background active:cursor-grabbing"
          style={{
            backgroundImage:
              'linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)',
            backgroundSize: `${32 * view.scale}px ${32 * view.scale}px`,
            backgroundPosition: `${view.x}px ${view.y}px`,
          }}
          onPointerDown={startPan}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointerAction}
          onPointerCancel={endPointerAction}
          onWheel={handleWheel}
        >
          <div
            className="absolute left-0 top-0"
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
              transformOrigin: '0 0',
            }}
          >
            <svg className="pointer-events-none absolute left-0 top-0 h-[1200px] w-[1400px]">
              <path
                d="M310 148 C 360 148, 380 226, 430 226 M620 226 C 680 226, 720 168, 780 168"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeDasharray="7 7"
                strokeWidth="2"
              />
            </svg>
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  'absolute select-none rounded-lg border bg-card p-3 text-left shadow-sm transition hover:border-primary',
                  kindColor[item.kind],
                  selectedId === item.id && 'ring-2 ring-primary',
                )}
                style={{ left: item.x, top: item.y, width: item.width, height: item.height }}
                onPointerDown={(event) => startNodeDrag(event, item)}
                onClick={() => setSelectedId(item.id)}
              >
                <div className="flex items-center gap-2">
                  <Box className="size-4 text-primary" />
                  <span className="truncate font-medium">{item.title}</span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <CircleDot className="size-3" />
                  {kindLabel[item.kind]}
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-muted">
                  <div className="h-full w-2/3 rounded-full bg-primary" />
                </div>
              </button>
            ))}
          </div>

          <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-lg border bg-card/90 px-3 py-2 text-sm shadow-sm backdrop-blur">
            <Move className="size-4 text-primary" />
            拖动画布移动，滚轮缩放，拖动节点调整位置
          </div>

          <div className="absolute bottom-4 right-4 rounded-lg border bg-card/90 p-3 shadow-sm backdrop-blur">
            <div className="mb-2 flex items-center justify-between gap-6 text-xs text-muted-foreground">
              <span>缩略图</span>
              <span>{Math.round(view.scale * 100)}%</span>
            </div>
            <svg className="h-[90px] w-[150px] rounded-md bg-muted/40">
              {miniMapItems.map((item) => (
                <rect
                  key={item.id}
                  x={item.x}
                  y={item.y}
                  width={Math.max(item.width, 6)}
                  height={Math.max(item.height, 6)}
                  rx="3"
                  className={cn(item.id === selectedId ? 'fill-primary' : 'fill-muted-foreground/50')}
                />
              ))}
            </svg>
          </div>
        </div>

        <aside className="min-h-0 border-l bg-card/40 p-4">
          <div className="space-y-4">
            <Card size="sm">
              <CardHeader>
                <CardTitle>画布能力</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                {['无限平移', '鼠标滚轮缩放', '节点拖拽', '节点选择与删除', '缩略图视口'].map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card size="sm">
              <CardHeader>
                <CardTitle>当前节点</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedItem ? (
                  <>
                    <div className="rounded-lg border p-3">
                      <div className="font-medium">{selectedItem.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {kindLabel[selectedItem.kind]} · x {selectedItem.x} · y {selectedItem.y}
                      </div>
                    </div>
                    <Button variant="destructive" className="w-full" onClick={deleteSelected}>
                      <Trash2 className="size-4" />
                      删除节点
                    </Button>
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">暂无选中节点</div>
                )}
              </CardContent>
            </Card>

            <Card size="sm">
              <CardHeader>
                <CardTitle>接入说明</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex gap-2">
                  <MousePointer2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>这个模块先提供画布交互底座，后面 Agent 编排、工作流、交付物关系图都可以迁到同一套能力上。</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>
    </section>
  )
}
