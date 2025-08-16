/**
 * Sistema de Logging Otimizado - VERSÃO 2.0
 * Logs menos verbosos, mais eficientes e organizados
 */

import fs from 'fs-extra';
import path from 'path';

export class OptimizedLogger {
    static instance = null;
    
    constructor() {
        this.levels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3,
            TRACE: 4
        };
        
        // Contextos para organizar logs
        this.contexts = {
            SYS: 'SYSTEM',
            AUTH: 'AUTH',
            NAV: 'NAVIGATION', 
            SEARCH: 'SEARCH',
            DL: 'DOWNLOAD',
            FILE: 'FILE',
            API: 'API',
            DUP: 'DUPLICATE'
        };
        
        this.currentLevel = this.levels.INFO;
        this.logDir = path.join(process.cwd(), 'logs');
        this.logFile = path.join(this.logDir, `xmlitz-${this.getDateString()}.log`);
        
        // Configurações de otimização
        this.config = {
            maxLogLength: 200,           // Máximo de caracteres por log
            enableEmojis: true,          // Usar emojis para identificação rápida
            enableColors: true,          // Cores no console
            enableTimestamps: true,      // Timestamps nos logs
            enableContext: true,         // Contexto nos logs
            enableFileLogging: true,     // Salvar em arquivo
            enableConsoleLogging: true,  // Mostrar no console
            compactMode: true,           // Modo compacto (menos verboso)
            enableRequestLogs: false,    // Logs de requisições HTTP (desabilitado por padrão)
            enableDebugLogs: false       // Logs de debug (desabilitado por padrão)
        };

        // Timers de performance
        this.performanceTimers = new Map();
        
