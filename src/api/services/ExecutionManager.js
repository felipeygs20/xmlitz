/**
 * Gerenciador de Execuções
 * Responsável por gerenciar execuções de download em background
 */

import { XMLITZOrchestrator } from '../../core/XMLITZOrchestrator.js';
import { logger } from '../../utils/OptimizedLogger.js';
import { ErrorHandler } from '../../utils/ErrorHandler.js';

export class ExecutionManager {
    constructor(config) {
        this.config = config;
        this.logger = logger;
        this.errorHandler = ErrorHandler.getInstance();
        
        this.executions = new Map();
        this.executionCounter = 0;
        this.maxConcurrentExecutions = 50; // Aumentado para permitir mais execuções concorrentes
        this.runningExecutions = 0;
    }
    
    /**
     * Inicia uma nova execução
     */
    async startExecution(params) {
        try {
            const executionId = ++this.executionCounter;
            
            // Verificar limite de execuções concorrentes
            if (this.runningExecutions >= this.maxConcurrentExecutions) {
                throw new Error(`Limite de execuções concorrentes atingido (${this.maxConcurrentExecutions})`);
            }
            
            // Criar registro de execução
            const execution = {
                id: executionId,
                status: 'iniciando',
                params: this.sanitizeParams(params),
                startTime: new Date().toISOString(),
                endTime: null,
                duration: null,
                logs: [],
                results: null,
                error: null,
                progress: {
                    currentPage: 0,
                    totalPages: 0,
                    notesFound: 0,
                    xmlsDownloaded: 0,
                    failures: 0
                }
            };
            
            this.executions.set(executionId, execution);
            
            this.logger.info('Nova execução iniciada', {
                executionId: executionId,
                params: execution.params
            });
            
            // Executar em background
            this.executeInBackground(executionId, params);
            
            return executionId;
            
        } catch (error) {
            this.errorHandler.handle(error, 'execution-manager-start');
            throw error;
        }
    }
    
    /**
     * Executa download em background
     */
    async executeInBackground(executionId, params) {
        const execution = this.executions.get(executionId);
        
        try {
            this.runningExecutions++;
            execution.status = 'executando';
            this.addLog(executionId, 'Execução iniciada');
            
            // Criar configuração personalizada para esta execução
            const customConfig = this.createCustomConfig(params);
            
            // Criar e executar orchestrator
            const orchestrator = new XMLITZOrchestrator(customConfig);
            
            // Configurar callback de progresso
            this.setupProgressTracking(executionId, orchestrator);
            
            const startTime = Date.now();
            const report = await orchestrator.execute();
            const endTime = Date.now();
            
            // Atualizar execução com resultados
            execution.status = report.success ? 'concluido' : 'falhou';
            execution.endTime = new Date().toISOString();
            execution.duration = Math.round((endTime - startTime) / 1000);
            execution.results = {
                success: report.success,
                pagesProcessed: report.pagesProcessed || 0,
                notesFound: report.notesFound || 0,
                xmlsDownloaded: report.xmlsDownloaded || 0,
                failures: report.failures || 0,
                successRate: report.successRate || 0,
                downloadPath: report.downloadPath
            };
            
            this.addLog(executionId, `Execução ${report.success ? 'concluída' : 'falhou'}`);
            
            this.logger.info('Execução finalizada', {
                executionId: executionId,
                status: execution.status,
                duration: execution.duration,
                results: execution.results
            });
            
        } catch (error) {
            execution.status = 'erro';
            execution.endTime = new Date().toISOString();
            execution.error = error.message;
            
            this.addLog(executionId, `Erro: ${error.message}`);
            
            this.errorHandler.handle(error, 'execution-background');
            
            this.logger.error('Execução falhou', {
                executionId: executionId,
                error: error.message
            });
            
        } finally {
            this.runningExecutions--;
        }
    }
    
    /**
     * Cria configuração personalizada para execução
     */
    createCustomConfig(params) {
        // Clonar configuração base
        const baseConfig = this.config.getAll();
        
        // Aplicar parâmetros personalizados
        const customConfig = {
            ...baseConfig,
            credentials: {
                username: params.cnpj || baseConfig.credentials.username,
                password: params.senha || baseConfig.credentials.password
            },
            searchPeriod: {
                startDate: params.startDate || baseConfig.searchPeriod.startDate,
                endDate: params.endDate || baseConfig.searchPeriod.endDate
            }
        };
        
        // Aplicar configurações opcionais
        if (params.headless !== undefined) {
            customConfig.browser.headless = params.headless;
        }
        
        if (params.maxRetries !== undefined) {
            customConfig.advanced.maxRetries = params.maxRetries;
        }
        
        // Criar mock do ConfigManager para esta execução
        return {
            get: (path, defaultValue) => {
                return this.getNestedValue(customConfig, path) ?? defaultValue;
            },
            getAll: () => customConfig,
            getEnvironment: () => this.config.getEnvironment()
        };
    }
    
