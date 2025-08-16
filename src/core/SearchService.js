/**
 * Serviço de Pesquisa
 * Responsável por executar pesquisas e gerenciar paginação
 */

import { logger } from '../utils/OptimizedLogger.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';

export class SearchService {
    constructor(configManager) {
        this.config = configManager;
        this.logger = logger;
        this.errorHandler = ErrorHandler.getInstance();
        
        this.browser = null;
        this.page = null;
        this.currentPage = 1;
        this.totalPages = 0;
    }
    
    /**
     * Define instâncias do navegador
     */
    setBrowser(browser, page) {
        this.browser = browser;
        this.page = page;
    }
    
    /**
     * Executa pesquisa em uma página específica
     */
    async searchPage(pageNumber = 1) {
        try {
            this.logger.info('Executando pesquisa', { page: pageNumber });

            if (!this.page) {
                throw new Error('Página não está disponível');
            }

            this.currentPage = pageNumber;

            if (pageNumber === 1) {
                // Primeira página: usar formulário
                await this.fillSearchForm();
            } else {
                // Páginas subsequentes: usar URL direta
                const searchUrl = this.buildSearchUrl(pageNumber);
                this.logger.debug('URL de pesquisa construída', { url: searchUrl });

                const navigationTimeout = this.config.get('timeouts.navigation');
                await this.page.goto(searchUrl, {
                    waitUntil: 'networkidle2',
                    timeout: navigationTimeout
                });
            }

            // Aguardar página carregar (tempo otimizado)
            await this.wait(3000);

            // Verificar se a pesquisa foi bem-sucedida
            const success = await this.verifySearchResults();

            if (success) {
                this.logger.success('Pesquisa executada com sucesso', { page: pageNumber });
                return { success: true, page: pageNumber };
            } else {
                throw new Error('Falha na verificação dos resultados da pesquisa');
            }

        } catch (error) {
            this.errorHandler.handle(error, 'search-page');
            return { success: false, page: pageNumber, error: error.message };
        }
    }

