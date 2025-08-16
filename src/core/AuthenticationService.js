/**
 * Serviço de Autenticação
 * Responsável por gerenciar o login no sistema NFSe
 */

import { Logger } from '../utils/Logger.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';

export class AuthenticationService {
    constructor(configManager) {
        this.config = configManager;
        this.logger = Logger.getInstance();
        this.errorHandler = ErrorHandler.getInstance();
        
        this.browser = null;
        this.page = null;
        this.isAuthenticated = false;
    }
    
    /**
     * Define instâncias do navegador
     */
    setBrowser(browser, page) {
        this.browser = browser;
        this.page = page;
    }
    
    /**
     * Executa o processo de login
     */
    async login() {
        try {
            this.logger.info('Iniciando processo de login');
            
            if (!this.page) {
                throw new Error('Página não está disponível');
            }
            
            // Navegar para página de login
            await this.navigateToLogin();
            
            // Preencher credenciais
            await this.fillCredentials();
            
            // Submeter formulário
            await this.submitLogin();
            
            // Verificar sucesso do login
            const success = await this.verifyLoginSuccess();
            
            if (success) {
                this.isAuthenticated = true;
                this.logger.success('Login realizado com sucesso');
                return true;
            } else {
                throw new Error('Falha na verificação do login');
            }
            
        } catch (error) {
            this.errorHandler.handle(error, 'authentication-login');
            this.isAuthenticated = false;
            return false;
        }
    }
    
    /**
     * Navega para a página de login
     */
    async navigateToLogin() {
        try {
            const loginUrl = this.config.get('urls.login');
            const navigationTimeout = this.config.get('timeouts.navigation');
            
            this.logger.debug('Navegando para página de login', { url: loginUrl });
            
            await this.page.goto(loginUrl, {
                waitUntil: 'networkidle2',
                timeout: navigationTimeout
            });
            
            // Aguardar página carregar (tempo reduzido)
            await this.wait(1000);

            this.logger.debug('Navegação para login concluída');
            
        } catch (error) {
            throw new Error(`Erro na navegação para login: ${error.message}`);
        }
    }
    
    /**
     * Preenche as credenciais no formulário
     */
    async fillCredentials() {
        try {
            const credentials = this.config.get('credentials');
            const elementTimeout = this.config.get('timeouts.element');
            
            this.logger.debug('Preenchendo credenciais');
            
            // Aguardar e preencher campo de usuário
            await this.page.waitForSelector('#login_nfse', { timeout: elementTimeout });
            await this.page.click('#login_nfse');
            await this.page.evaluate(() => document.querySelector('#login_nfse').value = '');
            await this.page.type('#login_nfse', credentials.username);
            
            this.logger.debug('Campo de usuário preenchido');
            
            // Aguardar e preencher campo de senha
            await this.page.waitForSelector('#senha_nfse_digite', { timeout: elementTimeout });
            await this.page.click('#senha_nfse_digite');
            await this.page.evaluate(() => document.querySelector('#senha_nfse_digite').value = '');
            await this.page.type('#senha_nfse_digite', credentials.password);
            
            this.logger.debug('Campo de senha preenchido');
            
            // Aguardar campos serem preenchidos (tempo reduzido)
            await this.wait(500);
            
        } catch (error) {
            throw new Error(`Erro ao preencher credenciais: ${error.message}`);
        }
    }
    
    /**
     * Submete o formulário de login
     */
    async submitLogin() {
        try {
            const elementTimeout = this.config.get('timeouts.element');
            
            this.logger.debug('Submetendo formulário de login');
            
            // Aguardar e clicar no botão de login
            await this.page.waitForSelector('div.pt-0 h5', { timeout: elementTimeout });
            await this.page.click('div.pt-0 h5');
            
            this.logger.debug('Botão de login clicado');
            
            // Aguardar processamento do login (tempo reduzido)
            await this.wait(3000);
            
        } catch (error) {
            throw new Error(`Erro ao submeter login: ${error.message}`);
        }
    }
    
