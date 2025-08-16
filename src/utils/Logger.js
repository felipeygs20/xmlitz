/**
 * Sistema de Logging Estruturado
 * Implementa logging profissional com diferentes níveis e formatação
 */

import fs from 'fs-extra';
import path from 'path';

export class Logger {
    static instance = null;
    
    constructor() {
        this.levels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3,
            TRACE: 4
        };

        this.currentLevel = this.levels.INFO;
        this.logDir = path.join(process.cwd(), 'logs');
        this.logFile = path.join(this.logDir, `xmlitz-${this.getDateString()}.log`);

        // Métricas de performance
        this.metrics = {
            logCounts: {
                ERROR: 0,
                WARN: 0,
                INFO: 0,
                DEBUG: 0,
                TRACE: 0
            },
            performanceTimers: new Map(),
            sessionStart: Date.now(),
            lastLogTime: Date.now()
        };

        this.initializeLogDirectory();
    }
    
    /**
     * Singleton pattern
     */
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }

        // Garantir compatibilidade com instâncias existentes
        Logger.instance.ensureCompatibility();

        return Logger.instance;
    }
    
    /**
     * Inicializa o diretório de logs
     */
    async initializeLogDirectory() {
        try {
            await fs.ensureDir(this.logDir);
        } catch (error) {
            console.error('Erro ao criar diretório de logs:', error.message);
        }
    }
    
    /**
     * Define o nível de log
     */
    setLevel(level) {
        if (typeof level === 'string') {
            this.currentLevel = this.levels[level.toUpperCase()] ?? this.levels.INFO;
        } else {
            this.currentLevel = level;
        }
    }
    
    /**
     * Formata a mensagem de log
     */
    formatMessage(level, message, metadata = {}) {
        const timestamp = new Date().toISOString();
        const levelStr = Object.keys(this.levels)[level].padEnd(5);
        
        let formattedMessage = `[${timestamp}] ${levelStr} ${message}`;
        
        if (Object.keys(metadata).length > 0) {
            formattedMessage += ` | ${JSON.stringify(metadata)}`;
        }
        
        return formattedMessage;
    }
    
    /**
     * Escreve log no arquivo
     */
    async writeToFile(formattedMessage) {
        try {
            await fs.appendFile(this.logFile, formattedMessage + '\n', { encoding: 'utf8' });
        } catch (error) {
            console.error('Erro ao escrever no arquivo de log:', error.message);
        }
    }
    
    /**
     * Log de erro
     */
    error(message, metadata = {}) {
        if (this.currentLevel >= this.levels.ERROR) {
            this.incrementMetrics('ERROR');
            const formatted = this.formatMessage(this.levels.ERROR, message, metadata);
            console.error(`[ERROR] ${message}`, metadata);
            this.writeToFile(formatted);
        }
    }

    /**
     * Log de aviso
     */
    warn(message, metadata = {}) {
        if (this.currentLevel >= this.levels.WARN) {
            this.incrementMetrics('WARN');
            const formatted = this.formatMessage(this.levels.WARN, message, metadata);
            console.warn(`[WARN] ${message}`, metadata);
            this.writeToFile(formatted);
        }
    }

    /**
     * Log de informação
     */
    info(message, metadata = {}) {
        if (this.currentLevel >= this.levels.INFO) {
            this.incrementMetrics('INFO');
            const formatted = this.formatMessage(this.levels.INFO, message, metadata);
            console.log(`[INFO] ${message}`, metadata);
            this.writeToFile(formatted);
        }
    }

    /**
     * Log de debug
     */
    debug(message, metadata = {}) {
        if (this.currentLevel >= this.levels.DEBUG) {
            this.incrementMetrics('DEBUG');
            const formatted = this.formatMessage(this.levels.DEBUG, message, metadata);
            console.log(`[DEBUG] ${message}`, metadata);
            this.writeToFile(formatted);
        }
    }

    /**
     * Log de sucesso
     */
    success(message, metadata = {}) {
        const formatted = this.formatMessage(this.levels.INFO, `SUCCESS: ${message}`, metadata);
        console.log(`[SUCCESS] ${message}`, metadata);
        this.writeToFile(formatted);
    }

    /**
     * Log de progresso
     */
    progress(message, metadata = {}) {
        const formatted = this.formatMessage(this.levels.INFO, `PROGRESS: ${message}`, metadata);
        console.log(`[PROGRESS] ${message}`, metadata);
        this.writeToFile(formatted);
    }
    
    /**
     * Obtém string de data para nome do arquivo
     */
    getDateString() {
        const now = new Date();
        return now.toISOString().split('T')[0];
    }
    
    /**
     * Limpa logs antigos (mantém apenas os últimos 7 dias)
     */
    async cleanOldLogs() {
        try {
            const files = await fs.readdir(this.logDir);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 7);
            
            for (const file of files) {
                if (file.startsWith('xmlitz-') && file.endsWith('.log')) {
                    const filePath = path.join(this.logDir, file);
                    const stats = await fs.stat(filePath);
                    
                    if (stats.mtime < cutoffDate) {
                        await fs.remove(filePath);
                        this.info(`Log antigo removido: ${file}`);
                    }
                }
            }
        } catch (error) {
            this.error('Erro ao limpar logs antigos', { error: error.message });
        }
    }

    /**
     * Inicia um timer de performance
     */
    startTimer(name) {
        // Verificar se metrics existe (compatibilidade)
        if (!this.metrics) {
            this.metrics = {
                performanceTimers: new Map(),
                logCounts: { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0, TRACE: 0 },
                sessionStart: Date.now(),
                lastLogTime: Date.now()
            };
        }

        this.metrics.performanceTimers.set(name, {
            start: Date.now(),
            name: name
        });

        // Usar debug se trace não existir
        if (this.trace) {
            this.trace(`Timer iniciado: ${name}`);
        } else {
            this.debug(`Timer iniciado: ${name}`);
        }
    }

    /**
     * Para um timer e registra o tempo decorrido
     */
    endTimer(name, context = {}) {
        // Verificar se metrics existe (compatibilidade)
        if (!this.metrics || !this.metrics.performanceTimers) {
            this.warn(`Timer não pode ser finalizado - metrics não inicializado: ${name}`);
            return 0;
        }

        const timer = this.metrics.performanceTimers.get(name);
        if (!timer) {
            this.warn(`Timer não encontrado: ${name}`);
            return 0;
        }

        const duration = Date.now() - timer.start;
        this.metrics.performanceTimers.delete(name);

        this.info(`⏱️ Performance: ${name}`, {
            duration: `${duration}ms`,
            ...context
        });

        return duration;
    }

    /**
     * Registra métricas de performance
     */
    performance(operation, duration, context = {}) {
        this.info(`⚡ Performance: ${operation}`, {
            duration: typeof duration === 'number' ? `${duration}ms` : duration,
            ...context
        });
    }

    /**
     * Log de trace (mais detalhado que debug)
     */
    trace(message, metadata = {}) {
        if (this.currentLevel >= this.levels.TRACE) {
            this.incrementMetrics('TRACE');
            const formatted = this.formatMessage(this.levels.TRACE, message, metadata);
            console.log(`[TRACE] ${message}`, metadata);
            this.writeToFile(formatted);
        }
    }

    /**
     * Log de sistema (sempre visível)
     */
    system(message, context = {}) {
        this.info(`[SYS] ${message}`, context);
    }

    /**
     * Log de sucesso
     */
    success(message, context = {}) {
        this.info(`✅ ${message}`, context);
    }

    /**
     * Obtém estatísticas do logger
     */
    getStats() {
        const sessionDuration = Date.now() - this.metrics.sessionStart;
        const totalLogs = Object.values(this.metrics.logCounts).reduce((sum, count) => sum + count, 0);

        return {
            sessionDuration: Math.round(sessionDuration / 1000), // em segundos
            totalLogs,
            logCounts: { ...this.metrics.logCounts },
            logsPerSecond: totalLogs > 0 ? (totalLogs / (sessionDuration / 1000)).toFixed(2) : 0,
            activeTimers: this.metrics.performanceTimers.size,
            currentLevel: Object.keys(this.levels).find(key => this.levels[key] === this.currentLevel)
        };
    }

    /**
     * Log de métricas do sistema
     */
    logMetrics() {
        const stats = this.getStats();
        this.info('📊 Métricas do Logger', stats);
    }

    /**
     * Método interno para incrementar métricas
     */
    incrementMetrics(level) {
        if (!this.metrics) {
            this.metrics = {
                logCounts: { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0, TRACE: 0 },
                performanceTimers: new Map(),
                sessionStart: Date.now(),
                lastLogTime: Date.now()
            };
        }

        if (this.metrics.logCounts[level] !== undefined) {
            this.metrics.logCounts[level]++;
        }
        this.metrics.lastLogTime = Date.now();
    }

    /**
     * Métodos de fallback para compatibilidade
     */
    ensureCompatibility() {
        // Adicionar métodos que podem estar faltando em instâncias antigas
        if (!this.startTimer) {
            this.startTimer = function(name) {
                this.debug(`Timer iniciado: ${name}`);
            };
        }

        if (!this.endTimer) {
            this.endTimer = function(name) {
                this.debug(`Timer finalizado: ${name}`);
                return 0;
            };
        }

        if (!this.performance) {
            this.performance = function(operation, duration, context = {}) {
                this.info(`Performance: ${operation} - ${duration}`, context);
            };
        }

        if (!this.trace) {
            this.trace = function(message, metadata = {}) {
                this.debug(message, metadata);
            };
        }

        if (!this.system) {
            this.system = function(message, context = {}) {
                this.info(`[SYS] ${message}`, context);
            };
        }

        if (!this.success) {
            this.success = function(message, context = {}) {
                this.info(`✅ ${message}`, context);
            };
        }
    }
}
