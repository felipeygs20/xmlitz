/**
 * Gerenciador de Cache Inteligente
 * Otimiza verificações de duplicatas e operações repetitivas
 */

import { logger } from '../utils/OptimizedLogger.js';

export class CacheManager {
    constructor() {
        this.logger = logger;
        
        // Cache de arquivos existentes por CNPJ
        this.fileCache = new Map();
        
        // Cache de hashes MD5 para verificação rápida de duplicatas
        this.hashCache = new Map();
        
        // Cache de dados XML extraídos
        this.xmlDataCache = new Map();
        
        // Cache de verificações de duplicatas
        this.duplicateCache = new Map();
        
        // Configurações de cache
        this.config = {
            fileCache: {
                ttl: 30000, // 30 segundos
                maxSize: 100
            },
            hashCache: {
                ttl: 300000, // 5 minutos
                maxSize: 1000
            },
            xmlDataCache: {
                ttl: 600000, // 10 minutos
                maxSize: 500
            },
            duplicateCache: {
                ttl: 60000, // 1 minuto
                maxSize: 200
            }
        };
        
        // Inicializar limpeza automática
        this.setupAutoCleanup();
    }
    
    /**
     * Cache de arquivos existentes por CNPJ
     */
    setFileCache(cnpj, startDate, files) {
        const key = `${cnpj}-${startDate}`;
        const entry = {
            data: files,
            timestamp: Date.now(),
            hits: 0
        };
        
        this.fileCache.set(key, entry);
        this.enforceMaxSize(this.fileCache, this.config.fileCache.maxSize);
        
        this.logger.debug('Cache de arquivos atualizado', {
            cnpj: this.maskCNPJ(cnpj),
            fileCount: files.length,
            cacheSize: this.fileCache.size
        });
    }
    
    getFileCache(cnpj, startDate) {
        const key = `${cnpj}-${startDate}`;
        const entry = this.fileCache.get(key);
        
        if (!entry) return null;
        
        // Verificar TTL
        if (Date.now() - entry.timestamp > this.config.fileCache.ttl) {
            this.fileCache.delete(key);
            return null;
        }
        
        entry.hits++;
        this.logger.debug('Cache de arquivos utilizado', {
            cnpj: this.maskCNPJ(cnpj),
            hits: entry.hits,
            age: Math.round((Date.now() - entry.timestamp) / 1000)
        });
        
        return entry.data;
    }
    
    /**
     * Cache de hashes MD5
     */
    setHashCache(filePath, hash) {
        const entry = {
            data: hash,
            timestamp: Date.now(),
            hits: 0
        };
        
        this.hashCache.set(filePath, entry);
        this.enforceMaxSize(this.hashCache, this.config.hashCache.maxSize);
    }
    
    getHashCache(filePath) {
        const entry = this.hashCache.get(filePath);
        
        if (!entry) return null;
        
        // Verificar TTL
        if (Date.now() - entry.timestamp > this.config.hashCache.ttl) {
            this.hashCache.delete(filePath);
            return null;
        }
        
        entry.hits++;
        return entry.data;
    }
    
    /**
     * Cache de dados XML extraídos
     */
    setXMLDataCache(filePath, xmlData) {
        const entry = {
            data: xmlData,
            timestamp: Date.now(),
            hits: 0
        };
        
        this.xmlDataCache.set(filePath, entry);
        this.enforceMaxSize(this.xmlDataCache, this.config.xmlDataCache.maxSize);
    }
    
    getXMLDataCache(filePath) {
        const entry = this.xmlDataCache.get(filePath);
        
        if (!entry) return null;
        
        // Verificar TTL
        if (Date.now() - entry.timestamp > this.config.xmlDataCache.ttl) {
            this.xmlDataCache.delete(filePath);
            return null;
        }
        
        entry.hits++;
        return entry.data;
    }
    
    /**
     * Cache de verificações de duplicatas
     */
    setDuplicateCache(key, result) {
        const entry = {
            data: result,
            timestamp: Date.now(),
            hits: 0
        };
        
        this.duplicateCache.set(key, entry);
        this.enforceMaxSize(this.duplicateCache, this.config.duplicateCache.maxSize);
    }
    
