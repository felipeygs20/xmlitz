import { logger } from '../utils/OptimizedLogger.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';

/**
 * Serviço de pesquisa e navegação no sistema NFSe
 * Implementa navegação baseada no exemplo fornecido pelo usuário
 */
export class SearchService {
    constructor(configManager) {
        this.config = configManager;
        this.logger = logger;
        this.errorHandler = ErrorHandler.getInstance();
        
        this.browser = null;
        this.page = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.customSearchPeriod = null; // Para períodos temporários
    }

    /**
     * Define o navegador e página
     */
    setBrowser(browser, page) {
        this.browser = browser;
        this.page = page;
    }

    /**
     * Define um período de busca temporário
     */
    setSearchPeriod(startDate, endDate) {
        this.customSearchPeriod = {
            startDate: startDate,
            endDate: endDate
        };
        this.logger.debug(`Período de busca temporário definido: ${startDate} a ${endDate}`);
    }

    /**
     * Obtém o período de busca atual (temporário ou da configuração)
     */
    getSearchPeriod() {
        return this.customSearchPeriod || this.config.get('searchPeriod');
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
                // Páginas subsequentes: navegar para a página específica
                await this.navigateToPage(pageNumber);
            }

            // Aguardar página carregar
            await this.wait(3000);

            // Verificar se a pesquisa foi bem-sucedida
            const success = await this.verifySearchResults();

