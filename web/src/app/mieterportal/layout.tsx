import type { Metadata, Viewport } from 'next'
import { Source_Sans_3 } from 'next/font/google'

const sourceSans = Source_Sans_3({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'Mieterportal – Bauverein der Mionauten',
  description: 'Digitale Nachweise direkt in die d-you Wallet',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
}

export default function MieterportalLayout({ children }: { children: React.ReactNode }) {
  return <div className={sourceSans.className}>{children}</div>
}
