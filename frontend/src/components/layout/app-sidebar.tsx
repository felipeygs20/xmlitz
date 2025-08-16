'use client'

import {
  BarChart3,
  FileText,
  Download,
  Settings,
  HelpCircle,
  Home,
  TrendingUp,
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

interface AppSidebarProps {
  activeSection: string
  setActiveSection: (section: 'dashboard' | 'nfse' | 'downloads' | 'reports') => void
}

const menuItems = [
  {
    title: 'Dashboard',
    id: 'dashboard',
    icon: BarChart3,
    description: 'Visão geral do sistema'
  },
  {
    title: 'NFSe',
    id: 'nfse',
    icon: FileText,
    description: 'Gestão de notas fiscais'
  },
  {
    title: 'Downloads',
    id: 'downloads',
    icon: Download,
    description: 'Baixar XMLs'
  },
  {
    title: 'Relatórios',
    id: 'reports',
    icon: TrendingUp,
    description: 'Análises e relatórios detalhados'
  },
]

const secondaryItems = [
  {
    title: 'Configurações',
    id: 'settings',
    icon: Settings,
  },
  {
    title: 'Ajuda',
    id: 'help',
    icon: HelpCircle,
  },
]

export function AppSidebar({ activeSection, setActiveSection }: AppSidebarProps) {
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Home className="h-4 w-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">XMLITZ</span>
            <span className="truncate text-xs text-muted-foreground">NFSe Manager</span>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => setActiveSection(item.id as any)}
                    isActive={activeSection === item.id}
                    tooltip={item.description}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton>
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter>
        <div className="p-4 text-xs text-muted-foreground">
          <p>XMLITZ NFSe v1.0</p>
          <p>Sistema de Gestão</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
