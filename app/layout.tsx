import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Link Manager Bot Backend',
  description: 'Telegram bot bridge status page',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
