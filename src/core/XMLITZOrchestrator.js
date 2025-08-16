/**
 * XMLITZ Orchestrator
 * Coordena todos os serviços para execução do processo de download
 */

import { BrowserManager } from './BrowserManager.js';
import { AuthenticationService } from './AuthenticationService.js';
import { NavigationService } from './NavigationService.js';
import { SearchService } from './SearchService.js';
import { DownloadService } from './DownloadService.js';
import { logger } from '../utils/OptimizedLogger.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';

export class XMLITZOrchestrator {
    constructor(configManager) {
        this.config = configManager;
        this.logger = logger;

        // Configurar logger otimizado
        this.logger.configure({
            compactMode: true,
            enableRequestLogs: false,
            enableDebugLogs: false,
            maxLogLength: 150
        });

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

        // Iniciar timer de performance
        this.logger.startTimer('xmlitz-execution');

        try {
            this.logger.system('Iniciando processo XMLITZ');

            // 1. Inicializar navegador
            this.logger.startTimer('browser-init');
            await this.initializeBrowser();
            this.logger.endTimer('browser-init');

            // 2. Executar autenticação
            this.logger.startTimer('authentication');
            await this.authenticate();
            this.logger.endTimer('authentication');

            // 3. Navegar para relatórios
            this.logger.startTimer('navigation');
            await this.navigateToReports();
            this.logger.endTimer('navigation');

            // 4. Executar busca e download
            this.logger.startTimer('search-download');
            await this.executeSearchAndDownload();
            this.logger.endTimer('search-download');

            this.logger.success('Processo concluído com sucesso');

            const totalDuration = this.logger.endTimer('xmlitz-execution');
            this.logger.performance('Execução completa', totalDuration, {
                success: true,
                stats: this.stats
            });

            return this.generateReport();

        } catch (error) {
            this.logger.endTimer('xmlitz-execution');
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
            
            // Inicializar FileManager no DownloadService
            await this.downloadService.initialize();

            // Compartilhar instâncias com outros serviços
            this.authService.setBrowser(browser, page);
            this.navigationService.setBrowser(browser, page);
            this.searchService.setBrowser(browser, page);
            this.downloadService.setBrowser(browser, page);

            // Compartilhar path organizado com DownloadService
            const organizedPath = this.browserManager.getOrganizedDownloadPath();
            if (organizedPath) {
                this.downloadService.setOrganizedDownloadPath(organizedPath);
            }
            
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
     * Executa busca e download por competências
     */
    async executeSearchAndDownload() {
        try {
            this.logger.info('Iniciando busca e download por competências');

            // Dividir período em competências mensais
            const competencias = this.generateMonthlyPeriods();
            this.logger.info(`Processando ${competencias.length} competências`, {
                competencias: competencias.map(c => `${c.year}/${c.month}`)
            });

            // Processar cada competência separadamente
            for (let i = 0; i < competencias.length; i++) {
                const competencia = competencias[i];
                this.logger.info(`🗓️ Processando competência ${i + 1}/${competencias.length}: ${competencia.year}/${competencia.month}`);

                try {
                    await this.processCompetencia(competencia);
                } catch (error) {
                    this.logger.error(`Erro ao processar competência ${competencia.year}/${competencia.month}`, {
                        error: error.message
                    });
                    // Continuar com próxima competência
                    continue;
                }

                // Aguardar entre competências para evitar sobrecarga
                if (i < competencias.length - 1) {
                    await this.wait(3000);
                }
            }

            this.logger.success('Busca e download de todas as competências concluídos', {
                competenciasProcessadas: competencias.length,
                pagesProcessed: this.stats.pagesProcessed,
                notesFound: this.stats.notesFound,
                xmlsDownloaded: this.stats.xmlsDownloaded,
                failures: this.stats.failures
            });

        } catch (error) {
            this.logger.error('Falha na busca e download por competências');
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
        
        // Obter estatísticas do FileManager e gerar log de resumo
        const downloadStats = this.downloadService.downloadStats;
        this.downloadService.logDuplicateSummary();

        const report = {
            success: this.stats.xmlsDownloaded > 0,
            duration: duration,
            pagesProcessed: this.stats.pagesProcessed,
            notesFound: this.stats.notesFound,
            xmlsDownloaded: this.stats.xmlsDownloaded,
            xmlsSkipped: downloadStats.skipped || 0,
            duplicatesDetected: downloadStats.duplicates || 0,
            failures: this.stats.failures,
            successRate: successRate,
            downloadPath: this.config.get('download.path'),
            intelligentFileManagement: {
                duplicateDetection: true,
                multiCNPJSupport: true,
                preserveExisting: true
            }
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
     * Gera períodos mensais baseado na configuração de datas
     */
    generateMonthlyPeriods() {
        const searchPeriod = this.config.get('searchPeriod');
        const startDate = new Date(searchPeriod.startDate);
        const endDate = new Date(searchPeriod.endDate);

        const periods = [];
        const current = new Date(startDate);

        // Ajustar para o primeiro dia do mês
        current.setDate(1);

        while (current <= endDate) {
            const year = current.getFullYear();
            const month = String(current.getMonth() + 1).padStart(2, '0');

            // Calcular último dia do mês
            const lastDay = new Date(year, current.getMonth() + 1, 0).getDate();

            // Determinar data de início e fim para este mês
            let monthStartDate, monthEndDate;

            if (current.getFullYear() === startDate.getFullYear() &&
                current.getMonth() === startDate.getMonth()) {
                // Primeiro mês: usar data de início original
                monthStartDate = `${year}-${month}-${String(startDate.getDate()).padStart(2, '0')}`;
            } else {
                // Outros meses: começar do dia 1
                monthStartDate = `${year}-${month}-01`;
            }

            if (current.getFullYear() === endDate.getFullYear() &&
                current.getMonth() === endDate.getMonth()) {
                // Último mês: usar data de fim original
                monthEndDate = `${year}-${month}-${String(endDate.getDate()).padStart(2, '0')}`;
            } else {
                // Outros meses: terminar no último dia
                monthEndDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
            }

            periods.push({
                year: year.toString(),
                month: month,
                startDate: monthStartDate,
                endDate: monthEndDate
            });

            // Avançar para o próximo mês
            current.setMonth(current.getMonth() + 1);
        }

        return periods;
    }

    /**
     * Processa uma competência específica
     */
    async processCompetencia(competencia) {
        this.logger.info(`📅 Iniciando processamento da competência ${competencia.year}/${competencia.month}`);
        this.logger.info(`🗓️ Período: ${competencia.startDate} a ${competencia.endDate}`);

        try {
            // Configurar período de busca específico para esta competência
            await this.searchService.setSearchPeriod(competencia.startDate, competencia.endDate);

            // Configurar diretório de download específico para esta competência
            const competenciaPath = `downloads/${competencia.year}/${competencia.month}`;
            await this.downloadService.setCompetenciaPath(competenciaPath);

            let currentPage = 1;
            let hasMorePages = true;
            let competenciaStats = {
                pagesProcessed: 0,
                notesFound: 0,
                xmlsDownloaded: 0,
                failures: 0
            };

            while (hasMorePages) {
                this.logger.progress(`📊 Processando página ${currentPage} da competência ${competencia.year}/${competencia.month}`);

                // Executar busca na página atual com período específico
                const searchResult = await this.searchService.searchPage(currentPage);

                if (!searchResult.success) {
                    this.logger.warn(`Falha na busca da página ${currentPage} para competência ${competencia.year}/${competencia.month}`);
                    break;
                }

                // Contar notas encontradas
                const noteCount = await this.searchService.countNotes();
                competenciaStats.notesFound += noteCount;
                this.stats.notesFound += noteCount;

                if (noteCount === 0) {
                    this.logger.info(`Página ${currentPage} da competência ${competencia.year}/${competencia.month} não possui notas - fim da busca`);
                    break;
                }

                this.logger.info(`Encontradas ${noteCount} notas na página ${currentPage} da competência ${competencia.year}/${competencia.month}`);

                // Executar downloads da página diretamente para o diretório correto
                const downloadResult = await this.downloadService.downloadPageXMLs(noteCount);

                competenciaStats.xmlsDownloaded += downloadResult.successful;
                competenciaStats.failures += downloadResult.failed;
                competenciaStats.pagesProcessed++;

                this.stats.xmlsDownloaded += downloadResult.successful;
                this.stats.failures += downloadResult.failed;
                this.stats.pagesProcessed++;

                this.logger.progress(`📊 Página ${currentPage} processada`, {
                    competencia: `${competencia.year}/${competencia.month}`,
                    successful: downloadResult.successful,
                    failed: downloadResult.failed,
                    total: noteCount,
                    path: competenciaPath
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
                    this.logger.info(`Última página da competência ${competencia.year}/${competencia.month} processada`);
                }
            }

            this.logger.success(`✅ Competência ${competencia.year}/${competencia.month} concluída`, {
                ...competenciaStats,
                path: competenciaPath
            });

        } catch (error) {
            this.logger.error(`Erro ao processar competência ${competencia.year}/${competencia.month}`, {
                error: error.message
            });
            throw error;
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
