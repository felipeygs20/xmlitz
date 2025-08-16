/**
 * Rotas da API para NFSe
 * Endpoints para consulta e processamento de NFSe
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import archiver from 'archiver';
import { NFSeIngestService } from '../core/NFSeIngestService.js';
import { logger } from '../utils/OptimizedLogger.js';

const router = express.Router();

// Configurar multer para upload de arquivos
const upload = multer({
    dest: 'temp/uploads/',
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
        files: 10
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/xml' || file.originalname.toLowerCase().endsWith('.xml')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos XML são permitidos'), false);
        }
    }
});

// Instância do serviço de ingestão
let ingestService = null;
let initializationPromise = null;
let isInitialized = false;

// Fila de requisições pendentes durante inicialização
const pendingRequests = [];

// Inicializar serviço com proteção contra múltiplas inicializações
async function initializeService() {
    if (ingestService && isInitialized) {
        return ingestService;
    }

    // Se já está inicializando, aguardar a inicialização em andamento
    if (initializationPromise) {
        await initializationPromise;
        return ingestService;
    }

    // Inicializar apenas uma vez
    initializationPromise = (async () => {
        try {
            logger.system('Banco de dados NFSe inicializado');
            ingestService = new NFSeIngestService();
            await ingestService.initialize();
            isInitialized = true;
            logger.system('Serviço de ingestão NFSe inicializado');

            // Processar requisições pendentes
            await processPendingRequests();

        } catch (error) {
            logger.error('Erro ao inicializar serviço de ingestão NFSe', {
                error: error.message
            });
            ingestService = null;
            initializationPromise = null;
            isInitialized = false;
            throw error;
        }
    })();

    await initializationPromise;
    return ingestService;
}

// Processar requisições que ficaram na fila durante inicialização
async function processPendingRequests() {
    if (pendingRequests.length === 0) return;

    logger.system(`Processando ${pendingRequests.length} requisições pendentes`);

    const requests = [...pendingRequests];
    pendingRequests.length = 0; // Limpar fila

    for (const request of requests) {
        try {
            await request.handler();
            logger.system('Requisição pendente processada com sucesso');
        } catch (error) {
            logger.error('Erro ao processar requisição pendente', {
                error: error.message
            });
            request.reject(error);
        }
    }
}

// Wrapper para garantir que requisições não sejam perdidas
async function safeServiceCall(handler, fallbackResponse = null) {
    if (isInitialized && ingestService) {
        // Serviço já inicializado, executar diretamente
        return await handler(ingestService);
    }

    // Serviço não inicializado, enfileirar requisição
    return new Promise((resolve, reject) => {
        const request = {
            handler: async () => {
                try {
                    const result = await handler(ingestService);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            },
            reject,
            timestamp: Date.now()
        };

        pendingRequests.push(request);
        logger.system('Requisição enfileirada durante inicialização');

        // Inicializar serviço se ainda não foi iniciado
        initializeService().catch(reject);
    });
}

/**
 * GET /nfse/stats
 * Estatísticas gerais do sistema
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await safeServiceCall(async (service) => {
            return await service.getGeneralStats();
        });

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        logger.error('Erro ao obter estatísticas', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /nfse/stats/cnpj
 * Estatísticas agrupadas por CNPJ
 */
