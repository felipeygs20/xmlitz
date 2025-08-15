/**
 * Controller de Download
 * Responsável por endpoints de inicialização de downloads
 */

import { Logger } from '../../utils/Logger.js';
import { ErrorHandler } from '../../utils/ErrorHandler.js';
import { RequestValidator } from '../validators/RequestValidator.js';

export class DownloadController {
    constructor(config, executionManager) {
        this.config = config;
        this.executionManager = executionManager;
        this.logger = Logger.getInstance();
        this.errorHandler = ErrorHandler.getInstance();
        this.validator = new RequestValidator();
    }
    
    /**
     * POST /download - Iniciar download de XMLs
     */
    async startDownload(req, res) {
        try {
            this.logger.info('Requisição de download recebida', {
                requestId: req.id,
                userAgent: req.get('User-Agent'),
                ip: req.ip
            });
            
            // Validar parâmetros da requisição
            const validationResult = this.validator.validateDownloadRequest(req.body);
            
            if (!validationResult.isValid) {
                return res.status(400).json({
                    error: 'Parâmetros inválidos',
                    message: 'Verifique os parâmetros enviados',
                    details: validationResult.errors,
                    required: ['cnpj', 'senha'],
                    optional: ['startDate', 'endDate', 'headless', 'maxRetries'],
                    examples: {
                        cnpj: '12345678000199',
                        senha: 'suasenha',
                        startDate: '2025-07-01',
                        endDate: '2025-07-31',
                        headless: true,
                        maxRetries: 3
                    }
                });
            }
            
            // Extrair e processar parâmetros
            const params = this.processDownloadParams(req.body);
            
            this.logger.debug('Parâmetros de download processados', {
                requestId: req.id,
                params: {
                    cnpj: this.maskCNPJ(params.cnpj),
                    startDate: params.startDate,
                    endDate: params.endDate,
                    headless: params.headless,
                    maxRetries: params.maxRetries
                }
            });
            
            // Iniciar execução
            const executionId = await this.executionManager.startExecution(params);
            
            // Resposta imediata
            const response = {
                executionId: executionId,
                status: 'iniciado',
                message: 'Download iniciado em background',
                statusUrl: `/status/${executionId}`,
                params: {
                    cnpj: this.maskCNPJ(params.cnpj),
                    startDate: params.startDate,
                    endDate: params.endDate,
                    headless: params.headless,
                    maxRetries: params.maxRetries
                },
                estimatedDuration: this.estimateDuration(params),
                instructions: {
                    checkStatus: `GET /status/${executionId}`,
                    listAll: 'GET /executions',
                    cancel: `DELETE /executions/${executionId}`
                }
            };
            
            this.logger.success('Download iniciado com sucesso', {
                requestId: req.id,
                executionId: executionId
            });
            
            res.status(202).json(response);
            
        } catch (error) {
            this.errorHandler.handle(error, 'download-controller-start');
            
            this.logger.error('Erro ao iniciar download', {
                requestId: req.id,
                error: error.message
            });
            
            res.status(500).json({
                error: 'Erro interno do servidor',
                message: error.message,
                requestId: req.id,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    /**
     * Processa e valida parâmetros de download
     */
    processDownloadParams(body) {
        const {
            cnpj,
            senha,
            startDate,
            endDate,
            headless = true,
            maxRetries = 3
        } = body;
        
        // Aplicar valores padrão se não fornecidos
        const defaultStartDate = startDate || this.getCurrentMonthStart();
        const defaultEndDate = endDate || this.getCurrentMonthEnd();
        
        return {
            cnpj: cnpj.trim(),
            senha: senha.trim(),
            startDate: defaultStartDate,
            endDate: defaultEndDate,
            headless: Boolean(headless),
            maxRetries: Math.max(1, Math.min(10, parseInt(maxRetries) || 3))
        };
    }
    
    /**
     * Estima duração do download baseado nos parâmetros
     */
    estimateDuration(params) {
        try {
            const startDate = new Date(params.startDate);
            const endDate = new Date(params.endDate);
            const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            
            // Estimativa baseada em experiência: ~30 segundos por dia de período
            const estimatedSeconds = Math.max(60, daysDiff * 30);
            
            if (estimatedSeconds < 120) {
                return `${estimatedSeconds} segundos`;
            } else if (estimatedSeconds < 3600) {
                return `${Math.round(estimatedSeconds / 60)} minutos`;
            } else {
                return `${Math.round(estimatedSeconds / 3600)} horas`;
            }
            
        } catch (error) {
            return 'não estimado';
        }
    }
    
    /**
     * Mascara CNPJ para resposta
     */
    maskCNPJ(cnpj) {
        if (!cnpj || cnpj.length < 8) return cnpj;
        return cnpj.substring(0, 4) + '****' + cnpj.substring(cnpj.length - 4);
    }
    
    /**
     * Obtém início do mês atual
     */
    getCurrentMonthStart() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    }
    
    /**
     * Obtém fim do mês atual
     */
    getCurrentMonthEnd() {
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDay}`;
    }
}
