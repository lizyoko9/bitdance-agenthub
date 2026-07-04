import { app, BrowserWindow, session, shell } from 'electron'

import { setupDataDir } from './paths'
import { startEmbeddedServer } from './server-bootstrap'

const isDev = process.env.AGENTHUB_DEV === '1'
const DEV_URL = process.env.AGENTHUB_DEV_URL ??
  `http://localhost:${process.env.PORT || '3000'}`

// Electron 默认用 package.json 的 `name` 字段（'bytedance-agenthub'）作为 app 名，
// 用户数据会落在 ~/Library/Application Support/bytedance-agenthub/。覆盖成 productName 'AgentHub'，
// 让 userData 路径更友好；必须在任何 app.getPath('userData') 调用之前完成。
app.setName('AgentHub')

// Single-instance lock：第二次启动 focus 已开的窗口，不开新进程
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const wins = BrowserWindow.getAllWindows()
    if (wins.length > 0) {
      const w = wins[0]
      if (w.isMinimized()) w.restore()
      w.focus()
    }
  })

  // 关键时序：DATA_DIR 必须在 server require 业务代码之前注入
  setupDataDir()

  app.whenReady().then(async () => {
    // 用户 shell 里若设了 http_proxy / HTTPS_PROXY，Chromium 会继承它去代理 localhost 请求，
    // 导致 BrowserWindow 加载 dev URL 时被代理拦截。强制 direct（proxyRules 空）并显式 bypass 本地。
    await session.defaultSession
      .setProxy({ proxyRules: 'direct://', proxyBypassRules: '<local>' })
      .catch((err) => console.error('[AgentHub] setProxy failed', err))

    let url: string
    try {
      url = isDev ? DEV_URL : `http://127.0.0.1:${await startEmbeddedServer()}`
    } catch (err) {
      console.error('[AgentHub] failed to start server', err)
      app.quit()
      return
    }

    const win = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 980,
      minHeight: 600,
      title: 'AgentHub',
      backgroundColor: '#0a0a0a',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        devTools: !app.isPackaged,
      },
    })

    // a) 外链交给 OS 默认浏览器，不在窗口里新开
    win.webContents.setWindowOpenHandler(({ url: target }) => {
      shell.openExternal(target).catch(() => {})
      return { action: 'deny' }
    })

    // b) 拦截站外导航；本地 server origin 通过
    win.webContents.on('will-navigate', (event, target) => {
      const origin = new URL(target).origin
      if (origin !== new URL(url).origin) {
        event.preventDefault()
        shell.openExternal(target).catch(() => {})
      }
    })

    await win.loadURL(url)
    await installRuntimeTextLeakGuard(win)
  })

  app.on('window-all-closed', () => {
    app.quit()
  })
}

async function installRuntimeTextLeakGuard(win: BrowserWindow) {
  const script = String.raw`
    (() => {
      if (window.__agenthubRuntimeTextLeakGuardInstalled) return
      window.__agenthubRuntimeTextLeakGuardInstalled = true

      function looksLikeRuntimeLeak(value) {
        if (!value || value.length < 80) return false
        return (
          value.includes('@font-face') ||
          value.includes('__nextjs') ||
          value.includes('__NEXT_DATA__') ||
          value.includes('_next/static') ||
          value.includes('data-next-') ||
          value.includes('function(') ||
          value.includes('=>{')
        )
      }

      function scrubRuntimeTextLeaks() {
        for (const element of document.querySelectorAll('body script, body style, body template, body noscript')) {
          if (looksLikeRuntimeLeak(element.textContent || '')) {
            element.setAttribute('data-agenthub-hidden-runtime-leak', 'true')
            element.style.setProperty('display', 'none', 'important')
            element.style.setProperty('visibility', 'hidden', 'important')
            element.style.setProperty('width', '0', 'important')
            element.style.setProperty('height', '0', 'important')
            element.style.setProperty('overflow', 'hidden', 'important')
          }
        }

        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        const leaked = []
        while (walker.nextNode()) {
          const node = walker.currentNode
          const parent = node.parentElement
          if (!parent) continue
          if (['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE'].includes(parent.tagName)) {
            if (looksLikeRuntimeLeak(node.textContent || '')) {
              parent.setAttribute('data-agenthub-hidden-runtime-leak', 'true')
              ;(parent instanceof HTMLElement ? parent : null)?.style.setProperty('display', 'none', 'important')
            }
            continue
          }
          if (looksLikeRuntimeLeak(node.textContent || '')) leaked.push(node)
        }
        for (const node of leaked) node.parentNode?.removeChild(node)
      }

      scrubRuntimeTextLeaks()
      new MutationObserver(() => requestAnimationFrame(scrubRuntimeTextLeaks)).observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      })
    })()
  `

  try {
    await win.webContents.executeJavaScript(script)
  } catch (err) {
    console.error('[AgentHub] runtime text leak guard failed', err)
  }
}
