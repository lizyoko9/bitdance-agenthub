export function createEmitter() {
  const listeners = new Map()

  function off(event, fn) {
    const list = listeners.get(event)
    if (!list) return
    const i = list.indexOf(fn)
    if (i !== -1) list.splice(i, 1)
  }

  function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, [])
    listeners.get(event).push(fn)
    return () => off(event, fn)
  }

  function once(event, fn) {
    const wrapper = (...args) => {
      off(event, wrapper)
      fn(...args)
    }
    return on(event, wrapper)
  }

  function emit(event, ...args) {
    const list = [...(listeners.get(event) ?? [])]
    const errors = []
    for (const fn of list) {
      try {
        fn(...args)
      } catch (err) {
        errors.push(err)
      }
    }
    if (event !== 'error') for (const err of errors) emit('error', err, event)
    return list.length
  }

  return { on, off, once, emit }
}