        this.initializeLogDirectory();
    }
    
    /**
     * Singleton pattern
     */
    static getInstance() {
        if (!OptimizedLogger.instance) {
            OptimizedLogger.instance = new OptimizedLogger();
        }
        return OptimizedLogger.instance;
    }
    
    /**
     * Inicializa o diretório de logs
     */
    async initializeLogDirectory() {
        try {
            await fs.ensureDir(this.logDir);
        } catch (error) {
            console.error('❌ Erro ao criar diretório de logs:', error.message);
        }
    }
    
    /**
     * Configura o logger
     */
    configure(options = {}) {
        this.config = { ...this.config, ...options };
        
        // Ajustar nível baseado no modo
        if (this.config.compactMode) {
            this.currentLevel = this.levels.INFO;
        }
        
        if (this.config.enableDebugLogs) {
            this.currentLevel = this.levels.DEBUG;
        }
    }
    
    /**
     * Log de sistema (inicialização, configuração)
     */
    system(message, data = {}) {
        this.log('INFO', 'SYS', `🚀 ${message}`, data);
    }
    
    /**
     * Log de autenticação
     */
    auth(message, data = {}) {
        this.log('INFO', 'AUTH', `🔐 ${message}`, data);
    }
    
    /**
     * Log de navegação
     */
    nav(message, data = {}) {
        this.log('INFO', 'NAV', `🧭 ${message}`, data);
    }
    
    /**
     * Log de busca
     */
    search(message, data = {}) {
        this.log('INFO', 'SEARCH', `🔍 ${message}`, data);
    }
    
    /**
     * Log de download
     */
    download(message, data = {}) {
        this.log('INFO', 'DL', `📥 ${message}`, data);
    }
    
    /**
     * Log de arquivos
     */
    file(message, data = {}) {
        if (!this.config.compactMode) {
            this.log('DEBUG', 'FILE', `📁 ${message}`, data);
        }
    }
    
    /**
     * Log de duplicatas (simplificado)
     */
    duplicate(message, data = {}) {
        if (data.isDuplicate || data.skipped) {
            this.log('INFO', 'DUP', `🔄 ${message}`, { count: data.count || 1 });
        }
    }
    
    /**
     * Log de progresso
     */
    progress(message, data = {}) {
        this.log('INFO', 'SYS', `📊 ${message}`, data);
    }
    
    /**
     * Log de sucesso
     */
    success(message, data = {}) {
        this.log('INFO', 'SYS', `✅ ${message}`, data);
    }
    
    /**
     * Log de erro
     */
    error(message, data = {}) {
        this.log('ERROR', 'SYS', `❌ ${message}`, data);
    }
    
    /**
     * Log de aviso
     */
    warn(message, data = {}) {
        this.log('WARN', 'SYS', `⚠️ ${message}`, data);
    }
    
    /**
     * Log de debug (apenas se habilitado)
     */
    debug(message, data = {}) {
        if (this.config.enableDebugLogs) {
            this.log('DEBUG', 'SYS', `🔧 ${message}`, data);
        }
    }

    /**
     * Métodos de compatibilidade com logger antigo
     */
    info(message, data = {}) {
        this.log('INFO', 'SYS', message, data);
    }
    
    /**
     * Log de requisições HTTP (apenas se habilitado)
     */
    request(message, data = {}) {
        if (this.config.enableRequestLogs) {
            this.log('DEBUG', 'API', `🌐 ${message}`, data);
        }
    }
    
    /**
     * Método principal de log otimizado
     */
    log(level, context, message, data = {}) {
        const levelNum = this.levels[level];
        
        if (levelNum > this.currentLevel) {
            return;
        }
        
        // Criar log compacto
        const logEntry = this.createOptimizedLogEntry(level, context, message, data);
        
        // Output para console
        if (this.config.enableConsoleLogging) {
            this.outputToConsole(level, logEntry);
        }
        
        // Output para arquivo
        if (this.config.enableFileLogging) {
            this.outputToFile(logEntry);
        }
    }
    
    /**
     * Cria entrada de log otimizada
     */
    createOptimizedLogEntry(level, context, message, data = {}) {
        const timestamp = this.config.enableTimestamps ? new Date().toISOString() : '';
        const ctx = this.config.enableContext ? `[${context}]` : '';
        
        // Simplificar dados
        const simplifiedData = this.simplifyData(data);
        const dataStr = Object.keys(simplifiedData).length > 0 ? 
            ` | ${JSON.stringify(simplifiedData)}` : '';
        
        // Truncar se muito longo
        let fullMessage = `${message}${dataStr}`;
        if (fullMessage.length > this.config.maxLogLength) {
            fullMessage = fullMessage.substring(0, this.config.maxLogLength - 3) + '...';
        }
        
        return {
            timestamp,
            level,
            context: ctx,
            message: fullMessage,
            raw: `[${timestamp}] ${level.padEnd(5)} ${ctx} ${fullMessage}`
        };
    }
    
    /**
     * Simplifica dados para logs menos verbosos
     */
    simplifyData(data) {
        const simplified = {};
        
        // Campos importantes para manter
        const importantFields = [
            'cnpj', 'index', 'count', 'total', 'page', 'status', 
            'duration', 'error', 'success', 'downloaded', 'skipped',
            'duplicates', 'executionId', 'statusCode'
        ];
        
        for (const field of importantFields) {
            if (data[field] !== undefined) {
                simplified[field] = data[field];
            }
        }
        
        // Mascarar CNPJ se presente
        if (simplified.cnpj && typeof simplified.cnpj === 'string') {
            simplified.cnpj = this.maskCNPJ(simplified.cnpj);
        }
        
        return simplified;
    }
    
    /**
     * Mascara CNPJ para logs
     */
    maskCNPJ(cnpj) {
        if (!cnpj || cnpj.length < 8) return cnpj;
        return cnpj.substring(0, 4) + '****' + cnpj.substring(cnpj.length - 4);
    }
    
    /**
     * Output para console com cores
     */
    outputToConsole(level, logEntry) {
        const colors = {
            ERROR: '\x1b[31m',   // Vermelho
            WARN: '\x1b[33m',    // Amarelo
            INFO: '\x1b[36m',    // Ciano
            DEBUG: '\x1b[37m',   // Branco
            TRACE: '\x1b[90m'    // Cinza
        };
        
        const reset = '\x1b[0m';
        const color = this.config.enableColors ? colors[level] || '' : '';
        
        console.log(`${color}${logEntry.raw}${reset}`);
    }
    
    /**
     * Output para arquivo
     */
    async outputToFile(logEntry) {
        try {
            await fs.appendFile(this.logFile, logEntry.raw + '\n');
        } catch (error) {
            console.error('❌ Erro ao escrever log:', error.message);
        }
    }
    
    /**
     * Utilitários
     */
    getDateString() {
        return new Date().toISOString().split('T')[0];
    }
    
    /**
     * Limpar logs antigos
     */
    async cleanOldLogs(daysToKeep = 7) {
        try {
            const files = await fs.readdir(this.logDir);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            for (const file of files) {
                if (file.startsWith('xmlitz-') && file.endsWith('.log')) {
                    const filePath = path.join(this.logDir, file);
                    const stats = await fs.stat(filePath);

                    if (stats.mtime < cutoffDate) {
                        await fs.remove(filePath);
                        console.log(`🗑️ Log antigo removido: ${file}`);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Erro ao limpar logs antigos:', error.message);
        }
    }

    /**
     * Inicia um timer de performance
     */
    startTimer(name) {
        this.performanceTimers.set(name, {
            start: Date.now(),
            name: name
        });

        if (this.config.enableDebugLogs) {
            this.debug(`⏱️ Timer iniciado: ${name}`);
        }
    }

    /**
     * Para um timer e registra o tempo decorrido
     */
    endTimer(name, context = {}) {
        const timer = this.performanceTimers.get(name);
        if (!timer) {
            this.warn(`Timer não encontrado: ${name}`);
            return 0;
        }

        const duration = Date.now() - timer.start;
        this.performanceTimers.delete(name);

        this.performance(name, duration, context);

        return duration;
    }

    /**
     * Registra métricas de performance
     */
    performance(operation, duration, context = {}) {
        const durationStr = typeof duration === 'number' ? `${duration}ms` : duration;
        this.log('INFO', 'SYS', `⚡ Performance: ${operation}`, {
            duration: durationStr,
            ...context
        });
    }
}

// Criar instância global
export const logger = OptimizedLogger.getInstance();