    /**
     * Verifica se o login foi bem-sucedido
     */
    async verifyLoginSuccess() {
        try {
            this.logger.debug('Verificando sucesso do login');
            
            // Aguardar página carregar após login (tempo reduzido)
            await this.wait(2000);
            
            const currentUrl = this.page.url();
            
            this.logger.debug('URL atual após login', { url: currentUrl });
            
            // Verificar se não estamos mais na página de login
            const isStillOnLoginPage = currentUrl.includes('out=2');
            
            if (!isStillOnLoginPage) {
                // Verificar se há elementos que indicam login bem-sucedido
                const hasLoggedInElements = await this.checkLoggedInElements();
                
                if (hasLoggedInElements) {
                    this.logger.debug('Login verificado com sucesso');
                    return true;
                } else {
                    this.logger.warn('URL mudou mas elementos de login não encontrados');
                    return false;
                }
            } else {
                this.logger.warn('Ainda na página de login após tentativa');
                return false;
            }
            
        } catch (error) {
            this.logger.error('Erro na verificação do login', { error: error.message });
            return false;
        }
    }
    
    /**
     * Verifica elementos que indicam login bem-sucedido
     */
    async checkLoggedInElements() {
        try {
            // Lista de seletores que podem indicar login bem-sucedido
            const loggedInSelectors = [
                'a[href*="relatorio"]',
                'a[href*="logout"]',
                '.menu',
                '.navbar',
                '[class*="menu"]',
                '[class*="nav"]'
            ];
            
            for (const selector of loggedInSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 2000 });
                    this.logger.debug('Elemento de login encontrado', { selector: selector });
                    return true;
                } catch (e) {
                    // Continuar tentando outros seletores
                    continue;
                }
            }
            
            // Se nenhum seletor específico foi encontrado, verificar se há links de navegação
            const hasNavigationLinks = await this.page.evaluate(() => {
                const links = document.querySelectorAll('a');
                return links.length > 5; // Se há mais de 5 links, provavelmente estamos logados
            });
            
            return hasNavigationLinks;
            
        } catch (error) {
            this.logger.warn('Erro ao verificar elementos de login', { error: error.message });
            return false;
        }
    }
    
    /**
     * Verifica se está autenticado
     */
    isLoggedIn() {
        return this.isAuthenticated;
    }
    
    /**
     * Executa logout (se necessário)
     */
    async logout() {
        try {
            if (!this.isAuthenticated) {
                return true;
            }
            
            this.logger.info('Executando logout');
            
            // Tentar encontrar e clicar no link de logout
            const logoutSelectors = [
                'a[href*="logout"]',
                'a[href*="sair"]',
                'a[href*="out=1"]'
            ];
            
            for (const selector of logoutSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 2000 });
                    await this.page.click(selector);
                    
                    this.logger.success('Logout executado');
                    this.isAuthenticated = false;
                    return true;
                } catch (e) {
                    continue;
                }
            }
            
            this.logger.warn('Link de logout não encontrado');
            return false;
            
        } catch (error) {
            this.errorHandler.handle(error, 'authentication-logout');
            return false;
        }
    }
    
    /**
     * Obtém informações do usuário logado
     */
    async getUserInfo() {
        try {
            if (!this.isAuthenticated) {
                return null;
            }
            
            const userInfo = await this.page.evaluate(() => {
                // Tentar extrair informações do usuário da página
                const possibleUserElements = [
                    document.querySelector('[class*="user"]'),
                    document.querySelector('[class*="nome"]'),
                    document.querySelector('[id*="user"]'),
                    document.querySelector('[id*="nome"]')
                ];
                
                for (const element of possibleUserElements) {
                    if (element && element.textContent.trim()) {
                        return {
                            name: element.textContent.trim(),
                            element: element.className || element.id
                        };
                    }
                }
                
                return null;
            });
            
            return userInfo;
            
        } catch (error) {
            this.logger.warn('Erro ao obter informações do usuário', { error: error.message });
            return null;
        }
    }
    
    /**
     * Utilitário para aguardar
     */
    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
