import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'XMLITZ NFSe - Sistema de Gestão',
  description: 'Sistema moderno de gestão de Notas Fiscais de Serviço Eletrônicas',
  keywords: ['NFSe', 'XML', 'Gestão', 'Notas Fiscais'],
  authors: [{ name: 'XMLITZ Team' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#09090b',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
