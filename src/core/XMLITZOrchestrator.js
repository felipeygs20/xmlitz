/**
 * XMLITZ Orchestrator
 * Coordena todos os serviços para execução do processo de download
 */

import { BrowserManager } from './BrowserManager.js';
import { AuthenticationService } from './AuthenticationService.js';
import { NavigationService } from './NavigationService.js';
import { SearchService } from './SearchService.js';
import { DownloadService } from './DownloadService.js';
import { Logger } from '../utils/Logger.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';

export class XMLITZOrchestrator {
    constructor(configManager) {
        this.config = configManager;
        this.logger = Logger.getInstance();
        this.errorHandler = ErrorHandler.getInstance();
        
        // Inicializar serviços
        this.browserManager = new BrowserManager(this.config);
        this.authService = new AuthenticationService(this.config);
        this.navigationService = new NavigationService(this.config);
        this.searchService = new SearchService(this.config);
        this.downloadService = new DownloadService(this.config);
        
        // Estatísticas
        this.stats = {
            startTime: null,
            endTime: null,
            pagesProcessed: 0,
            notesFound: 0,
            xmlsDownloaded: 0,
            failures: 0
        };
    }
    
    /**
     * Executa o processo completo de download
     */
    async execute() {
        this.stats.startTime = Date.now();
        
        try {
            this.logger.info('Iniciando processo XMLITZ');
            
            // 1. Inicializar navegador
            await this.initializeBrowser();
            
            // 2. Executar autenticação
            await this.authenticate();
            
            // 3. Navegar para relatórios
            await this.navigateToReports();
            
            // 4. Executar busca e download
            await this.executeSearchAndDownload();
            
            this.logger.success('Processo XMLITZ concluído com sucesso');
            
            return this.generateReport();
            
        } catch (error) {
            this.errorHandler.handle(error, 'orchestrator-execute');
            throw error;
        } finally {
            await this.cleanup();
        }
    }
    
    /**
     * Inicializa o navegador
     */
    async initializeBrowser() {
        try {
            this.logger.info('Inicializando navegador');
            
            const browser = await this.browserManager.initialize();
            const page = await this.browserManager.createPage();
            
            // Compartilhar instâncias com outros serviços
            this.authService.setBrowser(browser, page);
            this.navigationService.setBrowser(browser, page);
            this.searchService.setBrowser(browser, page);
            this.downloadService.setBrowser(browser, page);
            
            this.logger.success('Navegador inicializado');
            
        } catch (error) {
            this.logger.error('Falha na inicialização do navegador');
            throw new Error(`Erro na inicialização do navegador: ${error.message}`);
        }
    }
    
    /**
     * Executa autenticação
     */
    async authenticate() {
        try {
            this.logger.info('Executando autenticação');
            
            const success = await this.authService.login();
            
            if (!success) {
                throw new Error('Falha na autenticação');
            }
            
            this.logger.success('Autenticação realizada com sucesso');
            
        } catch (error) {
            this.logger.error('Falha na autenticação');
            throw new Error(`Erro na autenticação: ${error.message}`);
        }
    }
    
    /**
     * Navega para seção de relatórios
     */
    async navigateToReports() {
        try {
            this.logger.info('Navegando para relatórios');
            
            const success = await this.navigationService.navigateToReports();
            
            if (!success) {
                throw new Error('Falha na navegação para relatórios');
            }
            
            this.logger.success('Navegação para relatórios concluída');
            
        } catch (error) {
            this.logger.error('Falha na navegação para relatórios');
            throw new Error(`Erro na navegação: ${error.message}`);
        }
    }
    
    /**
     * Executa busca e download com paginação
     */
    async executeSearchAndDownload() {
        try {
            this.logger.info('Iniciando busca e download');
            
            let currentPage = 1;
            let hasMorePages = true;
            
            while (hasMorePages) {
                this.logger.progress(`Processando página ${currentPage}`);
                
                // Executar busca na página atual
                const searchResult = await this.searchService.searchPage(currentPage);
                
                if (!searchResult.success) {
                    this.logger.warn(`Falha na busca da página ${currentPage}`);
                    break;
                }
                
                // Contar notas encontradas
                const noteCount = await this.searchService.countNotes();
                this.stats.notesFound += noteCount;
                
                if (noteCount === 0) {
                    this.logger.info(`Página ${currentPage} não possui notas - fim da busca`);
                    break;
                }
                
                this.logger.info(`Encontradas ${noteCount} notas na página ${currentPage}`);
                
                // Executar downloads da página
                const downloadResult = await this.downloadService.downloadPageXMLs(noteCount);
                
                this.stats.xmlsDownloaded += downloadResult.successful;
                this.stats.failures += downloadResult.failed;
                this.stats.pagesProcessed++;
                
                this.logger.progress(`Página ${currentPage} processada`, {
                    successful: downloadResult.successful,
                    failed: downloadResult.failed,
                    total: noteCount
                });
                
                // Verificar se há mais páginas
                hasMorePages = await this.searchService.hasNextPage();
                
                if (hasMorePages) {
                    currentPage++;
                    
                    // Limite de segurança
                    if (currentPage > 100) {
                        this.logger.warn('Limite de segurança atingido (100 páginas)');
                        break;
                    }
                    
                    // Aguardar entre páginas
                    await this.wait(2000);
                } else {
                    this.logger.info('Última página processada');
                }
            }
            
            this.logger.success('Busca e download concluídos', {
                pagesProcessed: this.stats.pagesProcessed,
                notesFound: this.stats.notesFound,
                xmlsDownloaded: this.stats.xmlsDownloaded,
                failures: this.stats.failures
            });
            
        } catch (error) {
            this.logger.error('Falha na busca e download');
            throw new Error(`Erro na busca e download: ${error.message}`);
        }
    }
    
    /**
     * Gera relatório final
     */
    generateReport() {
        this.stats.endTime = Date.now();
        const duration = Math.round((this.stats.endTime - this.stats.startTime) / 1000);
        const successRate = this.stats.notesFound > 0 ? 
            Math.round((this.stats.xmlsDownloaded / this.stats.notesFound) * 100) : 0;
        
        const report = {
            success: this.stats.xmlsDownloaded > 0,
            duration: duration,
            pagesProcessed: this.stats.pagesProcessed,
            notesFound: this.stats.notesFound,
            xmlsDownloaded: this.stats.xmlsDownloaded,
            failures: this.stats.failures,
            successRate: successRate,
            downloadPath: this.config.get('download.path')
        };
        
        this.logger.info('Relatório final gerado', report);
        
        return report;
    }
    
    /**
     * Limpeza de recursos
     */
    async cleanup() {
        try {
            this.logger.info('Executando limpeza de recursos');
            
            await this.browserManager.close();
            
            this.logger.info('Limpeza concluída');
            
        } catch (error) {
            this.logger.error('Erro na limpeza de recursos', { error: error.message });
        }
    }
    
    /**
     * Utilitário para aguardar
     */
    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Obtém estatísticas atuais
     */
    getStats() {
        return { ...this.stats };
    }
}
