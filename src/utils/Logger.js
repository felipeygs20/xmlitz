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
            DEBUG: 3
        };
        
        this.currentLevel = this.levels.INFO;
        this.logDir = path.join(process.cwd(), 'logs');
        this.logFile = path.join(this.logDir, `xmlitz-${this.getDateString()}.log`);
        
        this.initializeLogDirectory();
    }
    
    /**
     * Singleton pattern
     */
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
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
}
