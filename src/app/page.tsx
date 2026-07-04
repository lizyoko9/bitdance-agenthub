import { AppShell } from '@/components/app-shell'
import { ArtifactPreviewPanel } from '@/components/artifact-preview-panel'
import { ChineseUiTranslator } from '@/components/chinese-ui-translator'
import { FileExplorerPanel } from '@/components/file-explorer-panel'
import { MessageHighlightLayer } from '@/components/message-highlight-layer'
import { SelectionPopover } from '@/components/selection-popover'

export default function Home() {
  return (
    <div id="agenthub-app-root" className="flex h-screen overflow-hidden bg-background">
      <AppShell />
      <FileExplorerPanel />
      <ArtifactPreviewPanel />
      <SelectionPopover />
      <MessageHighlightLayer />
      <ChineseUiTranslator />
    </div>
  )
}
