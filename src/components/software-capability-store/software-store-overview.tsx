'use client'

import { Boxes, Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import type { SoftwareStoreOverviewProps } from './types'

export function SoftwareStoreOverview({
  cards,
  categories,
  search,
  category,
  selectedCard,
  onSearchChange,
  onCategoryChange,
  onSelectCard,
}: SoftwareStoreOverviewProps) {
  return (
    <section className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold">
              <Boxes className="size-4 text-primary" />
              软件能力商店
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              先选软件，再进入详情页配置 CLI、MCP、命令、检测和分配智能体。
            </p>
          </div>
          <Badge variant="outline">全部免费</Badge>
        </div>
        <div className="mt-4 flex flex-col gap-2 lg:flex-row">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="搜索软件、CLI、MCP"
              className="pl-9"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant={category === '全部' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onCategoryChange('全部')}
          >
            全部
          </Button>
          {categories.map((item) => (
            <Button
              key={item}
              type="button"
              variant={category === item ? 'default' : 'outline'}
              size="sm"
              onClick={() => onCategoryChange(item)}
            >
              {item}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            data-testid="software-store-card"
            onClick={() => onSelectCard(card)}
            className={cn(
              'rounded-lg border bg-card p-4 text-left transition hover:border-primary hover:bg-primary/5',
              selectedCard?.key === card.key && 'border-primary bg-primary/10',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{card.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{card.category}</div>
              </div>
              <Badge variant={card.connectionStatus === '已接入' ? 'default' : 'outline'}>
                {card.connectionStatus}
              </Badge>
            </div>
            <p className="mt-3 min-h-10 text-sm text-muted-foreground">{card.description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">{card.defaultMode}</Badge>
              <Badge variant="outline">{card.modes.length} 种模式</Badge>
              <Badge variant="outline">{card.commandCount} 个命令</Badge>
              <Badge variant="outline">{card.assignedAgentCount} 个智能体</Badge>
            </div>
            <div className="mt-3 text-xs font-medium text-primary">打开设置</div>
          </button>
        ))}
      </div>
    </section>
  )
}