    /**
     * Preenche formulário de pesquisa - VERSÃO OTIMIZADA
     */
    async fillSearchForm() {
        try {
            this.logger.info('Preenchendo formulário de pesquisa');

            const searchPeriod = this.config.get('searchPeriod');

            // OTIMIZAÇÃO: Não navegar novamente se já estamos na página certa
            const currentUrl = this.page.url();
            if (!currentUrl.includes('pg=relatorio')) {
                const reportsUrl = 'https://imperatriz-ma.prefeituramoderna.com.br/meuiss_new/nfe/index.php?pg=relatorio';
                await this.page.goto(reportsUrl, {
                    waitUntil: 'domcontentloaded', // Mais rápido
                    timeout: 15000
                });
            }

            // OTIMIZAÇÃO: Aguardar campos com timeout reduzido
            await this.page.waitForSelector('#dt_inicial', { timeout: 5000 });
            await this.page.waitForSelector('#dt_final', { timeout: 5000 });

            this.logger.debug('Campos de data encontrados');

            // OTIMIZAÇÃO: Preenchimento direto e rápido
            this.logger.debug('Preenchendo datas (otimizado)', {
                startDate: searchPeriod.startDate,
                endDate: searchPeriod.endDate
            });

            // Método otimizado: limpar e preencher diretamente
            await this.page.evaluate((startDate, endDate) => {
                const startField = document.querySelector('#dt_inicial');
                const endField = document.querySelector('#dt_final');

                if (startField) {
                    startField.value = '';
                    startField.value = startDate;
                    startField.dispatchEvent(new Event('input', { bubbles: true }));
                    startField.dispatchEvent(new Event('change', { bubbles: true }));
                }

                if (endField) {
                    endField.value = '';
                    endField.value = endDate;
                    endField.dispatchEvent(new Event('input', { bubbles: true }));
                    endField.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, searchPeriod.startDate, searchPeriod.endDate);

            this.logger.debug('Datas preenchidas (otimizado)');

            // Usar locator.fill() como no script gravado
            const endDateLocator = this.page.locator('#dt_final');
            await endDateLocator.fill(searchPeriod.endDate);

            this.logger.debug('Data final preenchida', { date: searchPeriod.endDate });

            // OTIMIZAÇÃO: Aguardar menos tempo
            await this.wait(300);

            // Clicar no botão "Pesquisar Notas" (baseado no script gravado)
            const searchButtonSelectors = [
                'div.card-body button',                                                    // Primeiro do script
                '#formrelatorio > div[2] > div[4] > div > div[1] > button',              // XPath convertido
                'button:contains("Pesquisar Notas")',                                    // Texto específico
                'button[type="submit"]',                                                  // Fallback genérico
                'input[type="submit"][value*="Pesquisar"]'                               // Fallback input
            ];

            let buttonClicked = false;
            for (const selector of searchButtonSelectors) {
                try {
                    this.logger.debug('Tentando seletor de botão pesquisar', { selector });

                    if (selector.includes(':contains')) {
                        // Usar XPath para :contains
                        const xpath = `//button[contains(text(), 'Pesquisar')]`;
                        const elements = await this.page.$x(xpath);

                        if (elements.length > 0) {
                            this.logger.debug('Clicando no botão pesquisar via XPath');
                            await Promise.all([
                                this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
                                elements[0].click()
                            ]);
                            buttonClicked = true;
                            break;
                        }
                    } else {
                        await this.page.waitForSelector(selector, { timeout: 3000 }); // OTIMIZAÇÃO: timeout reduzido
                        this.logger.debug('Clicando no botão pesquisar (otimizado)', { selector });
                        await Promise.all([
                            this.page.waitForNavigation({
                                waitUntil: 'domcontentloaded', // OTIMIZAÇÃO: mais rápido
                                timeout: 15000 // OTIMIZAÇÃO: timeout reduzido
                            }),
                            this.page.click(selector)
                        ]);
                        buttonClicked = true;
                        break;
                    }
                } catch (e) {
                    this.logger.debug('Seletor de botão falhou', { selector, error: e.message });
                    continue;
                }
            }

            if (!buttonClicked) {
                throw new Error('Não foi possível encontrar o botão de pesquisa');
            }

            this.logger.success('Formulário de pesquisa preenchido e enviado');

        } catch (error) {
            this.logger.error('Erro ao preencher formulário de pesquisa', { error: error.message });
            throw error;
        }
    }

    /**
     * Constrói URL de pesquisa com parâmetros
     */
    buildSearchUrl(pageNumber) {
        const baseUrl = 'https://imperatriz-ma.prefeituramoderna.com.br/meuiss_new/nfe/index.php';
        const searchPeriod = this.config.get('searchPeriod');
        
        const params = new URLSearchParams({
            'pageNum_documento': pageNumber.toString(),
            'totalRows_documento': '50',
            'nr_nferps_ini': '',
            'nr_nferps_fim': '',
            'dt_inicial': searchPeriod.startDate,
            'dt_final': searchPeriod.endDate,
            'vl_inicial': '',
            'vl_final': '',
            'st_rps': '1',
            'nr_doc': '',
            'cd_atividade': '',
            'tp_codigo': 'lc116',
            'tp_doc': '1',
            'ordem': 'DESC',
            'consulta': '1',
            'pg': 'relatorio'
        });
        
        return `${baseUrl}?${params.toString()}`;
    }
    
    /**
     * Verifica se os resultados da pesquisa foram carregados
     */
    async verifySearchResults() {
        try {
            const currentUrl = this.page.url();

            // Verificar se a URL contém os parâmetros de pesquisa
            const hasSearchParams = currentUrl.includes('consulta=1') &&
                                  currentUrl.includes('dt_inicial=') &&
                                  currentUrl.includes('dt_final=');

            if (!hasSearchParams) {
                this.logger.warn('URL não contém parâmetros de pesquisa esperados', { url: currentUrl });
                return false;
            }

            this.logger.debug('URL contém parâmetros de pesquisa', { url: currentUrl });

            // Verificar seletores otimizados (ordem por eficiência)
            const resultSelectors = [
                'tr:nth-of-type(1) button.dropdown-toggle',  // Mais específico (baseado no script)
                'table tbody tr',                            // Genérico eficiente
                'tbody tr',                                  // Fallback
                'tbody'                                      // Último recurso
            ];

            for (const selector of resultSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 2000 });

                    // Verificar conteúdo apenas para seletores específicos
                    if (selector.includes('dropdown-toggle')) {
                        this.logger.success('Tabela de resultados encontrada com conteúdo', { selector });
                        return true;
                    }

                    // Para outros seletores, verificar se há conteúdo
                    const hasContent = await this.page.evaluate((sel) => {
                        const element = document.querySelector(sel);
                        return element && element.children.length > 0;
                    }, selector);

                    if (hasContent) {
                        this.logger.success('Tabela de resultados encontrada', { selector });
                        return true;
                    }
                } catch (e) {
                    continue;
                }
            }

            // Se chegou aqui, verificar se há mensagem de "nenhum resultado"
            const noResultsMessages = [
                'Nenhum resultado encontrado',
                'Não foram encontrados',
                'Sem resultados',
                'No results',
                'Nenhuma nota fiscal'
            ];

            for (const message of noResultsMessages) {
                const hasMessage = await this.page.evaluate((msg) => {
                    return document.body.textContent.toLowerCase().includes(msg.toLowerCase());
                }, message);

                if (hasMessage) {
                    this.logger.info('Pesquisa executada mas sem resultados', { message });
                    return true; // Pesquisa foi bem-sucedida, apenas sem resultados
                }
            }

            this.logger.warn('Nenhum elemento de resultados encontrado');
            return false;

        } catch (error) {
            this.logger.error('Erro na verificação dos resultados', { error: error.message });
            return false;
        }
    }
    
    /**
     * Conta o número de notas encontradas na página atual
     */
    async countNotes() {
        try {
            this.logger.debug('Contando notas na página atual');
            
            // Aguardar tabela carregar
            try {
                await this.page.waitForSelector('tbody tr', { timeout: 10000 });
            } catch (e) {
                this.logger.warn('Tabela não encontrada');
                return 0;
            }
            
            // Executar processo de filtragem detalhado
            const filterResults = await this.page.evaluate(() => {
                const allRows = document.querySelectorAll('tbody tr');
                
                let validNotes = [];
                let filteredOut = {
                    headers: 0,
                    empty: 0,
                    pagination: 0,
                    noButton: 0,
                    other: 0
                };
                
                for (let i = 0; i < allRows.length; i++) {
                    const row = allRows[i];
                    const text = row.textContent.trim();
                    const hasDropdownButton = row.querySelector('button.dropdown-toggle') !== null;
                    const hasAnyButton = row.querySelector('button') !== null;
                    
                    // Filtros de exclusão
                    if (text.includes('Número') || text.includes('Data de') || 
                        text.includes('Valor') || text.includes('Status') || 
                        text.includes('Ações')) {
                        filteredOut.headers++;
                        continue;
                    }
                    
                    if (text.length < 20) {
                        filteredOut.empty++;
                        continue;
                    }
                    
                    if (text.includes('Anterior') || text.includes('Próximo') || 
                        text.includes('Página')) {
                        filteredOut.pagination++;
                        continue;
                    }
                    
                    if (!hasDropdownButton && !hasAnyButton) {
                        filteredOut.noButton++;
                        continue;
                    }
                    
                    // Se chegou até aqui, é uma nota válida
                    validNotes.push({
                        index: i + 1,
                        text: text.substring(0, 50),
                        hasDropdown: hasDropdownButton,
                        hasButton: hasAnyButton
                    });
                }
                
                return {
                    validNotes: validNotes,
                    filteredOut: filteredOut,
                    totalRows: allRows.length
                };
            });
            
            // Log do resultado da filtragem
            this.logger.debug('Resultado da filtragem', {
                totalRows: filterResults.totalRows,
                validNotes: filterResults.validNotes.length,
                filteredOut: filterResults.filteredOut
            });
            
            return filterResults.validNotes.length;
            
        } catch (error) {
            this.errorHandler.handle(error, 'search-count-notes');
            return 0;
        }
    }
    
    /**
     * Detecta informações de paginação
     */
    async detectPaginationInfo() {
        try {
            const paginationInfo = await this.page.evaluate(() => {
                // Extrair número da página atual da URL
                const currentUrl = window.location.href;
                const pageNumMatch = currentUrl.match(/pageNum_documento=(\d+)/);
                const currentPage = pageNumMatch ? parseInt(pageNumMatch[1]) : 1;
                
                // Extrair total de registros da URL
                const totalRowsMatch = currentUrl.match(/totalRows_documento=(\d+)/);
                const totalRows = totalRowsMatch ? parseInt(totalRowsMatch[1]) : 0;
                
                // Procurar por links de navegação
                const allLinks = document.querySelectorAll('a');
                let hasNextText = false;
                let hasPrevText = false;
                
                for (let link of allLinks) {
                    const text = link.textContent.toLowerCase();
                    if (text.includes('próxima') || text.includes('next') || text === '>') {
                        hasNextText = true;
                    }
                    if (text.includes('anterior') || text.includes('previous') || text === '<') {
                        hasPrevText = true;
                    }
                }
                
                return {
                    currentPage: currentPage,
                    totalRows: totalRows,
                    hasNextLinks: hasNextText,
                    hasPrevLinks: hasPrevText,
                    url: currentUrl
                };
            });
            
            this.logger.debug('Informações de paginação detectadas', paginationInfo);
            
            return paginationInfo;
            
        } catch (error) {
            this.errorHandler.handle(error, 'search-pagination-info');
            return { 
                currentPage: this.currentPage, 
                totalRows: 0, 
                hasNextLinks: false 
            };
        }
    }
    
    /**
     * Verifica se há próxima página
     */
    async hasNextPage() {
        try {
            const paginationInfo = await this.detectPaginationInfo();
            const noteCount = await this.countNotes();
            
            // Se há menos de 50 notas, provavelmente é a última página
            if (noteCount < 50) {
                this.logger.debug('Última página detectada (menos de 50 notas)');
                return false;
            }
            
            // Se há links de próxima página
            if (paginationInfo.hasNextLinks) {
                this.logger.debug('Próxima página disponível');
                return true;
            }
            
            return false;
            
        } catch (error) {
            this.errorHandler.handle(error, 'search-has-next-page');
            return false;
        }
    }
    
    /**
     * Obtém estatísticas da pesquisa atual
     */
    getSearchStats() {
        return {
            currentPage: this.currentPage,
            totalPages: this.totalPages
        };
    }
    
    /**
     * Utilitário para aguardar
     */
    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
