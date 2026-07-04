export type CanvasKeyboardAction = 'delete-selected-node'

type KeyboardShortcutEvent = {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  target?: EventTarget | null
}

export function resolveCanvasKeyboardAction(event: KeyboardShortcutEvent): CanvasKeyboardAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return null
  if (event.key !== 'Delete' && event.key !== 'Backspace') return null
  if (isEditableShortcutTarget(event.target ?? null)) return null
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
