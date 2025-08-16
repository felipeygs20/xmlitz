/**
 * Sistema Centralizado de Tratamento de Erros
 * Gerencia todos os tipos de erros do sistema de forma consistente
 */

import { logger } from './OptimizedLogger.js';

export class ErrorHandler {
    static instance = null;
    
    constructor() {
        this.logger = logger;
        this.errorCounts = new Map();
        this.maxRetries = 3;
    }
    
    /**
     * Singleton pattern
     */
    static getInstance() {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }
    
    /**
     * Trata um erro de forma centralizada
     */
    handle(error, context = 'unknown', options = {}) {
        const errorInfo = this.analyzeError(error, context);
        
        // Log do erro
        this.logger.error(`Erro em ${context}`, {
            message: error.message,
            stack: error.stack,
            type: errorInfo.type,
            severity: errorInfo.severity,
            retryable: errorInfo.retryable
        });
        
        // Incrementar contador de erros
        this.incrementErrorCount(context);
        
        // Executar ações específicas baseadas no tipo de erro
        this.executeErrorActions(errorInfo, options);
        
        return errorInfo;
    }
    
    /**
     * Analisa o erro para determinar tipo e severidade
     */
    analyzeError(error, context) {
        const errorInfo = {
            type: 'unknown',
            severity: 'medium',
            retryable: false,
            context: context,
            timestamp: new Date().toISOString()
        };
        
        // Análise baseada na mensagem do erro
        const message = error.message.toLowerCase();
        
        if (message.includes('timeout') || message.includes('navigation')) {
            errorInfo.type = 'timeout';
            errorInfo.severity = 'medium';
            errorInfo.retryable = true;
        } else if (message.includes('network') || message.includes('connection')) {
            errorInfo.type = 'network';
            errorInfo.severity = 'high';
            errorInfo.retryable = true;
        } else if (message.includes('login') || message.includes('authentication')) {
            errorInfo.type = 'authentication';
            errorInfo.severity = 'high';
            errorInfo.retryable = false;
        } else if (message.includes('element') || message.includes('selector')) {
            errorInfo.type = 'element_not_found';
            errorInfo.severity = 'medium';
            errorInfo.retryable = true;
        } else if (message.includes('download')) {
            errorInfo.type = 'download';
            errorInfo.severity = 'medium';
            errorInfo.retryable = true;
        } else if (message.includes('config') || message.includes('configuration')) {
            errorInfo.type = 'configuration';
            errorInfo.severity = 'high';
            errorInfo.retryable = false;
        } else if (error.name === 'ValidationError') {
            errorInfo.type = 'validation';
            errorInfo.severity = 'medium';
            errorInfo.retryable = false;
        }
        
        return errorInfo;
    }
    
    /**
     * Incrementa contador de erros por contexto
     */
    incrementErrorCount(context) {
        const current = this.errorCounts.get(context) || 0;
        this.errorCounts.set(context, current + 1);
    }
    
    /**
     * Obtém contador de erros para um contexto
     */
    getErrorCount(context) {
        return this.errorCounts.get(context) || 0;
    }
    
    /**
     * Executa ações específicas baseadas no tipo de erro
     */
    executeErrorActions(errorInfo, options) {
        switch (errorInfo.type) {
            case 'timeout':
                this.handleTimeoutError(errorInfo, options);
                break;
            case 'network':
                this.handleNetworkError(errorInfo, options);
                break;
            case 'authentication':
                this.handleAuthenticationError(errorInfo, options);
                break;
            case 'element_not_found':
                this.handleElementError(errorInfo, options);
                break;
            case 'download':
                this.handleDownloadError(errorInfo, options);
                break;
            case 'configuration':
                this.handleConfigurationError(errorInfo, options);
                break;
            default:
                this.handleGenericError(errorInfo, options);
        }
    }
    
    /**
     * Trata erros de timeout
     */
    handleTimeoutError(errorInfo, options) {
        this.logger.warn('Timeout detectado - possível problema de performance', {
            context: errorInfo.context,
            suggestion: 'Considere aumentar os timeouts na configuração'
        });
    }
    
    /**
     * Trata erros de rede
     */
    handleNetworkError(errorInfo, options) {
        this.logger.warn('Problema de rede detectado', {
            context: errorInfo.context,
            suggestion: 'Verifique a conexão com a internet'
        });
    }
    
    /**
     * Trata erros de autenticação
     */
    handleAuthenticationError(errorInfo, options) {
        this.logger.error('Falha na autenticação', {
            context: errorInfo.context,
            suggestion: 'Verifique as credenciais na configuração'
        });
    }
    
    /**
     * Trata erros de elemento não encontrado
     */
    handleElementError(errorInfo, options) {
        this.logger.warn('Elemento não encontrado na página', {
            context: errorInfo.context,
            suggestion: 'Possível mudança na estrutura do site'
        });
    }
    
    /**
     * Trata erros de download
     */
    handleDownloadError(errorInfo, options) {
        this.logger.warn('Falha no download', {
            context: errorInfo.context,
            suggestion: 'Tentativa de retry será executada'
        });
    }
    
    /**
     * Trata erros de configuração
     */
    handleConfigurationError(errorInfo, options) {
        this.logger.error('Erro de configuração', {
            context: errorInfo.context,
            suggestion: 'Verifique o arquivo de configuração'
        });
    }
    
    /**
     * Trata erros genéricos
     */
    handleGenericError(errorInfo, options) {
        this.logger.error('Erro não categorizado', {
            context: errorInfo.context,
            suggestion: 'Verifique os logs para mais detalhes'
        });
    }
    
    /**
     * Verifica se um erro é retryable
     */
    isRetryable(error, context) {
        const errorInfo = this.analyzeError(error, context);
        const errorCount = this.getErrorCount(context);
        
        return errorInfo.retryable && errorCount < this.maxRetries;
    }
    
    /**
     * Reseta contadores de erro
     */
    resetErrorCounts() {
        this.errorCounts.clear();
    }
    
    /**
     * Obtém estatísticas de erros
     */
    getErrorStats() {
        const stats = {};
        for (const [context, count] of this.errorCounts.entries()) {
            stats[context] = count;
        }
        return stats;
    }
}
