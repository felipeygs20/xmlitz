'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchStats, fetchRecentActivity, fetchStatsByCompetencia, fetchStatsByCNPJ, fetchDownloadStats } from '@/lib/api'
import { formatCurrency, formatNumber, formatDate, maskCNPJ } from '@/lib/utils'
import { BarChart, LineChart, PieChart, AreaChart } from '@/components/charts'
import {
  FileText,
  Package,
  Building,
  DollarSign,
  TrendingUp,
  Activity,
  Download,
  Search,
  BarChart3
} from 'lucide-react'

interface CompetenciaStats {
  competencia: string
  ano: string
  mes: string
  total_nfse: number
  total_valor_liquido: number
  valor_medio: number
  total_prestadores: number
  total_tomadores: number
  menor_valor: number
  maior_valor: number
}

interface CNPJStats {
  prestador_cnpj: string
  prestador_razao_social: string
  total_nfse: number
  total_valor_liquido: number
  valor_medio: number
  primeira_emissao: string
  ultima_emissao: string
  dias_com_emissao: number
  total_tomadores: number
}

interface DownloadStats {
  cnpj_from_filename: string
  total_downloads: number
  total_xmls_baixados: number
  downloads_com_erro: number
  ultima_consulta: string
  total_size_bytes: number
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const { data: recentActivity, isLoading: activityLoading } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: () => fetchRecentActivity(10),
    refetchInterval: 60000, // Refresh every minute
  })

  const { data: competenciaStats, isLoading: competenciaLoading } = useQuery<CompetenciaStats[]>({
    queryKey: ['stats-competencia'],
    queryFn: () => fetchStatsByCompetencia(12),
    refetchInterval: 300000, // Refresh every 5 minutes
  })

  const { data: cnpjStats, isLoading: cnpjLoading } = useQuery<CNPJStats[]>({
    queryKey: ['stats-cnpj'],
    queryFn: () => fetchStatsByCNPJ(10),
    refetchInterval: 300000, // Refresh every 5 minutes
  })

  const { data: downloadStats, isLoading: downloadLoading } = useQuery<DownloadStats[]>({
    queryKey: ['download-stats'],
    queryFn: fetchDownloadStats,
    refetchInterval: 300000, // Refresh every 5 minutes
  })

  const statsCards = [
    {
      title: 'Total NFSe',
      value: stats?.total_nfse_docs || 0,
      icon: FileText,
      description: 'Documentos processados',
      format: 'number',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Lotes Processados',
      value: stats?.total_batches || 0,
      icon: Package,
      description: 'Arquivos XML processados',
      format: 'number',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Prestadores',
      value: stats?.unique_prestadores || 0,
      icon: Building,
      description: 'Empresas únicas',
      format: 'number',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Valor Total',
      value: stats?.total_valor_liquido || 0,
      icon: DollarSign,
      description: 'Valor líquido acumulado',
      format: 'currency',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral do sistema de gestão de NFSe
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-md ${card.bgColor}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  card.format === 'currency'
                    ? formatCurrency(card.value)
                    : formatNumber(card.value)
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Atividade Recente
            </CardTitle>
            <CardDescription>
              Últimas NFSe processadas no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-4 w-[160px]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentActivity && recentActivity.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.slice(0, 5).map((nfse) => (
                  <div key={nfse.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-blue-50 rounded-full">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">NFSe {nfse.numero}</p>
                        <p className="text-xs text-muted-foreground">
                          CNPJ: {maskCNPJ(nfse.prestador_cnpj)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {formatCurrency(nfse.valor_liquido)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(nfse.data_emissao)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhuma atividade recente</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
            <CardDescription>
              Acesso rápido às principais funcionalidades
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <button className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors">
              <div className="p-2 bg-blue-50 rounded-md">
                <Download className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-sm">Baixar XMLs</p>
                <p className="text-xs text-muted-foreground">Iniciar download automático</p>
              </div>
            </button>

            <button className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors">
              <div className="p-2 bg-green-50 rounded-md">
                <Search className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-sm">Buscar NFSe</p>
                <p className="text-xs text-muted-foreground">Consultar notas fiscais</p>
              </div>
            </button>

            <button className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors">
              <div className="p-2 bg-purple-50 rounded-md">
                <BarChart3 className="h-4 w-4 text-purple-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-sm">Relatórios</p>
                <p className="text-xs text-muted-foreground">Gerar relatórios</p>
              </div>
            </button>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Status do Sistema
          </CardTitle>
          <CardDescription>
            Monitoramento dos serviços principais
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center space-y-2">
              <div className="w-3 h-3 bg-green-500 rounded-full mx-auto animate-pulse"></div>
              <p className="text-sm font-medium">API</p>
              <Badge variant="secondary" className="text-xs">Online</Badge>
            </div>
            <div className="text-center space-y-2">
              <div className="w-3 h-3 bg-green-500 rounded-full mx-auto animate-pulse"></div>
              <p className="text-sm font-medium">Banco de Dados</p>
              <Badge variant="secondary" className="text-xs">Conectado</Badge>
            </div>
            <div className="text-center space-y-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full mx-auto animate-pulse"></div>
              <p className="text-sm font-medium">Downloads</p>
              <Badge variant="outline" className="text-xs">Processando</Badge>
            </div>
            <div className="text-center space-y-2">
              <div className="w-3 h-3 bg-green-500 rounded-full mx-auto animate-pulse"></div>
              <p className="text-sm font-medium">Armazenamento</p>
              <Badge variant="secondary" className="text-xs">85% Livre</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos de Análise */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Gráfico de Competência */}
        {competenciaLoading ? (
          <Card>
            <CardHeader>
              <CardTitle>Evolução por Competência</CardTitle>
              <CardDescription>Últimos 12 meses</CardDescription>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        ) : competenciaStats && competenciaStats.length > 0 ? (
          <AreaChart
            data={competenciaStats.reverse()}
            title="Evolução por Competência"
            description="Valor total de NFSe por mês"
            xAxisKey="competencia"
            yAxisKey="total_valor_liquido"
            yAxisLabel="Valor Total"
            formatValue={(value) => formatCurrency(value)}
            color="#10b981"
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Evolução por Competência</CardTitle>
              <CardDescription>Últimos 12 meses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6">
                <p className="text-muted-foreground">Nenhum dado disponível</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Gráfico de Top CNPJs */}
        {cnpjLoading ? (
          <Card>
            <CardHeader>
              <CardTitle>Top Prestadores</CardTitle>
              <CardDescription>Por valor total</CardDescription>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        ) : cnpjStats && cnpjStats.length > 0 ? (
          <BarChart
            data={cnpjStats.slice(0, 8).map(item => ({
              ...item,
              prestador_nome: item.prestador_razao_social?.substring(0, 20) + '...' || maskCNPJ(item.prestador_cnpj)
            }))}
            title="Top Prestadores"
            description="Por valor total de NFSe"
            xAxisKey="prestador_nome"
            yAxisKey="total_valor_liquido"
            yAxisLabel="Valor Total"
            formatValue={(value) => formatCurrency(value)}
            color="#3b82f6"
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Top Prestadores</CardTitle>
              <CardDescription>Por valor total</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6">
                <p className="text-muted-foreground">Nenhum dado disponível</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Estatísticas de Downloads */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Resumo de Downloads */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Estatísticas de Downloads
            </CardTitle>
            <CardDescription>
              Informações quantitativas por CNPJ
            </CardDescription>
          </CardHeader>
          <CardContent>
            {downloadLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-4 w-[100px]" />
                  </div>
                ))}
              </div>
            ) : downloadStats && downloadStats.length > 0 ? (
              <div className="space-y-4">
                {downloadStats.slice(0, 5).map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-blue-50 rounded-full">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          CNPJ: {maskCNPJ(item.cnpj_from_filename)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.total_downloads} downloads • {item.downloads_com_erro} erros
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {formatNumber(item.total_xmls_baixados)} XMLs
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(item.ultima_consulta)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Download className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum download realizado</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distribuição de Erros */}
        <Card>
          <CardHeader>
            <CardTitle>Taxa de Sucesso</CardTitle>
            <CardDescription>
              Downloads vs Erros
            </CardDescription>
          </CardHeader>
          <CardContent>
            {downloadLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : downloadStats && downloadStats.length > 0 ? (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {(() => {
                      const totalDownloads = downloadStats.reduce((sum, item) => sum + item.total_downloads, 0)
                      const totalErrors = downloadStats.reduce((sum, item) => sum + item.downloads_com_erro, 0)
                      const successRate = totalDownloads > 0 ? ((totalDownloads - totalErrors) / totalDownloads * 100) : 0
                      return `${successRate.toFixed(1)}%`
                    })()}
                  </div>
                  <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Total Downloads</span>
                    <span className="font-medium">
                      {formatNumber(downloadStats.reduce((sum, item) => sum + item.total_downloads, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Com Erro</span>
                    <span className="font-medium text-red-600">
                      {formatNumber(downloadStats.reduce((sum, item) => sum + item.downloads_com_erro, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>XMLs Baixados</span>
                    <span className="font-medium text-green-600">
                      {formatNumber(downloadStats.reduce((sum, item) => sum + item.total_xmls_baixados, 0))}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Sem dados de erro</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