router.get('/stats/cnpj', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const stats = await safeServiceCall(async (service) => {
            return await service.getStatsByCNPJ(limit);
        });

        res.json({
            success: true,
            data: stats,
            total: stats.length
        });

    } catch (error) {
        logger.error('Erro ao obter estatísticas por CNPJ', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /nfse/stats/cnpj/:cnpj
 * Estatísticas detalhadas de um CNPJ específico
 */
router.get('/stats/cnpj/:cnpj', async (req, res) => {
    try {
        const service = await initializeService();
        const cnpj = req.params.cnpj;
        const stats = await service.getDetailedStatsByCNPJ(cnpj);

        if (!stats) {
            return res.status(404).json({
                success: false,
                error: 'CNPJ não encontrado'
            });
        }

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        logger.error('Erro ao obter estatísticas detalhadas do CNPJ', {
            cnpj: req.params.cnpj,
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /nfse/stats/competencia
 * Estatísticas agrupadas por competência (mês/ano)
 */
router.get('/stats/competencia', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 24;
        const stats = await safeServiceCall(async (service) => {
            return await service.getStatsByCompetencia(limit);
        });

        res.json({
            success: true,
            data: stats,
            total: stats.length
        });

    } catch (error) {
        logger.error('Erro ao obter estatísticas por competência', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /nfse/stats/competencia/:ano/:mes?
 * Estatísticas detalhadas de uma competência específica
 */
router.get('/stats/competencia/:ano/:mes?', async (req, res) => {
    try {
        const service = await initializeService();
        const ano = req.params.ano;
        const mes = req.params.mes;

        // Validar ano
        if (!/^\d{4}$/.test(ano)) {
            return res.status(400).json({
                success: false,
                error: 'Ano deve ter 4 dígitos'
            });
        }

        // Validar mês se fornecido
        if (mes && (!/^\d{1,2}$/.test(mes) || parseInt(mes) < 1 || parseInt(mes) > 12)) {
            return res.status(400).json({
                success: false,
                error: 'Mês deve ser um número entre 1 e 12'
            });
        }

        const stats = await service.getDetailedStatsByCompetencia(ano, mes);

        if (!stats) {
            return res.status(404).json({
                success: false,
                error: 'Competência não encontrada'
            });
        }

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        logger.error('Erro ao obter estatísticas detalhadas da competência', {
            ano: req.params.ano,
            mes: req.params.mes,
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /nfse/stats/downloads
 * Estatísticas de downloads por CNPJ
 */
router.get('/stats/downloads', async (req, res) => {
    try {
        const stats = await safeServiceCall(async (service) => {
            return await service.getDownloadStatsByCNPJ();
        });

        res.json({
            success: true,
            data: stats,
            total: stats.length
        });

    } catch (error) {
        logger.error('Erro ao obter estatísticas de downloads', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /nfse/batches
 * Lista lotes processados
 */
router.get('/batches', async (req, res) => {
    try {
        const service = await initializeService();
        const batches = await service.getBatchStats();
        
        res.json({
            success: true,
            data: batches
        });

    } catch (error) {
        logger.error('Erro ao listar lotes', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /nfse/search/numero/:numero
 * Busca NFSe por número
 */
router.get('/search/numero/:numero', async (req, res) => {
    try {
        const { numero } = req.params;
        const service = await initializeService();
        const nfse = await service.findNFSeByNumero(numero);
        
        if (nfse) {
            res.json({
                success: true,
                data: nfse
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'NFSe não encontrada'
            });
        }

    } catch (error) {
        logger.error('Erro ao buscar NFSe por número', { 
            numero: req.params.numero,
            error: error.message 
        });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /nfse/search/prestador/:cnpj
 * Busca NFSe por CNPJ do prestador
 */
router.get('/search/prestador/:cnpj', async (req, res) => {
    try {
        const { cnpj } = req.params;
        const limit = parseInt(req.query.limit) || 100;
        
        const service = await initializeService();
        const nfseList = await service.findNFSeByPrestador(cnpj, limit);
        
        res.json({
            success: true,
            data: nfseList,
            count: nfseList.length
        });

    } catch (error) {
        logger.error('Erro ao buscar NFSe por prestador', { 
            cnpj: req.params.cnpj,
            error: error.message 
        });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /nfse/search/period
 * Busca NFSe por período
 */
router.get('/search/period', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const limit = parseInt(req.query.limit) || 100;
        
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Parâmetros startDate e endDate são obrigatórios'
            });
        }
        
        const service = await initializeService();
        const nfseList = await service.findNFSeByPeriod(startDate, endDate, limit);
        
        res.json({
            success: true,
            data: nfseList,
            count: nfseList.length,
            period: { startDate, endDate }
        });

    } catch (error) {
        logger.error('Erro ao buscar NFSe por período', { 
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            error: error.message 
        });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /nfse/upload
 * Upload e processamento de arquivos XML
 */
router.post('/upload', upload.array('xmlFiles', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Nenhum arquivo foi enviado'
            });
        }

        const service = await initializeService();
        const filePaths = req.files.map(file => file.path);
        
        // Processar arquivos
        const result = await service.processFiles(filePaths, 'upload');
        
        // Limpar arquivos temporários
        for (const file of req.files) {
            try {
                await fs.remove(file.path);
            } catch (error) {
                logger.warn('Erro ao remover arquivo temporário', { 
                    path: file.path,
                    error: error.message 
                });
            }
        }

        res.json({
            success: true,
            message: 'Arquivos processados com sucesso',
            data: result
        });

    } catch (error) {
        logger.error('Erro ao processar upload', { error: error.message });
        
        // Limpar arquivos temporários em caso de erro
        if (req.files) {
            for (const file of req.files) {
                try {
                    await fs.remove(file.path);
                } catch (cleanupError) {
                    logger.warn('Erro ao limpar arquivo temporário', { 
                        path: file.path,
                        error: cleanupError.message 
                    });
                }
            }
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /nfse/process/downloads
 * Processa arquivos baixados pelo sistema XMLITZ
 */
router.post('/process/downloads', async (req, res) => {
    try {
        const { cnpj, year, month } = req.body;
        
        if (!cnpj || !year || !month) {
            return res.status(400).json({
                success: false,
                message: 'Parâmetros cnpj, year e month são obrigatórios'
            });
        }

        const service = await initializeService();
        const result = await service.processDownloadedFiles(cnpj, year, month);
        
        res.json({
            success: true,
            message: 'Arquivos baixados processados com sucesso',
            data: result
        });

    } catch (error) {
        logger.error('Erro ao processar arquivos baixados', { 
            cnpj: req.body.cnpj,
            year: req.body.year,
            month: req.body.month,
            error: error.message 
        });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /nfse/process/directory
 * Processa diretório de arquivos XML
 */
router.post('/process/directory', async (req, res) => {
    try {
        const { dirPath, source } = req.body;

        if (!dirPath) {
            return res.status(400).json({
                success: false,
                message: 'Parâmetro dirPath é obrigatório'
            });
        }

        const service = await initializeService();
        const result = await service.processDirectory(dirPath, source || 'manual');

        res.json({
            success: true,
            message: 'Diretório processado com sucesso',
            data: result
        });

    } catch (error) {
        logger.error('Erro ao processar diretório', {
            dirPath: req.body.dirPath,
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /nfse/download/:id
 * Download do XML original de uma NFSe específica
 */
router.get('/download/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const service = await initializeService();

        // Buscar NFSe no banco
        const nfse = await service.findNFSeByNumero(id);

        if (!nfse) {
            return res.status(404).json({
                success: false,
                message: 'NFSe não encontrada'
            });
        }

        // Buscar arquivo XML original
        const xmlPath = path.join(process.cwd(), 'downloads',
            nfse.batch_created_at.substring(0, 4), // year
            nfse.batch_created_at.substring(5, 7), // month
            nfse.prestador_cnpj,
            nfse.batch_filename
        );

        const exists = await fs.pathExists(xmlPath);
        if (!exists) {
            return res.status(404).json({
                success: false,
                message: 'Arquivo XML não encontrado'
            });
        }

        // Enviar arquivo
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename="NFSe-${nfse.numero}.xml"`);

        const xmlContent = await fs.readFile(xmlPath, 'utf8');
        res.send(xmlContent);

    } catch (error) {
        logger.error('Erro ao baixar XML', {
            id: req.params.id,
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /nfse/export/zip
 * Exporta múltiplas NFSe em um arquivo ZIP
 */
router.post('/export/zip', async (req, res) => {
    try {
        const { filters } = req.body;
        const service = await initializeService();

        logger.info('Iniciando exportação ZIP', { filters });

        // Buscar NFSe baseado nos filtros
        let nfseList = [];

        if (filters.nfseNumbers && Array.isArray(filters.nfseNumbers)) {
            // Buscar múltiplas NFSe por números específicos
            logger.info('Buscando NFSe por números específicos', { count: filters.nfseNumbers.length });
            for (const numero of filters.nfseNumbers) {
                const nfse = await service.findNFSeByNumero(numero);
                if (nfse) {
                    nfseList.push(nfse);
                    logger.debug('NFSe encontrada', { numero, batch_filename: nfse.batch_filename });
                }
            }
        } else if (filters.numero) {
            const nfse = await service.findNFSeByNumero(filters.numero);
            if (nfse) nfseList = [nfse];
        } else if (filters.cnpj) {
            nfseList = await service.findNFSeByPrestador(filters.cnpj, 1000);
        } else if (filters.startDate && filters.endDate) {
            nfseList = await service.findNFSeByPeriod(filters.startDate, filters.endDate, 1000);
        }

        if (nfseList.length === 0) {
            logger.warn('Nenhuma NFSe encontrada para os filtros', { filters });
            return res.status(404).json({
                success: false,
                message: 'Nenhuma NFSe encontrada para os filtros especificados'
            });
        }

        logger.info('NFSe encontradas para exportação', { count: nfseList.length });

        // Criar ZIP
        const archive = archiver('zip', { zlib: { level: 9 } });
        let filesAdded = 0;

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="NFSe-Export-${new Date().toISOString().split('T')[0]}.zip"`);

        archive.pipe(res);

        // Adicionar arquivos XML ao ZIP
        for (const nfse of nfseList) {
            try {
                // Buscar arquivo XML em múltiplos locais possíveis
                const possiblePaths = [
                    // Estrutura baseada na data de emissão da NFSe
                    path.join(process.cwd(), 'downloads', '2025', '07', nfse.prestador_cnpj, nfse.batch_filename),
                    path.join(process.cwd(), 'downloads', '2025', '08', nfse.prestador_cnpj, nfse.batch_filename),

                    // Estrutura baseada no batch_created_at
                    path.join(process.cwd(), 'downloads',
                        nfse.batch_created_at.substring(0, 4),
                        nfse.batch_created_at.substring(5, 7),
                        nfse.prestador_cnpj,
                        nfse.batch_filename),

                    // Estruturas alternativas
                    path.join(process.cwd(), 'downloads', '2025', '07', nfse.batch_filename),
                    path.join(process.cwd(), 'downloads', '2025', '08', nfse.batch_filename),
                    path.join(process.cwd(), 'downloads', nfse.prestador_cnpj, nfse.batch_filename),
                    path.join(process.cwd(), 'downloads', nfse.batch_filename)
                ];

                let fileFound = false;

                for (const xmlPath of possiblePaths) {
                    logger.debug('Verificando caminho', {
                        nfse: nfse.numero,
                        xmlPath,
                        batch_filename: nfse.batch_filename
                    });

                    const exists = await fs.pathExists(xmlPath);
                    if (exists) {
                        // Ler conteúdo do arquivo XML
                        const xmlContent = await fs.readFile(xmlPath, 'utf8');

                        // Adicionar ao ZIP com nome personalizado
                        archive.append(xmlContent, { name: `NFSe-${nfse.numero}-${nfse.prestador_cnpj}.xml` });
                        filesAdded++;
                        fileFound = true;

                        logger.info('Arquivo XML encontrado e adicionado ao ZIP', {
                            nfse: nfse.numero,
                            xmlPath,
                            filename: `NFSe-${nfse.numero}-${nfse.prestador_cnpj}.xml`
                        });
                        break;
                    }
                }

                if (!fileFound) {
                    logger.warn('Arquivo XML não encontrado em nenhum caminho', {
                        nfse: nfse.numero,
                        batch_filename: nfse.batch_filename,
                        prestador_cnpj: nfse.prestador_cnpj,
                        pathsChecked: possiblePaths
                    });
                }

            } catch (fileError) {
                logger.error('Erro ao processar arquivo XML', {
                    nfse: nfse.numero,
                    error: fileError.message,
                    stack: fileError.stack
                });
            }
        }

        // Se nenhum arquivo foi adicionado, adicionar um arquivo de erro
        if (filesAdded === 0) {
            const errorMessage = `Nenhum arquivo XML foi encontrado para as ${nfseList.length} NFSe selecionadas.\n\nNFSe buscadas:\n${nfseList.map(n => `- ${n.numero} (${n.batch_filename})`).join('\n')}`;
            archive.append(errorMessage, { name: 'ERRO-Arquivos-Nao-Encontrados.txt' });
            logger.warn('Nenhum arquivo XML encontrado', { nfseCount: nfseList.length });
        }

        logger.info('Finalizando ZIP', { filesAdded, totalNFSe: nfseList.length });
        archive.finalize();

    } catch (error) {
        logger.error('Erro ao exportar ZIP', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
