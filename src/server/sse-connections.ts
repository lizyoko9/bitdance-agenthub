/**
 * 打开中的 SSE 流登记表。
 *
 * Next 生产模式收到 SIGTERM/SIGINT 时先 `server.close()` 等所有进行中的请求结束再退出，
 * 而 SSE 请求永远不会自己结束 → 进程挂死。这里在信号到达时主动关闭所有 SSE 流，
 * 让 Next 的优雅退出能走完。见 specs/02「SSE 编码」。
 */

type CloseStream = () => void

const SIGNAL_EXIT_CODES = { SIGINT: 130, SIGTERM: 143 } as const

const globalForSse = globalThis as unknown as {
  __agenthubSseStreams?: Set<CloseStream>
  __agenthubSseSignalsInstalled?: boolean
}
const openStreams = (globalForSse.__agenthubSseStreams ??= new Set())

export function registerSseStream(close: CloseStream): () => void {
  installSignalHandlers()
  openStreams.add(close)
  return () => {
    openStreams.delete(close)
  }
}

export function closeAllSseStreams(): void {
  for (const close of [...openStreams]) close()
  openStreams.clear()
}

export function openSseStreamCount(): number {
  return openStreams.size
}

function installSignalHandlers(): void {
  if (globalForSse.__agenthubSseSignalsInstalled) return
  globalForSse.__agenthubSseSignalsInstalled = true
  for (const signal of Object.keys(SIGNAL_EXIT_CODES) as Array<keyof typeof SIGNAL_EXIT_CODES>) {
    process.on(signal, () => {
      closeAllSseStreams()
      // 挂了监听器就不再走 Node 默认的「收到信号即退出」；没有别人（Next）接管时自己退出
      if (process.listenerCount(signal) === 1) process.exit(SIGNAL_EXIT_CODES[signal])
    })
  }
}
