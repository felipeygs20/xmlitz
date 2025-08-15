/**
 * Serviço de Download
 * Responsável por executar downloads de XMLs com sistema de retry
 */

import { Logger } from '../utils/Logger.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';

export class DownloadService {
    constructor(configManager) {
        this.config = configManager;
        this.logger = Logger.getInstance();
        this.errorHandler = ErrorHandler.getInstance();
        
        this.browser = null;
        this.page = null;
        this.downloadStats = {
            successful: 0,
            failed: 0,
            retries: 0
        };
    }
    
    /**
     * Define instâncias do navegador
     */
    setBrowser(browser, page) {
        this.browser = browser;
        this.page = page;
    }
    
    /**
     * Executa download de todos os XMLs de uma página
     */
    async downloadPageXMLs(noteCount) {
        try {
            this.logger.info('Iniciando download de XMLs da página', { noteCount: noteCount });
            
            if (noteCount === 0) {
                this.logger.warn('Nenhuma nota para download');
                return { successful: 0, failed: 0 };
            }
            
            let successful = 0;
            let failed = 0;
            
            // Download sequencial para evitar problemas
            for (let i = 1; i <= noteCount; i++) {
                this.logger.progress(`Processando XML ${i}/${noteCount}`);
                
                const result = await this.downloadSingleXML(i);
                
                if (result.success) {
                    successful++;
                    this.logger.debug(`XML ${i} baixado com sucesso`);
                } else {
                    failed++;
                    this.logger.warn(`Falha no download do XML ${i}`, { error: result.error });
                }
                
                // Aguardar entre downloads
                if (i < noteCount) {
                    const waitTime = this.config.get('advanced.waitBetweenDownloads');
                    await this.wait(waitTime);
                }
            }
            
            this.downloadStats.successful += successful;
            this.downloadStats.failed += failed;
            
            this.logger.success('Download da página concluído', {
                successful: successful,
                failed: failed,
                total: noteCount
            });
            
            return { successful: successful, failed: failed };
            
        } catch (error) {
            this.errorHandler.handle(error, 'download-page-xmls');
            return { successful: 0, failed: noteCount };
        }
    }
    
    /**
     * Executa download de um XML específico com sistema de retry
     */
    async downloadSingleXML(index, retryCount = 0) {
        const maxRetries = this.config.get('advanced.maxRetries');
        
        try {
            this.logger.debug(`Processando XML linha ${index}`, { 
                attempt: retryCount + 1,
                maxRetries: maxRetries + 1
            });
            
            // Aguardar entre tentativas
            if (retryCount > 0) {
                const retryDelay = this.config.get('advanced.retryDelay');
                await this.wait(retryDelay);
            }
            
            // Passo 1: Clicar no dropdown
            const dropdownSuccess = await this.clickDropdown(index);
            if (!dropdownSuccess) {
                throw new Error('Falha ao clicar no dropdown');
            }
            
            // Passo 2: Aguardar dropdown abrir
            await this.wait(800);
            
            // Passo 3: Clicar no link XML
            const xmlLinkSuccess = await this.clickXMLLink(index);
            if (!xmlLinkSuccess) {
                throw new Error('Falha ao clicar no link XML');
            }
            
            // Passo 4: Aguardar download iniciar
            const downloadTimeout = this.config.get('timeouts.download');
            await this.wait(downloadTimeout);
            
            this.logger.success(`XML linha ${index} baixado com sucesso`);
            
            return { success: true, index: index, attempts: retryCount + 1 };
            
        } catch (error) {
            this.logger.warn(`Erro no download XML linha ${index}`, {
                attempt: retryCount + 1,
                error: error.message
            });
            
            // Fechar dropdown se estiver aberto
            await this.closeDropdown();
            
            // Sistema de retry
            if (retryCount < maxRetries) {
                this.downloadStats.retries++;
                this.logger.debug(`Retry XML linha ${index}`, { 
                    nextAttempt: retryCount + 2 
                });
                
                return await this.downloadSingleXML(index, retryCount + 1);
            } else {
                this.logger.error(`XML linha ${index} falhou após ${maxRetries + 1} tentativas`);
                return { 
                    success: false, 
                    index: index, 
                    attempts: retryCount + 1,
                    error: error.message 
                };
            }
        }
    }
    
    /**
     * Clica no dropdown de uma linha específica
     */
    async clickDropdown(index) {
        try {
            const dropdownSelector = `tr:nth-of-type(${index}) button.dropdown-toggle`;
            
            this.logger.debug(`Clicando dropdown linha ${index}`, { selector: dropdownSelector });
            
            // Aguardar elemento aparecer
            await this.page.waitForSelector(dropdownSelector, { timeout: 5000 });
            
            // Clicar no dropdown
            await this.page.click(dropdownSelector);
            
            this.logger.debug('Dropdown clicado com sucesso');
            
            return true;
            
        } catch (error) {
            this.logger.warn('Erro ao clicar no dropdown', { 
                index: index, 
                error: error.message 
            });
            return false;
        }
    }
    
