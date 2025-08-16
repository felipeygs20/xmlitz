# 🚀 XMLITZ NFSe Frontend

Sistema moderno de gestão de NFSe construído com **Next.js 14** e **shadcn/ui**.

## ✨ Características

### 🎨 Design System
- **shadcn/ui** - Componentes modernos e acessíveis
- **Tailwind CSS** - Estilização utilitária
- **Lucide React** - Ícones consistentes
- **Design responsivo** - Funciona em todos os dispositivos

### 🏗️ Arquitetura
- **Next.js 14** - Framework React moderno
- **TypeScript** - Tipagem estática
- **React Query** - Gerenciamento de estado servidor
- **Axios** - Cliente HTTP
- **Sonner** - Notificações elegantes

### 📱 Funcionalidades

#### 🏠 Dashboard
- **Estatísticas em tempo real** do sistema
- **Cards informativos** com métricas importantes
- **Atividade recente** das NFSe processadas
- **Status do sistema** em tempo real
- **Ações rápidas** para funcionalidades principais

#### 📊 Gestão de NFSe
- **Busca avançada** por:
  - Número da NFSe
  - CNPJ do prestador
  - Período de emissão
- **Tabela responsiva** com dados das NFSe
- **Filtros dinâmicos** com tabs
- **Ações por registro** (visualizar, baixar)

#### 📥 Downloads
- **Interface intuitiva** para configurar downloads
- **Presets predefinidos** para facilitar o uso
- **Configuração personalizada** de CNPJs e períodos
- **Monitoramento em tempo real** do progresso
- **Progress bars** animadas
- **Status detalhado** de cada download

## 🛠️ Tecnologias

### Core
- **Next.js 14** - Framework React
- **React 18** - Biblioteca de UI
- **TypeScript** - Linguagem tipada
- **Tailwind CSS** - Framework CSS

### UI Components
- **shadcn/ui** - Sistema de componentes
- **Radix UI** - Primitivos acessíveis
- **Lucide React** - Ícones
- **Sonner** - Toasts/Notificações

### Estado e Dados
- **TanStack Query** - Gerenciamento de estado servidor
- **Axios** - Cliente HTTP
- **React Hook Form** - Formulários
- **Zod** - Validação de schemas

## 🚀 Como Executar

### Pré-requisitos
- Node.js 18+
- npm ou yarn

### Instalação
```bash
cd frontend
npm install
```

### Desenvolvimento
```bash
npm run dev
```

O frontend estará disponível em: http://localhost:3001

### Build para Produção
```bash
npm run build
npm start
```

## 📁 Estrutura do Projeto

```
frontend/
├── src/
│   ├── app/                 # App Router (Next.js 14)
│   │   ├── layout.tsx       # Layout principal
│   │   ├── page.tsx         # Página inicial
│   │   ├── providers.tsx    # Providers (React Query)
│   │   └── globals.css      # Estilos globais
│   ├── components/          # Componentes React
│   │   ├── ui/              # Componentes shadcn/ui
│   │   ├── layout/          # Componentes de layout
│   │   ├── dashboard/       # Componentes do dashboard
│   │   ├── nfse/           # Componentes de NFSe
│   │   └── download/        # Componentes de download
│   └── lib/                 # Utilitários e configurações
│       ├── api.ts           # Cliente API
│       └── utils.ts         # Funções utilitárias
├── components.json          # Configuração shadcn/ui
├── tailwind.config.js       # Configuração Tailwind
├── tsconfig.json           # Configuração TypeScript
└── next.config.js          # Configuração Next.js
```

## 🎯 Componentes Principais

### Layout
- **AppSidebar** - Navegação lateral com menu
- **Header** - Cabeçalho com breadcrumbs

### Dashboard
- **StatsCards** - Cards de estatísticas
- **RecentActivity** - Lista de atividade recente
- **QuickActions** - Botões de ação rápida
- **SystemStatus** - Status dos serviços

### NFSe
- **SearchFilters** - Filtros de busca com tabs
- **ResultsTable** - Tabela de resultados
- **ActionButtons** - Ações por registro

### Downloads
- **PresetCards** - Cards de presets
- **ConfigForm** - Formulário de configuração
- **ProgressMonitor** - Monitor de progresso

## 🔧 Configuração

### Variáveis de Ambiente
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### API Integration
O frontend se conecta automaticamente com a API backend em `http://localhost:3000`.

### Customização
- **Cores**: Edite `tailwind.config.js`
- **Componentes**: Adicione novos em `src/components/ui/`
- **Temas**: Configure em `src/app/globals.css`

## 📊 Funcionalidades Implementadas

### ✅ Concluído
- [x] Dashboard com estatísticas
- [x] Busca de NFSe (número, prestador, período)
- [x] Interface de downloads
- [x] Navegação responsiva
- [x] Sistema de notificações
- [x] Monitoramento de progresso
- [x] Integração com API backend

### 🔄 Em Desenvolvimento
- [ ] Exportação para Excel/CSV
- [ ] Gráficos e relatórios
- [ ] Filtros salvos
- [ ] Modo escuro
- [ ] PWA (Progressive Web App)

## 🎨 Design System

### Cores
- **Primary**: Azul (#0ea5e9)
- **Secondary**: Roxo (#8b5cf6)
- **Success**: Verde (#22c55e)
- **Warning**: Amarelo (#f59e0b)
- **Danger**: Vermelho (#ef4444)

### Tipografia
- **Font**: Inter (Google Fonts)
- **Tamanhos**: text-sm, text-base, text-lg, text-xl, text-2xl, text-3xl

### Espaçamento
- **Gaps**: 2, 4, 6, 8 (0.5rem, 1rem, 1.5rem, 2rem)
- **Padding**: p-2, p-4, p-6, p-8
- **Margin**: m-2, m-4, m-6, m-8

## 🔍 Debugging

### Logs
- React Query Devtools (desenvolvimento)
- Console logs para debugging
- Network tab para requisições API

### Problemas Comuns
1. **API não conecta**: Verificar se backend está rodando na porta 3000
2. **Componentes não carregam**: Verificar imports do shadcn/ui
3. **Estilos não aplicam**: Verificar configuração do Tailwind

## 📱 Responsividade

### Breakpoints
- **sm**: 640px+
- **md**: 768px+
- **lg**: 1024px+
- **xl**: 1280px+

### Mobile First
- Design otimizado para mobile
- Sidebar colapsível
- Tabelas com scroll horizontal
- Cards empilhados em telas pequenas

## 🚀 Deploy

### Vercel (Recomendado)
```bash
npm run build
vercel --prod
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

---

**XMLITZ NFSe Frontend** - Interface moderna para gestão de NFSe 🎉
