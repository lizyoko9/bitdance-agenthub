'use client'

import { useEffect } from 'react'

const textMap: Record<string, string> = {
  Agents: '智能体',
  Factory: '工厂',
  Canvas: '画布',
  Skills: '技能',
  Scheduler: '调度',
  Memory: '记忆',
  Context: '上下文',
  Models: '模型',
  Tools: '工具',
  Caps: '能力',
  Collab: '协作',
  Govern: '治理',
  Monitor: '监控',
  Config: '配置',
  Prod: '生产',
  Analytics: '分析',
  Refresh: '刷新',
  Create: '创建',
  Install: '安装',
  Publish: '发布',
  Test: '测试',
  Preview: '预览',
  Search: '搜索',
  Save: '保存',
  Cancel: '取消',
  Delete: '删除',
  Enable: '启用',
  Disable: '禁用',
  Dry: '预演',
  'Dry-run': '预演',
  'Dry Run': '预演',
  Live: '实时',
  Invoke: '推理',
  Observe: '观察',
  Input: '输入',
  Output: '输出',
  ready: '就绪',
  available: '可用',
  missing: '缺失',
  blocked: '已拦截',
  unknown: '未知',
  failed: '失败',
  ok: '正常',
  selected: '已选择',
  enabled: '已启用',
  disabled: '已禁用',
  pending: '等待中',
  valid: '有效',
  invalid: '无效',
  published: '已发布',
  draft: '草稿',
  models: '模型',
  outlets: '出口',
  tests: '测试',
  routes: '路由',
  invokes: '推理探测',
  workstations: '工作站',
  secrets: '密钥',

  'Model Control': '模型管理',
  'Network Outlet': '网络出口',
  'Network Outlets': '网络出口',
  'Model Profile': '模型配置',
  'Model Profiles': '模型配置',
  'Route Preview': '路由预览',
  'Route Decisions': '路由决策',
  'Connection Tests': '连接与推理测试',
  'Selected Model': '当前模型',
  'Selected Outlet': '当前出口',
  'Skills Center': '技能中心',
  'Skills marketplace': '技能市场',
  'Developer SDK': '开发者 SDK',
  'Production Integrations': '生产集成',
  Readiness: '就绪度',
  'Production gates': '生产门禁',
  'Desktop runtime': '桌面运行时',
  'Phone runtime': '手机运行时',
  'VM/RDP providers': 'VM/RDP 提供方',
  'Hardening report': '硬化报告',
  Recommendations: '建议',
  'Runtime control': '运行时控制',
  Devices: '设备',
  'Reserve workstation': '预留工作站',
  'Agent Canvas': '智能体画布',
  'Node Tools': '节点工具',
  'Employee Factory': '智能体工厂',
  'Saved Agents': '已保存智能体',
  'Software Profile': '软件配置',
  'Software Profiles': '软件配置',
  'Software Command': '软件命令',
  'Software Commands': '软件命令',
  'Software runs': '软件运行记录',
  'Tool Connections': '工具连接',
  'MCP Tools': 'MCP 工具',
  'Tool Control': '工具连接中心',
  TOOLS: '工具',
  SOFTWARE: '软件',
  COMMANDS: '命令',
  MACROS: '宏',
  KEYS: '密钥',
  TASKS: '任务',
  HOOKS: '回调',
  EVENTS: '事件',
  'RUN CONTEXT': '运行上下文',
  'No Agent selected': '未选择智能体',
  'Dry-run calls can be created without binding an Agent.': '可以先创建预演调用，不必绑定智能体。',
  'TOOL PROTOCOL': '工具协议',
  'Seed Manifests': '生成示例清单',
  'Sample Call': '示例调用',
  'SDK ACCESS': 'SDK 接入',
  'Create SDK Key': '创建 SDK 密钥',
  'Create SDK Task': '创建 SDK 任务',
  WEBHOOK: '回调地址',
  'Create Webhook': '创建回调',
  'CLI PROFILE': 'CLI 配置',
  'Create CLI': '创建 CLI',
  'MCP SERVER': 'MCP 服务',
  'Register MCP': '注册 MCP',
  'TOOL CONNECTION': '工具连接',
  'Create Tool': '创建工具',
  'Create Software': '创建软件',
  'Create Command': '创建命令',
  'RECORDED MACRO': '录制宏',
  'Select software': '选择软件',
  Approve: '需要审批',
  'Save Macro': '保存宏',
  'SDK API KEYS': 'SDK 密钥',
  'No SDK API keys': '暂无 SDK 密钥',
  'SDK TASKS': 'SDK 任务',
  'No SDK tasks': '暂无 SDK 任务',
  WEBHOOKS: '回调列表',
  'No webhooks': '暂无回调',
  'Requires approval': '需要审批',
  Enabled: '已启用',
  On: '开启',
  workspace: '当前工作区',
  agent_workspace: '智能体工作区',
  custom: '自定义',
  stdin: '标准输入',
  args: '命令参数',
  file: '文件',
  stdout: '标准输出',
  json: 'JSON',
  stdio: '标准输入输出',
  sse: 'SSE',
  http: 'HTTP',
  mcp: 'MCP',
  cli: 'CLI',
  software: '软件',
  api: 'API',
  native_app: '本地软件',
  browser_app: '浏览器软件',
  cli_app: 'CLI 软件',
  mobile_app: '手机软件',
  api_service: 'API 服务',
  script: '脚本',
  browser_automation: '浏览器自动化',
  desktop_automation: '桌面自动化',
  recorded_macro: '录制宏',
  hybrid: '混合方式',
  browser_context: '独立浏览器',
  physical_desktop: '真实桌面',
  virtual_desktop: '虚拟桌面',
  vm: '虚拟机',
  remote_session: '远程会话',
  low: '低风险',
  medium: '中风险',
  high: '高风险',
  active: '启用中',
  archived: '已归档',
  'Task Scheduler': '任务调度',
  'Memory Center': '记忆中心',
  'Memory Items': '记忆条目',
  'New Memory': '新记忆',
  'Context Preview': '上下文预览',
  'Memory Limit': '记忆上限',
  'ConfigOps Center': '配置中心',
  Versions: '版本',
  Entity: '实体',
  Entities: '实体',
  Exports: '导出',
  Impacts: '影响',
  Latest: '最新',
  Locks: '锁',
  Conflicts: '冲突',
  Packages: '包',
  Checks: '检查',
}

