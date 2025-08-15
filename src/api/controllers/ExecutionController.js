/**
 * Controller de Execução
 * Responsável por endpoints de gerenciamento de execuções
 */

import { Logger } from '../../utils/Logger.js';
import { ErrorHandler } from '../../utils/ErrorHandler.js';

export class ExecutionController {
    constructor(config, executionManager) {
        this.config = config;
        this.executionManager = executionManager;
        this.logger = Logger.getInstance();
        this.errorHandler = ErrorHandler.getInstance();
    }
    
    /**
     * GET /status/:id - Verificar status de execução
     */
    async getExecutionStatus(req, res) {
        try {
            const executionId = parseInt(req.params.id);
            
            if (isNaN(executionId)) {
                return res.status(400).json({
                    error: 'ID de execução inválido',
                    message: 'O ID deve ser um número inteiro'
                });
            }
            
            const execution = this.executionManager.getExecution(executionId);
            
            if (!execution) {
                return res.status(404).json({
                    error: 'Execução não encontrada',
                    executionId: executionId,
                    message: 'Verifique se o ID está correto'
                });
            }
            
            this.logger.debug('Status de execução consultado', {
                requestId: req.id,
                executionId: executionId,
                status: execution.status
            });
            
            res.json(execution);
            
        } catch (error) {
            this.errorHandler.handle(error, 'execution-controller-status');
            res.status(500).json({
                error: 'Erro interno do servidor',
                message: error.message
            });
        }
    }
    
    /**
     * GET /executions - Listar todas as execuções
     */
    async listExecutions(req, res) {
        try {
            const executions = this.executionManager.listExecutions();
            
            // Aplicar filtros se fornecidos
            const { status, limit = 50, offset = 0 } = req.query;
            
            let filteredExecutions = executions;
            
            if (status) {
                filteredExecutions = executions.filter(exec => exec.status === status);
            }
            
            // Paginação
            const startIndex = parseInt(offset);
            const endIndex = startIndex + parseInt(limit);
            const paginatedExecutions = filteredExecutions.slice(startIndex, endIndex);
            
            const response = {
                total: filteredExecutions.length,
                offset: startIndex,
                limit: parseInt(limit),
                executions: paginatedExecutions,
                filters: {
                    status: status || 'all'
                },
                availableStatuses: ['iniciando', 'executando', 'concluido', 'falhou', 'erro', 'cancelado']
            };
            
            this.logger.debug('Lista de execuções consultada', {
                requestId: req.id,
                total: response.total,
                filtered: filteredExecutions.length,
                returned: paginatedExecutions.length
            });
            
            res.json(response);
            
        } catch (error) {
            this.errorHandler.handle(error, 'execution-controller-list');
            res.status(500).json({
                error: 'Erro interno do servidor',
                message: error.message
            });
        }
    }
    
    /**
     * DELETE /executions/:id - Cancelar execução
     */
    async cancelExecution(req, res) {
        try {
            const executionId = parseInt(req.params.id);
            
            if (isNaN(executionId)) {
                return res.status(400).json({
                    error: 'ID de execução inválido',
                    message: 'O ID deve ser um número inteiro'
                });
            }
            
            const execution = this.executionManager.getExecution(executionId);
            
            if (!execution) {
                return res.status(404).json({
                    error: 'Execução não encontrada',
                    executionId: executionId
                });
            }
            
            if (!['iniciando', 'executando'].includes(execution.status)) {
                return res.status(400).json({
                    error: 'Execução não pode ser cancelada',
                    message: `Execução está no status: ${execution.status}`,
                    currentStatus: execution.status
                });
            }
            
            const cancelled = await this.executionManager.cancelExecution(executionId);
            
            if (cancelled) {
                this.logger.info('Execução cancelada', {
                    requestId: req.id,
                    executionId: executionId
                });
                
                res.json({
                    message: 'Execução cancelada com sucesso',
                    executionId: executionId,
                    previousStatus: execution.status,
                    newStatus: 'cancelado'
                });
            } else {
                res.status(400).json({
                    error: 'Não foi possível cancelar a execução',
                    executionId: executionId
                });
            }
            
        } catch (error) {
            this.errorHandler.handle(error, 'execution-controller-cancel');
            res.status(500).json({
                error: 'Erro interno do servidor',
                message: error.message
            });
        }
    }
    
    /**
     * POST /executions/:id/retry - Tentar execução novamente
     */
    async retryExecution(req, res) {
        try {
            const executionId = parseInt(req.params.id);
            
            if (isNaN(executionId)) {
                return res.status(400).json({
                    error: 'ID de execução inválido',
                    message: 'O ID deve ser um número inteiro'
                });
            }
            
            const execution = this.executionManager.getExecution(executionId);
            
            if (!execution) {
                return res.status(404).json({
                    error: 'Execução não encontrada',
                    executionId: executionId
                });
            }
            
            if (!['falhou', 'erro', 'cancelado'].includes(execution.status)) {
                return res.status(400).json({
                    error: 'Execução não pode ser repetida',
                    message: `Execução está no status: ${execution.status}`,
                    currentStatus: execution.status
                });
            }
            
            // Criar nova execução com os mesmos parâmetros
            const originalParams = {
                cnpj: execution.params.cnpj.replace(/\*/g, ''), // Tentar remover máscara
                senha: '****', // Senha não é armazenada
                startDate: execution.params.startDate,
                endDate: execution.params.endDate,
                headless: execution.params.headless,
                maxRetries: execution.params.maxRetries
            };
            
            // Como não temos a senha original, solicitar nova execução
            res.status(400).json({
                error: 'Retry não implementado',
                message: 'Para repetir a execução, faça uma nova requisição POST /download com todos os parâmetros',
                originalParams: {
                    startDate: execution.params.startDate,
                    endDate: execution.params.endDate,
                    headless: execution.params.headless,
                    maxRetries: execution.params.maxRetries
                },
                note: 'CNPJ e senha devem ser fornecidos novamente por segurança'
            });
            
        } catch (error) {
            this.errorHandler.handle(error, 'execution-controller-retry');
            res.status(500).json({
                error: 'Erro interno do servidor',
                message: error.message
            });
        }
    }
    
    /**
     * GET /stats - Obter estatísticas gerais
     */
    async getStats(req, res) {
        try {
            const stats = this.executionManager.getStats();
            
            const response = {
                ...stats,
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: {
                    used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                    total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
                }
            };
            
            this.logger.debug('Estatísticas consultadas', {
                requestId: req.id,
                stats: stats
            });
            
            res.json(response);
            
        } catch (error) {
            this.errorHandler.handle(error, 'execution-controller-stats');
            res.status(500).json({
                error: 'Erro interno do servidor',
                message: error.message
            });
        }
    }
}
