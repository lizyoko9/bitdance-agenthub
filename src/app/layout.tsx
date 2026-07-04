import type { Metadata } from 'next'

import { GlobalSearch } from '@/components/global-search'
import { StreamProvider } from '@/components/stream-provider'
import { ThemeProvider } from '@/components/theme-provider'

import '@xyflow/react/dist/style.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'AgentHub',
  description: '多智能体员工工作台',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
      <body className="h-screen overflow-hidden">
        <ThemeProvider>
          <StreamProvider>{children}</StreamProvider>
        </ThemeProvider>
        <GlobalSearch />
      </body>
    </html>
  )
}
