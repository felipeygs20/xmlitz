'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  fetchStatsByCompetencia, 
  fetchStatsByCNPJ, 
  fetchDownloadStats,
  fetchDetailedStatsByCNPJ,
  fetchDetailedStatsByCompetencia
} from '@/lib/api'
import { formatCurrency, formatNumber, formatDate, maskCNPJ } from '@/lib/utils'
import { BarChart, LineChart, PieChart, AreaChart } from '@/components/charts'
import {
  Calendar,
  Building,
  FileText,
  Download,
  TrendingUp,
  Filter,
  Search,
  BarChart3
} from 'lucide-react'

interface ReportFilters {
  dateRange: 'last30' | 'last90' | 'last365' | 'custom'
  startDate?: string
  endDate?: string
  cnpj?: string
  competencia?: string
}

export default function ReportsPage() {
  const [filters, setFilters] = useState<ReportFilters>({
    dateRange: 'last30'
  })
  const [selectedCNPJ, setSelectedCNPJ] = useState<string>('')
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>('')

  // Queries principais
  const { data: competenciaStats, isLoading: competenciaLoading } = useQuery({
    queryKey: ['reports-competencia', filters],
    queryFn: () => fetchStatsByCompetencia(24),
    refetchInterval: 300000,
  })

  const { data: cnpjStats, isLoading: cnpjLoading } = useQuery({
    queryKey: ['reports-cnpj', filters],
    queryFn: () => fetchStatsByCNPJ(50),
    refetchInterval: 300000,
  })

  const { data: downloadStats, isLoading: downloadLoading } = useQuery({
    queryKey: ['reports-downloads', filters],
    queryFn: fetchDownloadStats,
    refetchInterval: 300000,
  })

  // Query para CNPJ específico
  const { data: cnpjDetails, isLoading: cnpjDetailsLoading } = useQuery({
    queryKey: ['cnpj-details', selectedCNPJ],
    queryFn: () => selectedCNPJ ? fetchDetailedStatsByCNPJ(selectedCNPJ) : null,
    enabled: !!selectedCNPJ,
  })

  // Query para competência específica
  const { data: competenciaDetails, isLoading: competenciaDetailsLoading } = useQuery({
    queryKey: ['competencia-details', selectedCompetencia],
    queryFn: () => {
      if (!selectedCompetencia) return null
      const [ano, mes] = selectedCompetencia.split('-')
      return fetchDetailedStatsByCompetencia(ano, mes)
    },
    enabled: !!selectedCompetencia,
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Relatórios Detalhados</h1>
        <p className="text-muted-foreground">
          Análises avançadas e visualizações interativas dos dados de NFSe
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros de Análise
          </CardTitle>
          <CardDescription>
            Configure os parâmetros para análise personalizada
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="dateRange">Período</Label>
              <Select
                value={filters.dateRange}
                onValueChange={(value: any) => setFilters({ ...filters, dateRange: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last30">Últimos 30 dias</SelectItem>
                  <SelectItem value="last90">Últimos 90 dias</SelectItem>
                  <SelectItem value="last365">Último ano</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filters.dateRange === 'custom' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="startDate">Data Inicial</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={filters.startDate || ''}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Data Final</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={filters.endDate || ''}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="cnpjFilter">CNPJ Específico</Label>
              <Input
                id="cnpjFilter"
                placeholder="Digite o CNPJ"
                value={filters.cnpj || ''}
                onChange={(e) => setFilters({ ...filters, cnpj: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs de Relatórios */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="competencia">Por Competência</TabsTrigger>
          <TabsTrigger value="cnpj">Por CNPJ</TabsTrigger>
          <TabsTrigger value="downloads">Downloads</TabsTrigger>
        </TabsList>

        {/* Visão Geral */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Evolução Temporal */}
            {competenciaLoading ? (
              <Card>
                <CardHeader>
                  <CardTitle>Evolução Temporal</CardTitle>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[400px] w-full" />
                </CardContent>
              </Card>
            ) : (
              <LineChart
                data={competenciaStats?.slice(0, 12).reverse() || []}
                title="Evolução Temporal"
                description="Últimos 12 meses"
                xAxisKey="competencia"
                lines={[
                  { key: 'total_valor_liquido', label: 'Valor Total', color: '#3b82f6' },
                  { key: 'total_nfse', label: 'Quantidade NFSe', color: '#10b981' }
                ]}
                formatValue={(value) => typeof value === 'number' && value > 1000 ? formatCurrency(value) : formatNumber(value)}
                height={400}
              />
            )}

            {/* Top Prestadores */}
            {cnpjLoading ? (
              <Card>
                <CardHeader>
                  <CardTitle>Top Prestadores</CardTitle>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[400px] w-full" />
                </CardContent>
              </Card>
            ) : (
              <PieChart
                data={cnpjStats?.slice(0, 8).map(item => ({
                  name: item.prestador_razao_social?.substring(0, 25) + '...' || maskCNPJ(item.prestador_cnpj),
                  value: item.total_valor_liquido,
                  cnpj: item.prestador_cnpj
                })) || []}
                title="Top Prestadores"
                description="Por valor total"
                dataKey="value"
                nameKey="name"
                formatValue={(value) => formatCurrency(value)}
                height={400}
              />
            )}
          </div>
        </TabsContent>

        {/* Por Competência */}
        <TabsContent value="competencia" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Análise por Competência</CardTitle>
                <CardDescription>
                  Clique em uma competência para ver detalhes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {competenciaLoading ? (
                  <Skeleton className="h-[400px] w-full" />
                ) : (
                  <AreaChart
                    data={competenciaStats?.reverse() || []}
                    title=""
                    xAxisKey="competencia"
                    yAxisKey="total_valor_liquido"
                    formatValue={(value) => formatCurrency(value)}
                    height={400}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Selecionar Competência</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedCompetencia} onValueChange={setSelectedCompetencia}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha uma competência" />
                  </SelectTrigger>
                  <SelectContent>
                    {competenciaStats?.map((item) => (
                      <SelectItem key={item.competencia} value={item.competencia}>
                        {item.competencia} - {formatCurrency(item.total_valor_liquido)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {competenciaDetailsLoading ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : competenciaDetails ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {formatNumber(competenciaDetails.total_nfse)}
                        </div>
                        <p className="text-xs text-muted-foreground">NFSe</p>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(competenciaDetails.total_valor_liquido)}
                        </div>
                        <p className="text-xs text-muted-foreground">Valor Total</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Prestadores</span>
                        <span className="font-medium">{competenciaDetails.total_prestadores}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Tomadores</span>
                        <span className="font-medium">{competenciaDetails.total_tomadores}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Valor Médio</span>
                        <span className="font-medium">{formatCurrency(competenciaDetails.valor_medio)}</span>
                      </div>
                    </div>
                  </div>
                ) : selectedCompetencia ? (
                  <p className="text-sm text-muted-foreground">Nenhum dado encontrado</p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Por CNPJ */}
        <TabsContent value="cnpj" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Ranking de Prestadores</CardTitle>
                <CardDescription>
                  Ordenado por valor total de NFSe
                </CardDescription>
              </CardHeader>
              <CardContent>
                {cnpjLoading ? (
                  <Skeleton className="h-[400px] w-full" />
                ) : (
                  <BarChart
                    data={cnpjStats?.slice(0, 15).map(item => ({
                      ...item,
                      nome_curto: item.prestador_razao_social?.substring(0, 20) + '...' || maskCNPJ(item.prestador_cnpj)
                    })) || []}
                    title=""
                    xAxisKey="nome_curto"
                    yAxisKey="total_valor_liquido"
                    formatValue={(value) => formatCurrency(value)}
                    height={400}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detalhes do CNPJ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedCNPJ} onValueChange={setSelectedCNPJ}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um CNPJ" />
                  </SelectTrigger>
                  <SelectContent>
                    {cnpjStats?.slice(0, 20).map((item) => (
                      <SelectItem key={item.prestador_cnpj} value={item.prestador_cnpj}>
                        {maskCNPJ(item.prestador_cnpj)} - {item.prestador_razao_social?.substring(0, 30)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {cnpjDetailsLoading ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : cnpjDetails ? (
                  <div className="space-y-4">
                    <div className="text-center">
                      <h3 className="font-medium text-sm">{cnpjDetails.prestador_razao_social}</h3>
                      <p className="text-xs text-muted-foreground">{maskCNPJ(cnpjDetails.prestador_cnpj)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-xl font-bold text-blue-600">
                          {formatNumber(cnpjDetails.total_nfse)}
                        </div>
                        <p className="text-xs text-muted-foreground">NFSe</p>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-green-600">
                          {formatCurrency(cnpjDetails.total_valor_liquido)}
                        </div>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Valor Médio</span>
                        <span className="font-medium">{formatCurrency(cnpjDetails.valor_medio)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Tomadores</span>
                        <span className="font-medium">{cnpjDetails.total_tomadores}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Primeira NFSe</span>
                        <span className="font-medium">{formatDate(cnpjDetails.primeira_emissao)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Última NFSe</span>
                        <span className="font-medium">{formatDate(cnpjDetails.ultima_emissao)}</span>
                      </div>
                    </div>
                  </div>
                ) : selectedCNPJ ? (
                  <p className="text-sm text-muted-foreground">Nenhum dado encontrado</p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Downloads */}
        <TabsContent value="downloads" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Estatísticas de Downloads */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Estatísticas de Downloads
                </CardTitle>
              </CardHeader>
              <CardContent>
                {downloadLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : downloadStats && downloadStats.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-blue-600">
                          {formatNumber(downloadStats.reduce((sum, item) => sum + item.total_downloads, 0))}
                        </div>
                        <p className="text-xs text-muted-foreground">Downloads</p>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">
                          {formatNumber(downloadStats.reduce((sum, item) => sum + item.total_xmls_baixados, 0))}
                        </div>
                        <p className="text-xs text-muted-foreground">XMLs</p>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-red-600">
                          {formatNumber(downloadStats.reduce((sum, item) => sum + item.downloads_com_erro, 0))}
                        </div>
                        <p className="text-xs text-muted-foreground">Erros</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-medium">Últimas Consultas</h4>
                      {downloadStats.slice(0, 5).map((item, index) => (
                        <div key={index} className="flex justify-between items-center p-2 rounded border">
                          <div>
                            <p className="text-sm font-medium">{maskCNPJ(item.cnpj_from_filename)}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.total_xmls_baixados} XMLs • {item.downloads_com_erro} erros
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">
                              {formatDate(item.ultima_consulta)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Download className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Nenhum download realizado</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Taxa de Sucesso */}
            <Card>
              <CardHeader>
                <CardTitle>Taxa de Sucesso</CardTitle>
                <CardDescription>
                  Análise de eficiência dos downloads
                </CardDescription>
              </CardHeader>
              <CardContent>
                {downloadLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : downloadStats && downloadStats.length > 0 ? (
                  <PieChart
                    data={[
                      {
                        name: 'Sucessos',
                        value: downloadStats.reduce((sum, item) => sum + (item.total_downloads - item.downloads_com_erro), 0)
                      },
                      {
                        name: 'Erros',
                        value: downloadStats.reduce((sum, item) => sum + item.downloads_com_erro, 0)
                      }
                    ]}
                    title=""
                    dataKey="value"
                    nameKey="name"
                    colors={['#10b981', '#ef4444']}
                    formatValue={(value) => formatNumber(value)}
                    height={300}
                  />
                ) : (
                  <div className="text-center py-6">
                    <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Sem dados de downloads</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