    /**
     * Configura tracking de progresso
     */
    setupProgressTracking(executionId, orchestrator) {
        // Por enquanto, apenas atualizar stats básicas
        // No futuro, pode implementar callbacks mais detalhados
        const execution = this.executions.get(executionId);
        
        // Simular atualizações de progresso
        const progressInterval = setInterval(() => {
            if (execution.status === 'executando') {
                const stats = orchestrator.getStats();
                if (stats) {
                    execution.progress = {
                        currentPage: stats.pagesProcessed || 0,
                        totalPages: 0, // Não sabemos o total antecipadamente
                        notesFound: stats.notesFound || 0,
                        xmlsDownloaded: stats.xmlsDownloaded || 0,
                        failures: stats.failures || 0
                    };
                }
            } else {
                clearInterval(progressInterval);
            }
        }, 5000); // Atualizar a cada 5 segundos
    }
    
    /**
     * Obtém status de uma execução
     */
    getExecution(executionId) {
        return this.executions.get(executionId);
    }
    
    /**
     * Lista todas as execuções
     */
    listExecutions() {
        return Array.from(this.executions.values()).map(exec => ({
            id: exec.id,
            status: exec.status,
            params: exec.params,
            startTime: exec.startTime,
            endTime: exec.endTime,
            duration: exec.duration,
            progress: exec.progress,
            results: exec.results ? {
                success: exec.results.success,
                pagesProcessed: exec.results.pagesProcessed,
                notesFound: exec.results.notesFound,
                xmlsDownloaded: exec.results.xmlsDownloaded,
                failures: exec.results.failures,
                successRate: exec.results.successRate
            } : null
        }));
    }
    
    /**
     * Cancela uma execução
     */
    async cancelExecution(executionId) {
        const execution = this.executions.get(executionId);
        
        if (!execution) {
            throw new Error('Execução não encontrada');
        }
        
        if (execution.status === 'executando') {
            execution.status = 'cancelado';
            execution.endTime = new Date().toISOString();
            this.addLog(executionId, 'Execução cancelada pelo usuário');
            
            this.logger.info('Execução cancelada', { executionId: executionId });
            
            return true;
        }
        
        return false;
    }
    
    /**
     * Obtém estatísticas gerais
     */
    getStats() {
        const executions = Array.from(this.executions.values());
        
        return {
            total: executions.length,
            running: this.runningExecutions,
            completed: executions.filter(e => e.status === 'concluido').length,
            failed: executions.filter(e => e.status === 'falhou' || e.status === 'erro').length,
            cancelled: executions.filter(e => e.status === 'cancelado').length,
            maxConcurrent: this.maxConcurrentExecutions,
            totalXmlsDownloaded: executions.reduce((sum, e) => 
                sum + (e.results?.xmlsDownloaded || 0), 0),
            averageDuration: this.calculateAverageDuration(executions)
        };
    }
    
    /**
     * Adiciona log a uma execução
     */
    addLog(executionId, message) {
        const execution = this.executions.get(executionId);
        if (execution) {
            execution.logs.push({
                timestamp: new Date().toISOString(),
                message: message
            });
            
            // Manter apenas os últimos 50 logs
            if (execution.logs.length > 50) {
                execution.logs = execution.logs.slice(-50);
            }
        }
    }
    
    /**
     * Sanitiza parâmetros para log
     */
    sanitizeParams(params) {
        return {
            cnpj: this.maskCNPJ(params.cnpj),
            startDate: params.startDate,
            endDate: params.endDate,
            headless: params.headless,
            maxRetries: params.maxRetries
        };
    }
    
    /**
     * Mascara CNPJ para log
     */
    maskCNPJ(cnpj) {
        if (!cnpj || cnpj.length < 8) return cnpj;
        return cnpj.substring(0, 4) + '****' + cnpj.substring(cnpj.length - 4);
    }
    
    /**
     * Calcula duração média das execuções
     */
    calculateAverageDuration(executions) {
        const completed = executions.filter(e => e.duration !== null);
        if (completed.length === 0) return 0;
        
        const totalDuration = completed.reduce((sum, e) => sum + e.duration, 0);
        return Math.round(totalDuration / completed.length);
    }
    
    /**
     * Obtém valor aninhado de objeto
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    
    /**
     * Shutdown graceful
     */
    async shutdown() {
        this.logger.info('Iniciando shutdown do ExecutionManager');
        
        // Aguardar execuções em andamento terminarem (máximo 30 segundos)
        const maxWait = 30000;
        const startTime = Date.now();
        
        while (this.runningExecutions > 0 && (Date.now() - startTime) < maxWait) {
            this.logger.info(`Aguardando ${this.runningExecutions} execuções terminarem`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        if (this.runningExecutions > 0) {
            this.logger.warn(`Forçando shutdown com ${this.runningExecutions} execuções ainda rodando`);
        }
        
        this.logger.info('Shutdown do ExecutionManager concluído');
    }
}
