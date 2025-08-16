'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import {
  searchNFSeByNumber,
  searchNFSeByPrestador,
  searchNFSeByPeriod,
  exportNFSeZip,
  downloadNFSeXML,
  NFSe
} from '@/lib/api'
import { formatCurrency, formatDate, maskCNPJ } from '@/lib/utils'
import { Search, Download, Eye, Filter, FileText, Archive, CheckSquare, Square } from 'lucide-react'
import { toast } from 'sonner'

export default function NFSeManager() {
  const [searchType, setSearchType] = useState<'all' | 'number' | 'prestador' | 'period'>('all')
  const [searchParams, setSearchParams] = useState({
    numero: '',
    cnpj: '',
    startDate: '',
    endDate: ''
  })
  const [isFiltered, setIsFiltered] = useState(false)
  const [selectedNFSe, setSelectedNFSe] = useState<Set<number>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  // Query para buscar todas as NFSe (padrão)
  const { data: allNFSe, isLoading: loadingAll } = useQuery({
    queryKey: ['nfse-all'],
    queryFn: () => searchNFSeByPeriod('2025-01-01', '2025-12-31', 100),
    enabled: !isFiltered
  })

  // Query para busca filtrada
  const { data: filteredResults, isLoading: loadingFiltered, error } = useQuery({
    queryKey: ['nfse-search', searchType, searchParams],
    queryFn: async () => {
      switch (searchType) {
        case 'number':
          if (!searchParams.numero) return null
          return await searchNFSeByNumber(searchParams.numero)
        case 'prestador':
          if (!searchParams.cnpj) return null
          return await searchNFSeByPrestador(searchParams.cnpj)
        case 'period':
          if (!searchParams.startDate || !searchParams.endDate) return null
          return await searchNFSeByPeriod(searchParams.startDate, searchParams.endDate)
        default:
          return null
      }
    },
    enabled: isFiltered && searchType !== 'all'
  })

  // Determinar quais dados mostrar
  const searchResults = isFiltered ? filteredResults : allNFSe
  const isLoading = isFiltered ? loadingFiltered : loadingAll

  // Mutação para download de ZIP
  const downloadZipMutation = useMutation({
    mutationFn: async (nfseList: NFSe[]) => {
      // Criar filtros baseados nas NFSe selecionadas
      const filters = {
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        nfseNumbers: nfseList.map(nfse => nfse.numero)
      }
      return await exportNFSeZip(filters)
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `nfse-export-${new Date().toISOString().split('T')[0]}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Download do ZIP iniciado!')
    },
    onError: (error: any) => {
      toast.error(`Erro ao baixar ZIP: ${error.message}`)
    }
  })

  // Mutação para download individual
  const downloadXMLMutation = useMutation({
    mutationFn: async (id: number) => {
      return await downloadNFSeXML(id)
    },
    onSuccess: (blob, id) => {
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `nfse-${id}.xml`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Download do XML iniciado!')
    },
    onError: (error: any) => {
      toast.error(`Erro ao baixar XML: ${error.message}`)
    }
  })

  const handleSearch = () => {
    // Verificar se há parâmetros de busca válidos
    const hasValidParams =
      (searchType === 'number' && searchParams.numero.trim()) ||
      (searchType === 'prestador' && searchParams.cnpj.trim()) ||
      (searchType === 'period' && searchParams.startDate && searchParams.endDate)

    if (hasValidParams) {
      setIsFiltered(true)
    }
  }

  const handleClear = () => {
    setSearchParams({
      numero: '',
      cnpj: '',
      startDate: '',
      endDate: ''
    })
    setSearchType('all')
    setIsFiltered(false)
  }

  const handleShowAll = () => {
    setSearchType('all')
    setIsFiltered(false)
  }

  // Funções de seleção
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked)
    if (checked && searchResults) {
      const results = Array.isArray(searchResults) ? searchResults : [searchResults]
      const allIds = new Set(results.map(nfse => nfse.id))
      setSelectedNFSe(allIds)
    } else {
      setSelectedNFSe(new Set())
    }
  }

  const handleSelectNFSe = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedNFSe)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
      setSelectAll(false)
    }
    setSelectedNFSe(newSelected)

    // Verificar se todos estão selecionados
    if (searchResults) {
      const results = Array.isArray(searchResults) ? searchResults : [searchResults]
      const allSelected = results.every(nfse => newSelected.has(nfse.id))
      setSelectAll(allSelected)
    }
  }

  const handleDownloadSelected = () => {
    if (selectedNFSe.size === 0) {
      toast.error('Selecione pelo menos uma NFSe para download')
      return
    }

    // Buscar as NFSe selecionadas
    if (!searchResults) return
    const results = Array.isArray(searchResults) ? searchResults : [searchResults]
    const selectedNFSeList = results.filter(nfse => selectedNFSe.has(nfse.id))

    downloadZipMutation.mutate(selectedNFSeList)
  }

  const handleDownloadSingle = (id: number) => {
    downloadXMLMutation.mutate(id)
  }

  const handleDownloadAllFiltered = () => {
    if (!searchResults) {
      toast.error('Nenhuma NFSe disponível para download')
      return
    }

    const results = Array.isArray(searchResults) ? searchResults : [searchResults]
    downloadZipMutation.mutate(results)
  }

  const renderSearchForm = () => {
    switch (searchType) {
      case 'all':
        return (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Mostrando todas as NFSe disponíveis no sistema
            </p>
          </div>
        )
      case 'number':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="numero">Número da NFSe</Label>
              <Input
                id="numero"
                placeholder="Ex: 250000012"
                value={searchParams.numero}
                onChange={(e) => setSearchParams(prev => ({ ...prev, numero: e.target.value }))}
              />
            </div>
          </div>
        )
      case 'prestador':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="cnpj">CNPJ do Prestador</Label>
              <Input
                id="cnpj"
                placeholder="Ex: 52399222000122"
                value={searchParams.cnpj}
                onChange={(e) => setSearchParams(prev => ({ ...prev, cnpj: e.target.value }))}
              />
            </div>
          </div>
        )
      case 'period':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Data Inicial</Label>
              <Input
                id="startDate"
                type="date"
                value={searchParams.startDate}
                onChange={(e) => setSearchParams(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="endDate">Data Final</Label>
              <Input
                id="endDate"
                type="date"
                value={searchParams.endDate}
                onChange={(e) => setSearchParams(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>
        )
    }
  }

  const renderResults = () => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )
    }

    if (error) {
      return (
        <div className="text-center py-8">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Erro ao buscar NFSe</p>
        </div>
      )
    }

    if (!searchResults) {
      if (!isFiltered) {
        return (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando todas as NFSe...</p>
          </div>
        )
      }
      return (
        <div className="text-center py-8">
          <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Use os filtros acima para buscar NFSe específicas</p>
        </div>
      )
    }

    const results = Array.isArray(searchResults) ? searchResults : [searchResults]

    if (results.length === 0) {
      return (
        <div className="text-center py-8">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhuma NFSe encontrada</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {/* Ações em massa */}
        {results.length > 0 && (
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select-all"
                  checked={selectAll}
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all" className="text-sm font-medium">
                  Selecionar todas ({results.length} NFSe)
                </Label>
              </div>
              {selectedNFSe.size > 0 && (
                <Badge variant="secondary">
                  {selectedNFSe.size} selecionadas
                </Badge>
              )}
            </div>

            {selectedNFSe.size > 0 && (
              <div className="flex gap-2">
                <Button
                  onClick={handleDownloadSelected}
                  disabled={downloadZipMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <Archive className="h-4 w-4" />
                  {downloadZipMutation.isPending ? 'Baixando...' : 'Baixar ZIP'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Tabela */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectAll}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Número</TableHead>
              <TableHead>Data Emissão</TableHead>
              <TableHead>Prestador</TableHead>
              <TableHead>Valor Líquido</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((nfse) => (
              <TableRow key={nfse.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedNFSe.has(nfse.id)}
                    onCheckedChange={(checked) => handleSelectNFSe(nfse.id, checked as boolean)}
                  />
                </TableCell>
                <TableCell className="font-medium">{nfse.numero}</TableCell>
                <TableCell>{formatDate(nfse.data_emissao)}</TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">CNPJ: {maskCNPJ(nfse.prestador_cnpj)}</p>
                    <p className="text-sm text-muted-foreground">
                      {nfse.prestador_razao_social || 'N/A'}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  {formatCurrency(nfse.valor_liquido)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{nfse.status}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadSingle(nfse.id)}
                      disabled={downloadXMLMutation.isPending}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Gestão de NFSe</h1>
        <p className="text-muted-foreground">
          Consulte e gerencie suas notas fiscais de serviço eletrônicas
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros de Busca
          </CardTitle>
          <CardDescription>
            Configure os filtros para encontrar as NFSe desejadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={searchType} onValueChange={(value) => setSearchType(value as any)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="number">Por Número</TabsTrigger>
              <TabsTrigger value="prestador">Por Prestador</TabsTrigger>
              <TabsTrigger value="period">Por Período</TabsTrigger>
            </TabsList>
            
            <div className="mt-6">
              {renderSearchForm()}
            </div>
            
            <div className="flex gap-2 mt-6">
              {searchType !== 'all' && (
                <Button onClick={handleSearch} className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Buscar
                </Button>
              )}
              {(isFiltered || searchType !== 'all') && (
                <Button variant="outline" onClick={handleClear}>
                  Mostrar Todas
                </Button>
              )}
              {searchType !== 'all' && (
                <Button variant="outline" onClick={() => {
                  setSearchParams({
                    numero: '',
                    cnpj: '',
                    startDate: '',
                    endDate: ''
                  })
                }}>
                  Limpar Campos
                </Button>
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Resultados</CardTitle>
              <CardDescription>
                {isLoading ? (
                  'Carregando...'
                ) : searchResults && Array.isArray(searchResults) ? (
                  isFiltered
                    ? `${searchResults.length} NFSe encontradas com os filtros aplicados`
                    : `${searchResults.length} NFSe no total do sistema`
                ) : searchResults ? (
                  '1 NFSe encontrada'
                ) : isFiltered ? (
                  'Nenhuma NFSe encontrada com os filtros aplicados'
                ) : (
                  'Nenhuma NFSe disponível no sistema'
                )}
              </CardDescription>
            </div>

            {/* Botão para baixar todas as filtradas */}
            {searchResults && (
              <Button
                onClick={handleDownloadAllFiltered}
                disabled={downloadZipMutation.isPending}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Archive className="h-4 w-4" />
                {downloadZipMutation.isPending ? 'Baixando...' : 'Baixar Todas (ZIP)'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {renderResults()}
        </CardContent>
      </Card>
    </div>
  )
}