            if (success) {
                this.logger.success('✅ Pesquisa executada com sucesso', { page: pageNumber });
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
     * Preenche formulário de pesquisa seguindo o padrão do exemplo fornecido
     */
    async fillSearchForm() {
        try {
            this.logger.info('Preenchendo formulário de pesquisa');

            const searchPeriod = this.getSearchPeriod();

            // Navegar para a página de relatórios se necessário
            const currentUrl = this.page.url();
            if (!currentUrl.includes('pg=relatorio')) {
                const reportsUrl = 'https://imperatriz-ma.prefeituramoderna.com.br/meuiss_new/nfe/index.php?pg=relatorio';
                await this.page.goto(reportsUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: 15000
                });
            }

            // Aguardar campos de data
            await this.page.waitForSelector('#dt_inicial', { timeout: 5000 });
            await this.page.waitForSelector('#dt_final', { timeout: 5000 });

            this.logger.debug('Campos de data encontrados');

            // Preencher data inicial seguindo o padrão do exemplo
            await this.page.click('#dt_inicial');
            await this.page.evaluate((selector) => {
                document.querySelector(selector).value = '';
            }, '#dt_inicial');
            await this.page.type('#dt_inicial', searchPeriod.startDate);

            // Preencher data final seguindo o padrão do exemplo
            await this.page.click('#dt_final');
            await this.page.evaluate((selector) => {
                document.querySelector(selector).value = '';
            }, '#dt_final');
            await this.page.type('#dt_final', searchPeriod.endDate);

            this.logger.debug('Datas preenchidas', {
                startDate: searchPeriod.startDate,
                endDate: searchPeriod.endDate
            });

            // Clicar no botão "Pesquisar Notas" seguindo o padrão do exemplo
            const searchButton = await this.page.waitForSelector('div.card-body button', { timeout: 5000 });
            
            // Aguardar navegação após clique
            await Promise.all([
                this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
                searchButton.click()
            ]);

            this.logger.success('✅ Formulário de pesquisa preenchido e enviado');
            
        } catch (error) {
            this.logger.error('Erro ao preencher formulário de pesquisa', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Navega para uma página específica dos resultados
     */
    async navigateToPage(pageNumber) {
        try {
            this.logger.info(`Navegando para página ${pageNumber}`);

            // Aguardar a paginação carregar
            await this.page.waitForSelector('div.mt-3 nav ul', { timeout: 10000 });

            // Procurar o link da página específica
            const pageSelector = `div.mt-3 li:nth-of-type(${pageNumber}) > a`;
            
            const pageLink = await this.page.$(pageSelector);
            if (!pageLink) {
                throw new Error(`Página ${pageNumber} não encontrada`);
            }

            // Clicar na página e aguardar navegação
            await Promise.all([
                this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
                pageLink.click()
            ]);

            this.logger.success(`✅ Navegação para página ${pageNumber} concluída`);
            
        } catch (error) {
            this.logger.error(`Erro ao navegar para página ${pageNumber}`, {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Verifica se há próxima página disponível
     */
    async hasNextPage() {
        try {
            // Aguardar um pouco para a paginação carregar
            await this.wait(1000);

            // Verificar se há mais páginas numeradas (método mais confiável)
            const currentPageNumber = this.currentPage || 1;
            const nextPageSelector = `div.mt-3 li:nth-of-type(${currentPageNumber + 1}) > a`;
            const nextPageLink = await this.page.$(nextPageSelector);

            if (nextPageLink) {
                this.logger.debug(`Página ${currentPageNumber + 1} disponível`);
                return true;
            }

            // Procurar por botão "Próxima" usando XPath (mais confiável que CSS :contains)
            const nextButtonXPath = '//a[contains(text(), "›") or contains(text(), "Próxima") or contains(@aria-label, "Next")]';
            const nextButtons = await this.page.$x(nextButtonXPath);

            for (const button of nextButtons) {
                const isDisabled = await this.page.evaluate(el => {
                    const li = el.closest('li');
                    return li && (
                        li.classList.contains('disabled') ||
                        el.hasAttribute('disabled') ||
                        el.getAttribute('aria-disabled') === 'true'
                    );
                }, button);

                if (!isDisabled) {
                    this.logger.debug('Próxima página disponível via botão');
                    return true;
                }
            }

            // Verificar se há elementos de paginação
            const paginationExists = await this.page.$('div.mt-3 nav ul');
            if (!paginationExists) {
                this.logger.debug('Nenhuma paginação encontrada');
                return false;
            }

            this.logger.debug('Não há próxima página disponível');
            return false;

        } catch (error) {
            this.logger.warn('Erro ao verificar próxima página', {
                error: error.message
            });
            return false;
        }
    }

    /**
     * Verifica se os resultados da pesquisa foram carregados
     */
    async verifySearchResults() {
        try {
            // Aguardar um pouco para a página carregar completamente
            await this.wait(2000);

            // Verificar se há tabela de resultados
            const hasTable = await this.page.$('table tbody') !== null;
            
            if (!hasTable) {
                this.logger.warn('⚠️ Nenhum elemento de resultados encontrado');
                return false;
            }

            // Verificar se há conteúdo na tabela
            const hasContent = await this.page.evaluate(() => {
                const tbody = document.querySelector('table tbody');
                if (!tbody) return false;
                
                const rows = tbody.querySelectorAll('tr');
                return rows.length > 0;
            });

            if (hasContent) {
                this.logger.success('✅ Tabela de resultados encontrada com conteúdo');
                return true;
            } else {
                this.logger.warn('⚠️ Tabela encontrada mas sem conteúdo');
                return false;
            }
            
        } catch (error) {
            this.logger.error('Erro ao verificar resultados da pesquisa', {
                error: error.message
            });
            return false;
        }
    }

    /**
     * Conta o número de notas na página atual
     */
    async countNotes() {
        try {
            // Aguardar tabela carregar
            await this.page.waitForSelector('table tbody', { timeout: 5000 });

            const noteCount = await this.page.evaluate(() => {
                const tbody = document.querySelector('table tbody');
                if (!tbody) return 0;

                const rows = tbody.querySelectorAll('tr');
                let validRows = 0;

                for (const row of rows) {
                    const cells = row.querySelectorAll('td');
                    if (cells.length > 0) {
                        const firstCellText = cells[0].textContent.trim();
                        if (firstCellText && firstCellText !== 'Nenhum registro encontrado') {
                            validRows++;
                        }
                    }
                }

                return validRows;
            });

            this.logger.debug(`Contadas ${noteCount} notas na página`);
            return noteCount;

        } catch (error) {
            this.logger.warn('Erro ao contar notas', { error: error.message });
            return 0;
        }
    }

    /**
     * Aguarda um tempo específico
     */
    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