const placeholderMap: Record<string, string> = {
  'Outlet name': '出口名称',
  'Proxy URL': '代理地址',
  'Profile name': '配置名称',
  'Base URL': '基础地址',
  'API key ref': '密钥引用',
  'Bind interface': '绑定网卡',
  Region: '地区',
  Model: '模型名称',
  Context: '上下文',
  'Skill name': '技能名称',
  'Software command input JSON': '软件命令输入 JSON',
  'Node name': '节点名称',
}

const mojibakeExactMap: Record<string, string> = {
  '澶氭櫤鑳戒綋鍗忎綔骞冲彴': '多智能体协作平台',
  '瀵硅瘽': '对话',
  '浜х墿搴?': '产物库',
  '鏅鸿兘浣?': '智能体',
  '宸ュ巶': '工厂',
  '鐢诲竷': '画布',
  '鎶€鑳?': '技能',
  '璋冨害': '调度',
  '璁板繂': '记忆',
  '涓婁笅鏂?': '上下文',
  '妯″瀷': '模型',
  '宸ュ叿': '工具',
  '鑳藉姏': '能力',
  '鍗忎綔': '协作',
  '娌荤悊': '治理',
  '鐩戞帶': '监控',
  '閰嶇疆': '配置',
  '鐢熶骇': '生产',
  '鍒嗘瀽': '分析',
  '鏇村鍔熻兘': '更多功能',
  '鏀惰捣楂樼骇鍔熻兘': '收起高级功能',
  '鏂板缓瀵硅瘽': '新建对话',
  '娌℃湁浼氳瘽': '没有会话',
  '鍒锋柊': '刷新',
  '鍙栨秷': '取消',
  '鍒犻櫎': '删除',
  '鍒犻櫎浼氳瘽': '删除会话',
  '鍒犻櫎涓?..': '删除中...',
  '鍗曡亰': '单聊',
  '缇よ亰': '群聊',
  '浣嶆櫤鑳戒綋': '位智能体',
  '宸插綊妗?': '已归档',
  '鍙栨秷缃《': '取消置顶',
  '缃《': '置顶',
  '褰掓。': '归档',
  '鍙栨秷褰掓。': '取消归档',
  '閲嶅懡鍚?': '重命名',

  '鐢熶骇闆嗘垚': '生产集成',
  '灏辩华搴?': '就绪度',
  '鐢熶骇闂ㄦ帶': '生产门禁',
  '妗岄潰杩愯鏃?': '桌面运行时',
  '鎵嬫満杩愯鏃?': '手机运行时',
  'VM/RDP 鎻愪緵鏂?': 'VM/RDP 提供方',
  '纭寲鎶ュ憡': '硬化报告',
  '寤鸿': '建议',
  '杩愯鏃舵帶鍒?': '运行时控制',
  '棰勭暀宸ヤ綔绔?': '预留工作站',
  '宸ヤ綔绔?': '工作站',
  '瀵嗛挜寮曠敤': '密钥引用',
  '杩炴帴娴嬭瘯': '连接测试',
  '鎺ㄧ悊鎺㈡祴': '推理探测',
  '鎺㈡祴绐楀彛': '探测窗口',
  '鍙戠幇璁惧': '发现设备',
  '鍙戠幇鎻愪緵鏂?': '发现提供方',
  '鍙敤': '可用',
  '缂哄け': '缺失',
  '瑙傚療': '观察',
  '璁惧': '设备',
  '鏆傛棤鐢佃剳浼氳瘽': '暂无电脑会话',
  '鏆傛棤 Android 璁惧': '暂无 Android 设备',
  '鏆傛湭鎹曡幏绐楀彛鍒楄〃': '暂未捕获窗口列表',
  '鏆傛湭鍙戠幇 Android 璁惧': '暂未发现 Android 设备',

  '鏅鸿兘浣撹妭鐐?': '智能体节点',
  '杞欢鍛戒护': '软件命令',
  '浜哄伐瀹℃壒': '人工审批',
  '浜х墿澶勭悊': '产物处理',
  '瑙﹀彂鍣?': '触发器',
  '鏉′欢鍒ゆ柇': '条件判断',
  '鎶ュ憡': '报告',
  '缁撴瀯鍖栨暟鎹?': '结构化数据',
  '鏂囨。': '文档',
  '浠ｇ爜': '代码',
  '琛ㄦ牸': '表格',
  '鍥剧墖': '图片',
  '娴忚鍣ㄧ姸鎬?': '浏览器状态',
  '鐢佃剳鎿嶄綔缁撴灉': '电脑操作结果',
  '鏂囦欢鍖?': '文件包',
  '瀹℃壒缁撴灉': '审批结果',
  '杞欢鎵ц缁撴灉': '软件执行结果',
  '淇濆瓨': '保存',
  '杩愯': '运行',
}

