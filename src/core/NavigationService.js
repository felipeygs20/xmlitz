/**
 * Serviço de Navegação
 * Responsável por navegar entre as diferentes seções do sistema
 */

import { Logger } from '../utils/Logger.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';

export class NavigationService {
    constructor(configManager) {
        this.config = configManager;
        this.logger = Logger.getInstance();
        this.errorHandler = ErrorHandler.getInstance();
        
        this.browser = null;
        this.page = null;
    }
    
    /**
     * Define instâncias do navegador
     */
    setBrowser(browser, page) {
        this.browser = browser;
        this.page = page;
    }
    
    /**
     * Navega para a seção de relatórios
     */
    async navigateToReports() {
        try {
            this.logger.info('Navegando para seção de relatórios');
            
            if (!this.page) {
                throw new Error('Página não está disponível');
            }
            
            // Tentar navegação via menu primeiro
            const menuSuccess = await this.tryMenuNavigation();
            
            if (menuSuccess) {
                this.logger.success('Navegação via menu bem-sucedida');
                return true;
            }
            
            // Se falhou, tentar navegação direta
            const directSuccess = await this.tryDirectNavigation();
            
            if (directSuccess) {
                this.logger.success('Navegação direta bem-sucedida');
                return true;
            }
            
            throw new Error('Todas as tentativas de navegação falharam');
            
        } catch (error) {
            this.errorHandler.handle(error, 'navigation-reports');
            return false;
        }
    }
    
    /**
     * Tenta navegação via menu
     */
    async tryMenuNavigation() {
        try {
            this.logger.debug('Tentando navegação via menu');
            
            // Lista de possíveis seletores para o menu de relatórios
            const menuSelectors = [
                'a:nth-of-type(7)',
                'a[href*="relatorio"]',
                'a[href*="report"]',
                'a:contains("Relatório")',
                'a:contains("Relatórios")',
                'a:contains("Report")',
                '.menu a[href*="relatorio"]',
                '.navbar a[href*="relatorio"]'
            ];
            
            for (const selector of menuSelectors) {
                try {
                    this.logger.debug('Tentando seletor de menu', { selector: selector });
                    
                    if (selector.includes(':contains')) {
                        // Usar XPath para :contains
                        const xpath = `//a[contains(text(), 'Relatório') or contains(text(), 'Relatórios') or contains(text(), 'Report')]`;
                        const elements = await this.page.$x(xpath);
                        
                        if (elements.length > 0) {
                            await elements[0].click();
                            await this.wait(3000);
                            
                            if (await this.verifyReportsPage()) {
                                return true;
                            }
                        }
                    } else {
                        await this.page.waitForSelector(selector, { timeout: 5000 });
                        await this.page.click(selector);
                        await this.wait(3000);
                        
                        if (await this.verifyReportsPage()) {
                            return true;
                        }
                    }
                } catch (e) {
                    this.logger.debug('Seletor de menu falhou', { 
                        selector: selector, 
                        error: e.message 
                    });
                    continue;
                }
            }
            
            return false;
            
        } catch (error) {
            this.logger.warn('Erro na navegação via menu', { error: error.message });
            return false;
        }
    }
    
    /**
     * Tenta navegação direta via URL
     */
    async tryDirectNavigation() {
        try {
            this.logger.debug('Tentando navegação direta');
            
            const reportsUrl = this.config.get('urls.reports');
            const navigationTimeout = this.config.get('timeouts.navigation');
            
            this.logger.debug('Navegando diretamente para relatórios', { url: reportsUrl });
            
            await this.page.goto(reportsUrl, {
                waitUntil: 'networkidle2',
                timeout: navigationTimeout
            });
            
            await this.wait(2000);
            
            return await this.verifyReportsPage();
            
        } catch (error) {
            this.logger.warn('Erro na navegação direta', { error: error.message });
            return false;
        }
    }
    
