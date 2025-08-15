/**
 * Gerenciador de Configurações
 * Sistema robusto de configuração com validação e suporte a variáveis de ambiente
 */

import fs from 'fs-extra';
import path from 'path';
import { Logger } from '../utils/Logger.js';

export class ConfigManager {
    static instance = null;
    
    constructor() {
        this.logger = Logger.getInstance();
        this.config = {};
        this.defaultConfig = this.getDefaultConfig();
        this.configFile = path.join(process.cwd(), 'xmlitz.config.js');
        this.envFile = path.join(process.cwd(), '.env');
    }
    
    /**
     * Singleton pattern
     */
    static getInstance() {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }
    
    /**
     * Carrega todas as configurações
     */
    async load() {
        try {
            // 1. Carregar configurações padrão
            this.config = { ...this.defaultConfig };
            
            // 2. Carregar variáveis de ambiente
            await this.loadEnvironmentVariables();
            
            // 3. Carregar arquivo de configuração
            await this.loadConfigFile();
            
            // 4. Aplicar overrides de ambiente
            this.applyEnvironmentOverrides();
            
            // 5. Validar configurações
            this.validateConfig();
            
            this.logger.info('Configurações carregadas com sucesso', {
                environment: this.getEnvironment(),
                configFile: await fs.pathExists(this.configFile)
            });
            
            return this.config;
        } catch (error) {
            this.logger.error('Erro ao carregar configurações', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Obtém configuração padrão
     */
    getDefaultConfig() {
        return {
            credentials: {
                username: null,  // Sempre passado via parâmetro
                password: null   // Sempre passado via parâmetro
            },
            searchPeriod: {
                startDate: this.getCurrentMonthStart(),
                endDate: this.getCurrentMonthEnd()
            },
            timeouts: {
                navigation: 30000,
                element: 10000,
                download: 5000
            },
            urls: {
                base: 'https://imperatriz-ma.prefeituramoderna.com.br/meuiss_new/nfe/',
                login: 'https://imperatriz-ma.prefeituramoderna.com.br/meuiss_new/nfe/index.php?out=2',
                reports: 'https://imperatriz-ma.prefeituramoderna.com.br/meuiss_new/nfe/index.php?pg=relatorio'
            },
            browser: {
                headless: false,
                width: 1100,
                height: 633,
                devtools: false
            },
            download: {
                path: process.cwd(),
                timeout: 30000,
                retries: 3
            },
            logging: {
                level: 'info',
                saveScreenshots: true,
                screenshotPath: './screenshots/'
            },
            advanced: {
                waitBetweenDownloads: 1000,
                maxConcurrentDownloads: 1,
                retryFailedDownloads: true,
                maxRetries: 3,
                retryDelay: 2000,
                skipExistingFiles: false,
                debugMode: false
            }
        };
    }
    
    /**
     * Carrega variáveis de ambiente do arquivo .env
     */
    async loadEnvironmentVariables() {
        try {
            if (await fs.pathExists(this.envFile)) {
                const envContent = await fs.readFile(this.envFile, 'utf8');
                const lines = envContent.split('\n');
                
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#')) {
                        const [key, ...valueParts] = trimmed.split('=');
                        if (key && valueParts.length > 0) {
                            process.env[key.trim()] = valueParts.join('=').trim();
                        }
                    }
                }
                
                this.logger.debug('Variáveis de ambiente carregadas do .env');
            }
        } catch (error) {
            this.logger.warn('Erro ao carregar arquivo .env', { error: error.message });
        }
    }
    
    /**
     * Carrega arquivo de configuração
     */
    async loadConfigFile() {
        try {
            if (await fs.pathExists(this.configFile)) {
                const { getConfig } = await import(this.configFile);
                const fileConfig = getConfig(this.getEnvironment());
                
                // Merge profundo das configurações
                this.config = this.deepMerge(this.config, fileConfig);
                
                this.logger.debug('Arquivo de configuração carregado');
            }
        } catch (error) {
            this.logger.warn('Erro ao carregar arquivo de configuração', { error: error.message });
        }
    }
    
    /**
     * Aplica overrides baseados em variáveis de ambiente
     */
    applyEnvironmentOverrides() {
        const envMappings = {
            'XMLITZ_USERNAME': 'credentials.username',
            'XMLITZ_PASSWORD': 'credentials.password',
            'XMLITZ_START_DATE': 'searchPeriod.startDate',
            'XMLITZ_END_DATE': 'searchPeriod.endDate',
            'XMLITZ_HEADLESS': 'browser.headless',
            'XMLITZ_DEBUG': 'advanced.debugMode',
            'XMLITZ_LOG_LEVEL': 'logging.level',
            'XMLITZ_DOWNLOAD_PATH': 'download.path'
        };
        
        for (const [envVar, configPath] of Object.entries(envMappings)) {
            const value = process.env[envVar];
            if (value !== undefined) {
                this.setNestedValue(this.config, configPath, this.parseEnvValue(value));
                this.logger.debug(`Override aplicado: ${configPath} = ${value}`);
            }
        }
    }
    
    /**
     * Valida as configurações carregadas
     * NOTA: Credenciais são validadas separadamente quando passadas via parâmetro
     */
    validateConfig() {
        const errors = [];

        // Credenciais são validadas dinamicamente quando fornecidas
        // Não validamos aqui pois são passadas via parâmetro
        
        // Validar datas
        if (!this.isValidDate(this.config.searchPeriod.startDate)) {
            errors.push('Data inicial inválida');
        }
        
        if (!this.isValidDate(this.config.searchPeriod.endDate)) {
            errors.push('Data final inválida');
        }
        
        // Validar período
        const startDate = new Date(this.config.searchPeriod.startDate);
        const endDate = new Date(this.config.searchPeriod.endDate);
        
        if (startDate > endDate) {
            errors.push('Data inicial deve ser anterior à data final');
        }
        
        // Validar timeouts
        if (this.config.timeouts.navigation < 5000) {
            errors.push('Timeout de navegação muito baixo (mínimo 5000ms)');
        }
        
        if (errors.length > 0) {
            throw new Error(`Configuração inválida: ${errors.join(', ')}`);
        }
    }
    
    /**
     * Obtém uma configuração específica
     */
    get(path, defaultValue = undefined) {
        return this.getNestedValue(this.config, path) ?? defaultValue;
    }
    
    /**
     * Define uma configuração específica
     */
    set(path, value) {
        this.setNestedValue(this.config, path, value);
    }
    
    /**
     * Obtém todas as configurações
     */
    getAll() {
        return { ...this.config };
    }
    
    /**
     * Obtém o ambiente atual
     */
    getEnvironment() {
        return process.env.NODE_ENV || 'development';
    }
    
    /**
     * Utilitários
     */
    
    deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }
    
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            return current[key];
        }, obj);
        
        target[lastKey] = value;
    }
    
    parseEnvValue(value) {
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (/^\d+$/.test(value)) return parseInt(value);
        if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
        return value;
    }
    
    isValidDate(dateString) {
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(dateString)) return false;
        
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date);
    }
    
    getCurrentMonthStart() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    }
    
    getCurrentMonthEnd() {
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDay}`;
    }
}
