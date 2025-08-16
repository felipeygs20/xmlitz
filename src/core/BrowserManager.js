/**
 * Gerenciador de Navegador
 * Responsável por inicializar e gerenciar o navegador Puppeteer
 */

import puppeteer from 'puppeteer';
import { Logger } from '../utils/Logger.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';

export class BrowserManager {
    constructor(configManager) {
        this.config = configManager;
        this.logger = Logger.getInstance();
        this.errorHandler = ErrorHandler.getInstance();
        
        this.browser = null;
        this.page = null;
        this.organizedDownloadPath = null;
    }
    
    /**
     * Inicializa o navegador com configurações otimizadas
     */
    async initialize() {
        try {
            this.logger.info('Inicializando navegador Puppeteer');
            
            const browserConfig = this.config.get('browser');
            const isHeadless = browserConfig.headless;
            
            // Configurações otimizadas para Windows
            const launchOptions = {
                headless: isHeadless ? 'new' : false,
                defaultViewport: null,
                protocolTimeout: 60000, // 1 minuto (reduzido)
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu',
                    '--disable-background-timer-throttling', // Performance
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-ipc-flooding-protection',
                    '--disable-extensions',
                    '--disable-plugins',
                    '--disable-web-security'
                ],
                ignoreHTTPSErrors: true
            };

            this.browser = await puppeteer.launch(launchOptions);
            
            this.logger.success('Navegador inicializado', {
                headless: isHeadless,
                version: await this.browser.version()
            });
            
            return this.browser;
            
        } catch (error) {
            this.errorHandler.handle(error, 'browser-initialize');
            throw new Error(`Falha na inicialização do navegador: ${error.message}`);
        }
    }
    
    /**
     * Cria uma nova página com configurações otimizadas
     */
    async createPage() {
        try {
            if (!this.browser) {
                throw new Error('Navegador não foi inicializado');
            }
            
            this.page = await this.browser.newPage();
            
            // Configurar viewport
            const browserConfig = this.config.get('browser');
            await this.page.setViewport({
                width: browserConfig.width,
                height: browserConfig.height,
                deviceScaleFactor: 1
            });
            
            // Configurar diretório de download organizado
            const organizedDownloadPath = this.createOrganizedDownloadPath();
            this.organizedDownloadPath = organizedDownloadPath;

            // Criar diretório de download se não existir
            const fs = await import('fs-extra');
            const path = await import('path');
            const absoluteDownloadPath = path.resolve(organizedDownloadPath);
            await fs.ensureDir(absoluteDownloadPath);
            this.logger.info('Diretório de download organizado criado', { path: absoluteDownloadPath });

            // Configurar comportamento de download via CDP
            const client = await this.page.createCDPSession();
            await client.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: absoluteDownloadPath,
                eventsEnabled: true
            });

            // Armazenar path organizado no config para outros serviços
            try {
                this.config.set('download.organizedPath', absoluteDownloadPath);
            } catch (error) {
                this.logger.debug('Não foi possível armazenar path organizado no config');
            }

            // Configurar headers otimizados
            await this.page.setExtraHTTPHeaders({
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            });
            
            // Configurar User-Agent para evitar detecção de bot
            await this.page.setUserAgent(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            );
            
            // Configurar headers extras
            await this.page.setExtraHTTPHeaders({
                'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            });
            
            // Configurar timeouts
            const timeouts = this.config.get('timeouts');
            this.page.setDefaultNavigationTimeout(timeouts.navigation);
            this.page.setDefaultTimeout(timeouts.element);
            
            // Configurar tratamento de dialogs
            this.setupDialogHandler();
            
            // Configurar tratamento de erros de página
            this.setupPageErrorHandlers();

            // Configurar interceptação de requisições desnecessárias
            this.setupRequestInterception();
            
            this.logger.success('Página criada e configurada', {
                downloadPath: organizedDownloadPath,
                viewport: `${browserConfig.width}x${browserConfig.height}`
            });
            
            return this.page;
            
        } catch (error) {
            this.errorHandler.handle(error, 'browser-create-page');
            throw new Error(`Falha na criação da página: ${error.message}`);
        }
    }
    
    /**
     * Configura tratamento automático de dialogs
     */
    setupDialogHandler() {
        this.page.on('dialog', async dialog => {
            const message = dialog.message();
            const type = dialog.type();
            
            this.logger.debug('Dialog detectado', {
                type: type,
                message: message
            });
            
            // Aceitar automaticamente todos os dialogs
            await dialog.accept();
            
            this.logger.debug('Dialog aceito automaticamente');
        });
    }
    
    /**
     * Configura interceptação de requisições desnecessárias
     */
    async setupRequestInterception() {
        await this.page.setRequestInterception(true);

        this.page.on('request', (request) => {
            const url = request.url();

            // Bloquear requisições de analytics, tracking e recursos desnecessários
            if (url.includes('cdn-cgi/rum') ||
                url.includes('analytics') ||
                url.includes('tracking') ||
                url.includes('gtag') ||
                url.includes('google-analytics') ||
                url.includes('facebook.com') ||
                url.includes('doubleclick.net') ||
                url.includes('.css') ||
                url.includes('.woff') ||
                url.includes('.ttf') ||
                url.includes('.png') ||
                url.includes('.jpg') ||
                url.includes('.jpeg') ||
                url.includes('.gif') ||
                url.includes('.svg')) {
                request.abort();
                return;
            }

            request.continue();
        });
    }

    /**
     * Configura tratamento de erros de página
     */
    setupPageErrorHandlers() {
        this.page.on('error', error => {
            this.errorHandler.handle(error, 'page-error');
        });
        
        this.page.on('pageerror', error => {
            this.errorHandler.handle(error, 'page-javascript-error');
        });
        
        this.page.on('requestfailed', request => {
            const url = request.url();
            // Ignorar falhas de analytics e tracking que não são críticas
            if (url.includes('cdn-cgi/rum') ||
                url.includes('analytics') ||
                url.includes('tracking') ||
                url.includes('gtag') ||
                url.includes('google-analytics')) {
                return; // Não logar essas falhas
            }

            this.logger.warn('Requisição falhou', {
                url: url,
                method: request.method(),
                failure: request.failure()?.errorText
            });
        });
        
        this.page.on('response', response => {
            if (response.status() >= 400) {
                this.logger.warn('Resposta HTTP com erro', {
                    url: response.url(),
                    status: response.status(),
                    statusText: response.statusText()
                });
            }
        });
    }
    
    /**
     * Captura screenshot para debug
     */
    async captureScreenshot(filename = null) {
        try {
            if (!this.page) {
                throw new Error('Página não está disponível');
            }
            
            const screenshotPath = this.config.get('logging.screenshotPath');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const finalFilename = filename || `screenshot-${timestamp}.png`;
            const fullPath = `${screenshotPath}${finalFilename}`;
            
            await this.page.screenshot({
                path: fullPath,
                fullPage: true
            });
            
            this.logger.debug('Screenshot capturado', { path: fullPath });
            
            return fullPath;
            
        } catch (error) {
            this.logger.warn('Erro ao capturar screenshot', { error: error.message });
            return null;
        }
    }
    
    /**
     * Obtém informações da página atual
     */
    async getPageInfo() {
        try {
            if (!this.page) {
                return null;
            }
            
            const url = this.page.url();
            const title = await this.page.title();
            
            return {
                url: url,
                title: title,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            this.logger.warn('Erro ao obter informações da página', { error: error.message });
            return null;
        }
    }
    
    /**
     * Aguarda elemento aparecer na página
     */
    async waitForElement(selector, timeout = null) {
        try {
            const elementTimeout = timeout || this.config.get('timeouts.element');
            
            await this.page.waitForSelector(selector, { timeout: elementTimeout });
            
            this.logger.debug('Elemento encontrado', { selector: selector });
            
            return true;
            
        } catch (error) {
            this.logger.warn('Elemento não encontrado', { 
                selector: selector,
                timeout: timeout,
                error: error.message 
            });
            
            return false;
        }
    }
    
    /**
     * Executa JavaScript na página
     */
    async evaluateScript(script, ...args) {
        try {
            if (!this.page) {
                throw new Error('Página não está disponível');
            }
            
            const result = await this.page.evaluate(script, ...args);
            
            this.logger.debug('Script executado com sucesso');
            
            return result;
            
        } catch (error) {
            this.errorHandler.handle(error, 'browser-evaluate-script');
            throw new Error(`Erro na execução do script: ${error.message}`);
        }
    }
    
    /**
     * Fecha o navegador
     */
    async close() {
        try {
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                this.page = null;
                
                this.logger.info('Navegador fechado');
            }
        } catch (error) {
            this.logger.error('Erro ao fechar navegador', { error: error.message });
        }
    }
    
    /**
     * Getters
     */
    getBrowser() {
        return this.browser;
    }
    
    getPage() {
        return this.page;
    }

    getOrganizedDownloadPath() {
        return this.organizedDownloadPath;
    }
    
    /**
     * Verifica se o navegador está ativo
     */
    isActive() {
        return this.browser !== null && this.page !== null;
    }

    /**
     * Cria path organizado para downloads: ANO/MÊS/CNPJ
     */
    createOrganizedDownloadPath() {
        try {
            // Obter configurações
            const baseDownloadPath = this.config.get('download.path');
            const cnpj = this.config.get('credentials.username') || '32800353000162';
            const searchPeriod = this.config.get('searchPeriod');

            // Extrair ano e mês da data de início (forçar timezone local)
            const dateStr = searchPeriod.startDate || '2025-07-01';
            const [yearStr, monthStr] = dateStr.split('-');
            const year = yearStr;
            const month = monthStr;

            // Criar estrutura: downloads/ANO/MÊS/CNPJ usando separador do sistema
            const organizedPath = `${baseDownloadPath}/${year}/${month}/${cnpj}`.replace(/\//g, process.platform === 'win32' ? '\\' : '/');

            this.logger.debug('Path organizado criado', {
                base: baseDownloadPath,
                year: year,
                month: month,
                cnpj: cnpj,
                final: organizedPath
            });

            return organizedPath;

        } catch (error) {
            this.logger.warn('Erro ao criar path organizado, usando padrão', { error: error.message });
            return this.config.get('download.path');
        }
    }
}