    getDuplicateCache(key) {
        const entry = this.duplicateCache.get(key);
        
        if (!entry) return null;
        
        // Verificar TTL
        if (Date.now() - entry.timestamp > this.config.duplicateCache.ttl) {
            this.duplicateCache.delete(key);
            return null;
        }
        
        entry.hits++;
        return entry.data;
    }
    
    /**
     * Gera chave para cache de duplicatas
     */
    generateDuplicateKey(filePath, cnpjPath, type = 'content') {
        return `${type}-${filePath}-${cnpjPath}`;
    }
    
    /**
     * Limpa cache específico
     */
    clearCache(cacheType) {
        switch (cacheType) {
            case 'files':
                this.fileCache.clear();
                break;
            case 'hashes':
                this.hashCache.clear();
                break;
            case 'xmlData':
                this.xmlDataCache.clear();
                break;
            case 'duplicates':
                this.duplicateCache.clear();
                break;
            case 'all':
                this.fileCache.clear();
                this.hashCache.clear();
                this.xmlDataCache.clear();
                this.duplicateCache.clear();
                break;
        }
        
        this.logger.info('Cache limpo', { type: cacheType });
    }
    
    /**
     * Força o tamanho máximo do cache
     */
    enforceMaxSize(cache, maxSize) {
        if (cache.size <= maxSize) return;
        
        // Remover entradas mais antigas
        const entries = Array.from(cache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        const toRemove = entries.slice(0, cache.size - maxSize);
        toRemove.forEach(([key]) => cache.delete(key));
    }
    
    /**
     * Configurar limpeza automática
     */
    setupAutoCleanup() {
        // Limpeza a cada 5 minutos
        setInterval(() => {
            this.cleanupExpiredEntries();
        }, 300000);
    }
    
    /**
     * Remove entradas expiradas
     */
    cleanupExpiredEntries() {
        const now = Date.now();
        let totalCleaned = 0;
        
        // Limpar cache de arquivos
        for (const [key, entry] of this.fileCache.entries()) {
            if (now - entry.timestamp > this.config.fileCache.ttl) {
                this.fileCache.delete(key);
                totalCleaned++;
            }
        }
        
        // Limpar cache de hashes
        for (const [key, entry] of this.hashCache.entries()) {
            if (now - entry.timestamp > this.config.hashCache.ttl) {
                this.hashCache.delete(key);
                totalCleaned++;
            }
        }
        
        // Limpar cache de dados XML
        for (const [key, entry] of this.xmlDataCache.entries()) {
            if (now - entry.timestamp > this.config.xmlDataCache.ttl) {
                this.xmlDataCache.delete(key);
                totalCleaned++;
            }
        }
        
        // Limpar cache de duplicatas
        for (const [key, entry] of this.duplicateCache.entries()) {
            if (now - entry.timestamp > this.config.duplicateCache.ttl) {
                this.duplicateCache.delete(key);
                totalCleaned++;
            }
        }
        
        if (totalCleaned > 0) {
            this.logger.debug('Limpeza automática de cache', {
                entriesRemoved: totalCleaned,
                remainingEntries: {
                    files: this.fileCache.size,
                    hashes: this.hashCache.size,
                    xmlData: this.xmlDataCache.size,
                    duplicates: this.duplicateCache.size
                }
            });
        }
    }
    
    /**
     * Obtém estatísticas do cache
     */
    getStats() {
        const calculateStats = (cache) => {
            const entries = Array.from(cache.values());
            const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0);
            const avgAge = entries.length > 0 
                ? entries.reduce((sum, entry) => sum + (Date.now() - entry.timestamp), 0) / entries.length / 1000
                : 0;
            
            return {
                size: cache.size,
                totalHits,
                avgAge: Math.round(avgAge)
            };
        };
        
        return {
            files: calculateStats(this.fileCache),
            hashes: calculateStats(this.hashCache),
            xmlData: calculateStats(this.xmlDataCache),
            duplicates: calculateStats(this.duplicateCache)
        };
    }
    
    /**
     * Mascara CNPJ para logs
     */
    maskCNPJ(cnpj) {
        if (!cnpj || cnpj.length < 8) return cnpj;
        return cnpj.substring(0, 4) + '****' + cnpj.substring(cnpj.length - 4);
    }
}

// Singleton
let instance = null;

export function getCacheManager() {
    if (!instance) {
        instance = new CacheManager();
    }
    return instance;
}