    /**
     * Clica no link XML usando múltiplas estratégias
     */
    async clickXMLLink(index) {
        try {
            this.logger.debug(`Procurando link XML linha ${index}`);
            
            // Investigar links disponíveis primeiro
            const linksInfo = await this.investigateLinks(index);
            this.logger.debug('Links encontrados', linksInfo);
            
            // Estratégias para encontrar o link XML
            const strategies = [
                // Estratégia 1: Terceiro link da linha
                { 
                    type: 'selector', 
                    value: `tr:nth-of-type(${index}) a:nth-of-type(3)`,
                    description: 'Terceiro link da linha'
                },
                // Estratégia 2: Link com href contendo "xml"
                { 
                    type: 'selector', 
                    value: `tr:nth-of-type(${index}) a[href*="xml"]`,
                    description: 'Link com href contendo xml'
                },
                // Estratégia 3: Último link do dropdown
                { 
                    type: 'selector', 
                    value: `tr:nth-of-type(${index}) .dropdown-menu a:last-child`,
                    description: 'Último link do dropdown'
                },
                // Estratégia 4: XPath para texto contendo XML
                { 
                    type: 'xpath', 
                    value: `//tr[${index}]//a[contains(text(), 'XML')]`,
                    description: 'XPath para texto XML'
                },
                // Estratégia 5: Qualquer link no dropdown
                { 
                    type: 'selector', 
                    value: `tr:nth-of-type(${index}) .dropdown-menu a`,
                    description: 'Qualquer link no dropdown'
                }
            ];
            
            for (let i = 0; i < strategies.length; i++) {
                const strategy = strategies[i];
                
                try {
                    this.logger.debug(`Tentando estratégia ${i + 1}`, { 
                        description: strategy.description,
                        value: strategy.value
                    });
                    
                    let success = false;
                    
                    if (strategy.type === 'xpath') {
                        const elements = await this.page.$x(strategy.value);
                        if (elements.length > 0) {
                            await elements[0].click();
                            success = true;
                        }
                    } else {
                        await this.page.waitForSelector(strategy.value, { timeout: 2000 });
                        await this.page.click(strategy.value);
                        success = true;
                    }
                    
                    if (success) {
                        this.logger.success(`Link XML clicado com estratégia ${i + 1}`);
                        return true;
                    }
                    
                } catch (strategyError) {
                    this.logger.debug(`Estratégia ${i + 1} falhou`, { 
                        error: strategyError.message 
                    });
                    continue;
                }
            }
            
            throw new Error('Nenhuma estratégia de link XML funcionou');
            
        } catch (error) {
            this.logger.warn('Erro ao clicar no link XML', { 
                index: index, 
                error: error.message 
            });
            return false;
        }
    }
    
    /**
     * Investiga links disponíveis em uma linha
     */
    async investigateLinks(index) {
        try {
            return await this.page.evaluate((idx) => {
                const row = document.querySelector(`tr:nth-of-type(${idx})`);
                if (!row) return { error: 'Linha não encontrada' };
                
                const allLinks = row.querySelectorAll('a');
                const dropdownMenu = row.querySelector('.dropdown-menu');
                const dropdownLinks = dropdownMenu ? dropdownMenu.querySelectorAll('a') : [];
                
                return {
                    totalLinks: allLinks.length,
                    totalDropdownLinks: dropdownLinks.length,
                    linksText: Array.from(allLinks).map((a, i) => ({
                        index: i + 1,
                        text: a.textContent.trim(),
                        href: a.href,
                        visible: a.offsetParent !== null
                    })),
                    dropdownLinksText: Array.from(dropdownLinks).map((a, i) => ({
                        index: i + 1,
                        text: a.textContent.trim(),
                        href: a.href,
                        visible: a.offsetParent !== null
                    }))
                };
            }, index);
            
        } catch (error) {
            this.logger.warn('Erro ao investigar links', { error: error.message });
            return { error: error.message };
        }
    }
    
    /**
     * Fecha dropdown aberto
     */
    async closeDropdown() {
        try {
            await this.page.keyboard.press('Escape');
            await this.wait(300);
        } catch (error) {
            // Ignorar erros ao fechar dropdown
        }
    }
    
    /**
     * Obtém estatísticas de download
     */
    getDownloadStats() {
        return { ...this.downloadStats };
    }
    
    /**
     * Reseta estatísticas de download
     */
    resetStats() {
        this.downloadStats = {
            successful: 0,
            failed: 0,
            retries: 0
        };
    }
    
    /**
     * Utilitário para aguardar
     */
    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
