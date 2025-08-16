import axios from 'axios'

const api = axios.create({
  baseURL: typeof window !== 'undefined'
    ? '/api' // Use proxy in browser
    : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000', // Direct URL in server
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Connection': 'keep-alive',
  },
  maxRedirects: 5,
  maxContentLength: 50 * 1024 * 1024, // 50MB
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available (only in browser)
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  },
  (error) => {
    console.error('Request error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // Return the full response for better error handling
    return response
  },
  (error) => {
    console.error('Response error:', error)

    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Handle unauthorized (only in browser)
      localStorage.removeItem('auth_token')
      window.location.href = '/login'
    }

    // Return a more detailed error
    const errorMessage = error.response?.data?.message || error.message || 'Erro desconhecido'
    return Promise.reject(new Error(errorMessage))
  }
)

// Types
export interface NFSeStats {
  total_batches: number
  total_nfse_files: number
  total_nfse_processed: number
  total_size_bytes: number
  total_nfse_docs: number
  unique_prestadores: number
  unique_tomadores: number
  total_valor_liquido: number
  oldest_nfse: string
  newest_nfse: string
}

export interface NFSe {
  id: number
  numero: string
  data_emissao: string
  prestador_cnpj: string
  prestador_razao_social: string
  tomador_cnpj: string
  tomador_razao_social: string
  valor_liquido: number
  discriminacao: string
  status: string
  batch_filename: string
  batch_created_at: string
}

export interface DownloadRequest {
  cnpj: string
  senha: string
  startDate: string
  endDate: string
  headless?: boolean
  maxRetries?: number
}

export interface DownloadStatus {
  id: number
  status: 'pendente' | 'executando' | 'concluido' | 'erro' | 'falhou'
  progress?: {
    xmlsDownloaded: number
    duplicatesDetected: number
    currentPage: number
    totalPages: number
  }
  results?: {
    xmlsDownloaded: number
    duplicatesDetected: number
    executionTime: number
  }
  error?: string
  startTime: string
  endTime?: string
}

// API Functions
export const fetchStats = async (): Promise<NFSeStats> => {
  const response = await api.get('/nfse/stats')
  if (response.data.success) {
    return response.data.data
  }
  throw new Error(response.data.message || 'Erro ao buscar estatísticas')
}

export const fetchRecentActivity = async (limit = 10): Promise<NFSe[]> => {
  const response = await api.get(`/nfse/search/period?startDate=2025-07-01&endDate=2025-08-31&limit=${limit}`)
  if (response.data.success) {
    return Array.isArray(response.data.data) ? response.data.data : [response.data.data].filter(Boolean)
  }
  throw new Error(response.data.message || 'Erro ao buscar atividade recente')
}

export const searchNFSeByNumber = async (numero: string): Promise<NFSe> => {
  const response = await api.get(`/nfse/search/numero/${numero}`)
  if (response.data.success) {
    return response.data.data
  }
  throw new Error(response.data.message || 'NFSe não encontrada')
}

export const searchNFSeByPrestador = async (cnpj: string, limit = 50): Promise<NFSe[]> => {
  const response = await api.get(`/nfse/search/prestador/${cnpj}?limit=${limit}`)
  if (response.data.success) {
    return Array.isArray(response.data.data) ? response.data.data : [response.data.data].filter(Boolean)
  }
  throw new Error(response.data.message || 'Nenhuma NFSe encontrada')
}

export const searchNFSeByPeriod = async (startDate: string, endDate: string, limit = 50): Promise<NFSe[]> => {
  const response = await api.get(`/nfse/search/period?startDate=${startDate}&endDate=${endDate}&limit=${limit}`)
  if (response.data.success) {
    return Array.isArray(response.data.data) ? response.data.data : [response.data.data].filter(Boolean)
  }
  throw new Error(response.data.message || 'Nenhuma NFSe encontrada no período')
}

export const startDownload = async (request: DownloadRequest): Promise<{ executionId: number }> => {
  const response = await api.post('/download', request)
  if (response.data.success !== false) {
    return response.data
  }
  throw new Error(response.data.error || 'Erro ao iniciar download')
}

export const getDownloadStatus = async (executionId: number): Promise<DownloadStatus> => {
  const response = await api.get(`/status/${executionId}`)
  return response.data
}

export const processDownloadedFiles = async (cnpj: string, year: string, month: string) => {
  const response = await api.post('/nfse/process/downloads', { cnpj, year, month })
  if (response.data.success) {
    return response.data
  }
  throw new Error(response.data.message || 'Erro ao processar arquivos')
}

export const getBatches = async () => {
  const response = await api.get('/nfse/batches')
  return response.data
}

export const downloadNFSeXML = async (id: number): Promise<Blob> => {
  const response = await api.get(`/nfse/download/${id}`, {
    responseType: 'blob'
  })
  return response.data
}

export const exportNFSeZip = async (filters: any): Promise<Blob> => {
  const response = await api.post('/nfse/export/zip', { filters }, {
    responseType: 'blob'
  })
  return response.data
}

// Novas funções de estatísticas
export const fetchStatsByCNPJ = async (limit = 50) => {
  const response = await api.get(`/nfse/stats/cnpj?limit=${limit}`)
  if (response.data.success) {
    return response.data.data
  }
  throw new Error(response.data.message || 'Erro ao buscar estatísticas por CNPJ')
}

export const fetchDetailedStatsByCNPJ = async (cnpj: string) => {
  const response = await api.get(`/nfse/stats/cnpj/${cnpj}`)
  if (response.data.success) {
    return response.data.data
  }
  throw new Error(response.data.message || 'Erro ao buscar estatísticas detalhadas do CNPJ')
}

export const fetchStatsByCompetencia = async (limit = 24) => {
  const response = await api.get(`/nfse/stats/competencia?limit=${limit}`)
  if (response.data.success) {
    return response.data.data
  }
  throw new Error(response.data.message || 'Erro ao buscar estatísticas por competência')
}

export const fetchDetailedStatsByCompetencia = async (ano: string, mes?: string) => {
  const url = mes ? `/nfse/stats/competencia/${ano}/${mes}` : `/nfse/stats/competencia/${ano}`
  const response = await api.get(url)
  if (response.data.success) {
    return response.data.data
  }
  throw new Error(response.data.message || 'Erro ao buscar estatísticas detalhadas da competência')
}

export const fetchDownloadStats = async () => {
  const response = await api.get('/nfse/stats/downloads')
  if (response.data.success) {
    return response.data.data
  }
  throw new Error(response.data.message || 'Erro ao buscar estatísticas de downloads')
}

export default api
