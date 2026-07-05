import { describe, expect, it } from 'vitest'

import { resolveCanvasKeyboardAction } from './canvas-keyboard-actions'

describe('resolveCanvasKeyboardAction', () => {
  it('deletes the selected canvas node with Delete or Backspace', () => {
    expect(resolveCanvasKeyboardAction({ key: 'Delete' })).toBe('delete-selected-node')
    expect(resolveCanvasKeyboardAction({ key: 'Backspace' })).toBe('delete-selected-node')
  })

  it('resolves desktop canvas shortcuts for save, duplicate, and cancel', () => {
    expect(resolveCanvasKeyboardAction({ key: 's', ctrlKey: true })).toBe('save-workflow')
    expect(resolveCanvasKeyboardAction({ key: 'S', metaKey: true })).toBe('save-workflow')
    expect(resolveCanvasKeyboardAction({ key: 'd', ctrlKey: true })).toBe('duplicate-selected-node')
    expect(resolveCanvasKeyboardAction({ key: 'D', metaKey: true })).toBe('duplicate-selected-node')
    expect(resolveCanvasKeyboardAction({ key: 'Escape' })).toBe('cancel-connection')
  })

  it('resolves undo and redo shortcuts like a desktop canvas editor', () => {
    expect(resolveCanvasKeyboardAction({ key: 'z', ctrlKey: true })).toBe('undo-canvas')
    expect(resolveCanvasKeyboardAction({ key: 'Z', metaKey: true })).toBe('undo-canvas')
    expect(resolveCanvasKeyboardAction({ key: 'y', ctrlKey: true })).toBe('redo-canvas')
    expect(resolveCanvasKeyboardAction({ key: 'Z', metaKey: true, shiftKey: true })).toBe('redo-canvas')
  })

  it('ignores delete shortcuts while the user is editing text', () => {
    const input = editableTarget('input')
    const textarea = editableTarget('textarea')
    const contentEditable = editableTarget('[contenteditable="true"]')

    expect(resolveCanvasKeyboardAction({ key: 'Delete', target: input })).toBeNull()
    expect(resolveCanvasKeyboardAction({ key: 'Backspace', target: textarea })).toBeNull()
    expect(resolveCanvasKeyboardAction({ key: 'Delete', target: contentEditable })).toBeNull()
    expect(resolveCanvasKeyboardAction({ key: 's', ctrlKey: true, target: input })).toBeNull()
    expect(resolveCanvasKeyboardAction({ key: 'Escape', target: textarea })).toBeNull()
  })

  it('ignores modified shortcuts and unrelated keys', () => {
    expect(resolveCanvasKeyboardAction({ key: 'Delete', ctrlKey: true })).toBeNull()
    expect(resolveCanvasKeyboardAction({ key: 'Backspace', metaKey: true })).toBeNull()
    expect(resolveCanvasKeyboardAction({ key: 's', ctrlKey: true, shiftKey: true })).toBeNull()
    expect(resolveCanvasKeyboardAction({ key: 'd', metaKey: true, altKey: true })).toBeNull()
    expect(resolveCanvasKeyboardAction({ key: 'z', ctrlKey: true, altKey: true })).toBeNull()
    expect(resolveCanvasKeyboardAction({ key: 'Enter' })).toBeNull()
  })
})

function editableTarget(match: string): EventTarget {
  return {
    closest: (selector: string) => (selector.includes(match) ? {} : null),
  } as unknown as EventTarget
}