const mojibakeReplacements: Array<[string, string]> = [
  ['鏅鸿兘浣撹妭鐐?', '智能体节点'],
  ['鏅鸿兘浣?', '智能体'],
  ['澶氭櫤鑳戒綋鍗忎綔骞冲彴', '多智能体协作平台'],
  ['浜х墿搴?', '产物库'],
  ['涓婁笅鏂?', '上下文'],
  ['鎶€鑳?', '技能'],
  ['鐢诲竷', '画布'],
  ['瀵硅瘽', '对话'],
  ['妯″瀷', '模型'],
  ['宸ュ叿', '工具'],
  ['鑳藉姏', '能力'],
  ['鍗忎綔', '协作'],
  ['娌荤悊', '治理'],
  ['鐩戞帶', '监控'],
  ['閰嶇疆', '配置'],
  ['鐢熶骇', '生产'],
  ['鍒嗘瀽', '分析'],
  ['鍒锋柊', '刷新'],
  ['鏂板缓', '新建'],
  ['鍒犻櫎', '删除'],
  ['鍙栨秷', '取消'],
  ['鎼滅储', '搜索'],
  ['淇濆瓨', '保存'],
  ['杩愯', '运行'],
  ['瑙傚療', '观察'],
  ['璁惧', '设备'],
  ['宸ヤ綔绔?', '工作站'],
  ['妗岄潰', '桌面'],
  ['鎵嬫満', '手机'],
  ['杞欢鍛戒护', '软件命令'],
  ['浜哄伐瀹℃壒', '人工审批'],
  ['纭寲鎶ュ憡', '硬化报告'],
  ['鐢熶骇闆嗘垚', '生产集成'],
  ['灏辩华', '就绪'],
  ['鍙敤', '可用'],
  ['缂哄け', '缺失'],
  ['宸查樆姝?', '已拦截'],
  ['澶辫触', '失败'],
  ['鎴愬姛', '成功'],
  ['寤鸿', '建议'],
  ['瀵嗛挜', '密钥'],
  ['鍑哄彛', '出口'],
  ['璺敱', '路由'],
  ['鐗堟湰', '版本'],
  ['瀵煎嚭', '导出'],
  ['鍖?', '包'],
  ['妫€鏌?', '检查'],
  ['閿?', '锁'],
  ['鍐茬獊', '冲突'],
]

const sentencePatterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  [/^No (.+) yet\.$/, (match) => `暂无${translateNoun(match[1])}。`],
  [/^No (.+) yet$/, (match) => `暂无${translateNoun(match[1])}`],
  [/^No (.+) profiles\.$/, (match) => `暂无${translateNoun(match[1])}配置。`],
  [/^No (.+) profiles$/, (match) => `暂无${translateNoun(match[1])}配置`],
  [/^(\d+) skills \/ (\d+) models \/ (\d+) software$/, (match) => `${match[1]} 个技能 / ${match[2]} 个模型 / ${match[3]} 个软件`],
  [/^Create or select an Agent before (.+)\.$/, (match) => `请先创建或选择一个智能体，再${translateVerb(match[1])}。`],
  [/^Create or select an Agent profile first\.$/, () => '请先创建或选择一个智能体配置。'],
  [/^Create or select a Software Command first\.$/, () => '请先创建或选择一个软件命令。'],
  [/^Create a (.+) first\.$/, (match) => `请先创建${translateNoun(match[1])}。`],
  [/^Select source and target Agents$/, () => '请选择源智能体和目标智能体'],
  [/^(\d+) files$/, (match) => `${match[1]} 个文件`],
]

