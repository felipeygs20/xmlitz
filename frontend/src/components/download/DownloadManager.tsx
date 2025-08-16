'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { startDownload, getDownloadStatus } from '@/lib/api'
import { Download, Play, Settings, Clock, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'

interface DownloadForm {
  startDate: string
  endDate: string
  cnpjList: string
}

export default function DownloadManager() {
  const [form, setForm] = useState<DownloadForm>({
    startDate: '2025-07-01',
    endDate: '2025-08-01',
    cnpjList: ''
  })
  const [activeDownloads, setActiveDownloads] = useState<number[]>([])

  const downloadMutation = useMutation({
    mutationFn: async (cnpjData: { cnpj: string; senha: string }) => {
      const response = await startDownload({
        cnpj: cnpjData.cnpj,
        senha: cnpjData.senha,
        startDate: form.startDate,
        endDate: form.endDate,
        headless: true,
        maxRetries: 1
      })
      return response
    },
    onSuccess: (data) => {
      setActiveDownloads(prev => [...prev, data.executionId])
      toast.success('Download iniciado com sucesso!')
    },
    onError: (error: any) => {
      toast.error(`Erro ao iniciar download: ${error.message}`)
    }
  })

  const { data: downloadStatuses } = useQuery({
    queryKey: ['download-statuses', activeDownloads],
    queryFn: async () => {
      const statuses = await Promise.all(
        activeDownloads.map(id => getDownloadStatus(id))
      )
      return statuses
    },
    enabled: activeDownloads.length > 0,
    refetchInterval: 5000
  })

  const handlePresetLoad = (preset: 'preset1' | 'custom') => {
    if (preset === 'preset1') {
      setForm(prev => ({
        ...prev,
        cnpjList: `52399222000122:123456
51476314000104:123456
53523583000100:123456`
      }))
      toast.success('Preset carregado: 3 CNPJs para Jul/2025')
    } else {
      setForm(prev => ({ ...prev, cnpjList: '' }))
      toast.info('Configure manualmente os CNPJs e senhas')
    }
  }

  const handleStartDownloads = async () => {
    const cnpjLines = form.cnpjList.trim().split('\n').filter(line => line.trim())
    
    if (cnpjLines.length === 0) {
      toast.error('Por favor, insira pelo menos um CNPJ')
      return
    }

    const cnpjList = []
    for (const line of cnpjLines) {
      const [cnpj, senha] = line.split(':')
      if (cnpj && senha) {
        cnpjList.push({ cnpj: cnpj.trim(), senha: senha.trim() })
      }
    }

    if (cnpjList.length === 0) {
      toast.error('Formato inválido. Use: CNPJ:SENHA (um por linha)')
      return
    }

    toast.info(`Iniciando downloads para ${cnpjList.length} CNPJs...`)

    for (const cnpjData of cnpjList) {
      await downloadMutation.mutateAsync(cnpjData)
      // Aguardar 2 segundos entre downloads
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'concluido':
        return 'bg-green-500'
      case 'executando':
        return 'bg-blue-500'
      case 'erro':
      case 'falhou':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'concluido':
        return <CheckCircle className="h-4 w-4" />
      case 'executando':
        return <Clock className="h-4 w-4" />
      case 'erro':
      case 'falhou':
        return <XCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Downloads de XML</h1>
        <p className="text-muted-foreground">
          Configure e execute downloads automáticos de NFSe
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Preset Cards */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handlePresetLoad('preset1')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Preset 1
            </CardTitle>
            <CardDescription>
              3 CNPJs configurados para Jul/2025
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handlePresetLoad('custom')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Personalizado
            </CardTitle>
            <CardDescription>
              Configure manualmente os CNPJs e datas
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Configuração de Download
          </CardTitle>
          <CardDescription>
            Configure os parâmetros para download dos XMLs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Data Inicial</Label>
              <Input
                id="startDate"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="endDate">Data Final</Label>
              <Input
                id="endDate"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="cnpjList">Lista de CNPJs (formato: CNPJ:SENHA, um por linha)</Label>
            <Textarea
              id="cnpjList"
              placeholder="52399222000122:123456&#10;51476314000104:123456&#10;53523583000100:123456"
              rows={6}
              value={form.cnpjList}
              onChange={(e) => setForm(prev => ({ ...prev, cnpjList: e.target.value }))}
            />
          </div>

          <Button 
            onClick={handleStartDownloads} 
            disabled={downloadMutation.isPending}
            className="w-full"
          >
            <Play className="h-4 w-4 mr-2" />
            {downloadMutation.isPending ? 'Iniciando...' : 'Iniciar Downloads'}
          </Button>
        </CardContent>
      </Card>

      {/* Download Progress */}
      {activeDownloads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Progresso dos Downloads</CardTitle>
            <CardDescription>
              Acompanhe o status dos downloads em andamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {downloadStatuses?.map((status, index) => (
                <div key={activeDownloads[index]} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status.status)}
                      <span className="font-medium">Download #{activeDownloads[index]}</span>
                      <Badge variant="outline" className={getStatusColor(status.status)}>
                        {status.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {status.progress?.xmlsDownloaded || 0} XMLs baixados
                    </div>
                  </div>
                  
                  {status.status === 'executando' && status.progress && (
                    <Progress 
                      value={(status.progress.currentPage / status.progress.totalPages) * 100} 
                      className="w-full"
                    />
                  )}
                  
                  {status.error && (
                    <p className="text-sm text-red-600">{status.error}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
