'use client'

import { useState } from 'react'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import Dashboard from '@/components/dashboard/Dashboard'
import NFSeManager from '@/components/nfse/NFSeManager'
import DownloadManager from '@/components/download/DownloadManager'
import ReportsPage from '@/components/reports/ReportsPage'

type ActiveSection = 'dashboard' | 'nfse' | 'downloads' | 'reports'

export default function Home() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard')

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <Dashboard />
      case 'nfse':
        return <NFSeManager />
      case 'downloads':
        return <DownloadManager />
      case 'reports':
        return <ReportsPage />
      default:
        return <Dashboard />
    }
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar
          activeSection={activeSection}
          setActiveSection={setActiveSection}
        />
        <main className="flex-1 flex flex-col">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="flex-1">
              <h1 className="text-lg font-semibold">
                {activeSection === 'dashboard' && 'Dashboard'}
                {activeSection === 'nfse' && 'Gestão de NFSe'}
                {activeSection === 'downloads' && 'Downloads de XML'}
                {activeSection === 'reports' && 'Relatórios Detalhados'}
              </h1>
            </div>
            <ThemeToggle />
          </header>
          <div className="flex-1 p-6">
            {renderActiveSection()}
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}