export function ChineseUiTranslator() {
  useEffect(() => {
    const translateRoot = () => {
      const root = document.getElementById('agenthub-app-root')
      if (!root) return
      translateTextNodes(root)
      translateElementAttributes(root)
    }

    translateRoot()
    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(translateRoot)
    })
    const root = document.getElementById('agenthub-app-root')
    if (!root) return () => observer.disconnect()
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label'],
    })
    return () => observer.disconnect()
  }, [])

  return null
}

function translateTextNodes(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT
      if (looksLikeRuntimeSource(node.textContent)) return NodeFilter.FILTER_REJECT
      const parent = node.parentElement
      if (!parent || shouldSkip(parent)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  for (const node of nodes) {
    const next = translatePreservingWhitespace(node.textContent ?? '')
    if (next !== node.textContent) node.textContent = next
  }
}

function translateElementAttributes(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('[placeholder], [title], [aria-label]').forEach((element) => {
    if (shouldSkipAttributes(element)) return
    for (const attr of ['placeholder', 'title', 'aria-label']) {
      const value = element.getAttribute(attr)
      if (!value) continue
      const translated = translate(value, attr === 'placeholder')
      if (translated !== value) element.setAttribute(attr, translated)
    }
  })
}

function shouldSkip(element: Element): boolean {
  const tagName = element.tagName
  if (['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE', 'TEXTAREA', 'CODE', 'PRE'].includes(tagName)) return true
  return Boolean(
    element.closest(
      'head, script, style, link, meta, noscript, template, [data-nextjs-toast], [data-nextjs-dialog], [data-no-auto-zh], [contenteditable="true"], [id^="message-"], [data-selection-target="message"]',
    ),
  )
}

function shouldSkipAttributes(element: Element): boolean {
  const tagName = element.tagName
  if (['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE', 'CODE', 'PRE'].includes(tagName)) return true
  return Boolean(
    element.closest(
      'head, script, style, link, meta, noscript, template, [data-nextjs-toast], [data-nextjs-dialog], [data-no-auto-zh], [contenteditable="true"], [id^="message-"], [data-selection-target="message"]',
    ),
  )
}

function looksLikeRuntimeSource(value: string): boolean {
  if (value.length > 500) return true
  return (
    value.includes('@font-face') ||
    value.includes('__nextjs') ||
    value.includes('_next/static') ||
    value.includes('__NEXT_DATA__') ||
    value.includes('function(') ||
    value.includes('=>{') ||
    value.includes('data-next-')
  )
}

function translatePreservingWhitespace(value: string): string {
  const prefix = value.match(/^\s*/)?.[0] ?? ''
  const suffix = value.match(/\s*$/)?.[0] ?? ''
  const trimmed = value.trim()
  const translated = translate(trimmed, false)
  return translated === trimmed ? value : `${prefix}${translated}${suffix}`
}

function translate(value: string, placeholder: boolean): string {
  const direct = placeholder ? placeholderMap[value] ?? textMap[value] : textMap[value]
  if (direct) return direct
  const mojibakeExact = mojibakeExactMap[value]
  if (mojibakeExact) return mojibakeExact
  for (const [pattern, replacer] of sentencePatterns) {
    const match = value.match(pattern)
    if (match) return replacer(match)
  }
  return repairMojibake(value)
}

function repairMojibake(value: string): string {
  let next = value
  for (const [bad, good] of mojibakeReplacements) {
    next = next.split(bad).join(good)
  }
  return next
}

function translateNoun(value: string): string {
  const map: Record<string, string> = {
    Agent: '智能体',
    Agents: '智能体',
    'Agent profile': '智能体配置',
    'Agent profiles': '智能体配置',
    Software: '软件',
    'Software command': '软件命令',
    'Software commands': '软件命令',
    CLI: 'CLI',
    'CLI profiles': 'CLI 配置',
    tool: '工具',
    tools: '工具',
    capability: '能力',
    capabilities: '能力',
    memory: '记忆',
    messages: '消息',
    conflicts: '冲突',
    'export bundle': '导出包',
    'share package': '共享包',
    RFC: 'RFC',
  }
  return map[value] ?? value
}

function translateVerb(value: string): string {
  const map: Record<string, string> = {
    running: '运行',
    saving: '保存',
    testing: '测试',
    installing: '安装',
    publishing: '发布',
  }
  return map[value] ?? value
}