    /**
     * Verifica se estamos na página de relatórios
     */
    async verifyReportsPage() {
        try {
            const currentUrl = this.page.url();
            
            this.logger.debug('Verificando página de relatórios', { url: currentUrl });
            
            // Verificar URL
            if (currentUrl.includes('pg=relatorio') || currentUrl.includes('relatorio')) {
                this.logger.debug('URL indica página de relatórios');
                return true;
            }
            
            // Verificar elementos específicos da página de relatórios
            const hasReportElements = await this.checkReportElements();
            
            if (hasReportElements) {
                this.logger.debug('Elementos de relatório encontrados');
                return true;
            }
            
            return false;
            
        } catch (error) {
            this.logger.warn('Erro na verificação da página de relatórios', { error: error.message });
            return false;
        }
    }
    
    /**
     * Verifica elementos específicos da página de relatórios
     */
    async checkReportElements() {
        try {
            // Lista de elementos que podem indicar página de relatórios
            const reportSelectors = [
                'input[name*="dt_inicial"]',
                'input[name*="dt_final"]',
                'input[name*="data"]',
                'form[action*="relatorio"]',
                'table[class*="relatorio"]',
                '.relatorio',
                '#relatorio',
                'input[type="date"]',
                'select[name*="status"]'
            ];
            
            for (const selector of reportSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 2000 });
                    this.logger.debug('Elemento de relatório encontrado', { selector: selector });
                    return true;
                } catch (e) {
                    continue;
                }
            }
            
            // Verificar se há formulários de pesquisa
            const hasSearchForm = await this.page.evaluate(() => {
                const forms = document.querySelectorAll('form');
                const inputs = document.querySelectorAll('input[type="text"], input[type="date"]');
                return forms.length > 0 && inputs.length > 2;
            });
            
            return hasSearchForm;
            
        } catch (error) {
            this.logger.warn('Erro ao verificar elementos de relatório', { error: error.message });
            return false;
        }
    }
    
    /**
     * Navega para uma URL específica
     */
    async navigateToUrl(url, options = {}) {
        try {
            this.logger.debug('Navegando para URL', { url: url });
            
            const defaultOptions = {
                waitUntil: 'networkidle2',
                timeout: this.config.get('timeouts.navigation')
            };
            
            const finalOptions = { ...defaultOptions, ...options };
            
            await this.page.goto(url, finalOptions);
            
            // Aguardar página carregar
            await this.wait(2000);
            
            this.logger.debug('Navegação para URL concluída');
            
            return true;
            
        } catch (error) {
            this.errorHandler.handle(error, 'navigation-url');
            return false;
        }
    }
    
    /**
     * Volta para a página anterior
     */
    async goBack() {
        try {
            this.logger.debug('Voltando para página anterior');
            
            await this.page.goBack({
                waitUntil: 'networkidle2',
                timeout: this.config.get('timeouts.navigation')
            });
            
            await this.wait(2000);
            
            this.logger.debug('Navegação para trás concluída');
            
            return true;
            
        } catch (error) {
            this.errorHandler.handle(error, 'navigation-back');
            return false;
        }
    }
    
    /**
     * Recarrega a página atual
     */
    async reload() {
        try {
            this.logger.debug('Recarregando página');
            
            await this.page.reload({
                waitUntil: 'networkidle2',
                timeout: this.config.get('timeouts.navigation')
            });
            
            await this.wait(2000);
            
            this.logger.debug('Recarga da página concluída');
            
            return true;
            
        } catch (error) {
            this.errorHandler.handle(error, 'navigation-reload');
            return false;
        }
    }
    
    /**
     * Obtém informações da página atual
     */
    async getCurrentPageInfo() {
        try {
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
     * Verifica se uma URL está acessível
     */
    async isUrlAccessible(url) {
        try {
            const response = await this.page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 10000
            });
            
            return response.status() < 400;
            
        } catch (error) {
            this.logger.warn('URL não acessível', { url: url, error: error.message });
            return false;
        }
    }
    
    /**
     * Utilitário para aguardar
     */
    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
