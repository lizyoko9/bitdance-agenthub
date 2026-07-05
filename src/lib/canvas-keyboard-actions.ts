export type CanvasKeyboardAction =
  | 'cancel-connection'
  | 'delete-selected-node'
  | 'duplicate-selected-node'
  | 'redo-canvas'
  | 'save-workflow'
  | 'undo-canvas'

type KeyboardShortcutEvent = {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  target?: EventTarget | null
}

export function resolveCanvasKeyboardAction(event: KeyboardShortcutEvent): CanvasKeyboardAction | null {
  if (isEditableShortcutTarget(event.target ?? null)) return null

  const key = event.key.toLowerCase()
  const hasCommandModifier = Boolean(event.ctrlKey || event.metaKey)
  if (event.altKey) return null
  if (hasCommandModifier) {
    if (key === 'z') return event.shiftKey ? 'redo-canvas' : 'undo-canvas'
    if (event.shiftKey) return null
    if (key === 'y') return 'redo-canvas'
    if (key === 's') return 'save-workflow'
    if (key === 'd') return 'duplicate-selected-node'
    return null
  }

  if (event.shiftKey) return null
  if (key === 'escape') return 'cancel-connection'
  if (event.key !== 'Delete' && event.key !== 'Backspace') return null
  return 'delete-selected-node'
}

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!hasClosest(target)) return false
  return Boolean(target.closest('input,textarea,select,[contenteditable="true"],[data-canvas-editor-input="true"]'))
}

function hasClosest(target: EventTarget | null): target is EventTarget & {
  closest: (selector: string) => unknown
} {
  return typeof target === 'object' && target !== null && 'closest' in target && typeof target.closest === 'function'
}
