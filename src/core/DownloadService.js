/**
 * Serviço de Download
 * Responsável por executar downloads de XMLs com sistema de retry
 */

import { logger } from '../utils/OptimizedLogger.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';
import { NFSeIngestService } from './NFSeIngestService.js';
import { FileManagerService } from './FileManagerService.js';

export class DownloadService {
    constructor(configManager) {
        this.config = configManager;
        this.logger = logger; // Usar logger otimizado
        this.errorHandler = ErrorHandler.getInstance();
        this.nfseIngestService = null; // Inicializado sob demanda
        
        this.browser = null;
        this.page = null;
        this.organizedDownloadPath = null;
        this.fileManager = new FileManagerService(this.config, this.logger);
        this.downloadStats = {
            successful: 0,
            failed: 0,
            retries: 0,
            skipped: 0,
            duplicates: 0
        };

        // Cache para otimização de verificações
        this.fileCache = {
            existingFiles: null,
            lastCheck: null,
            cnpj: null
        };
    }

    /**
     * Inicializa o serviço de ingestão de NFSe sob demanda
     */
    async initializeNFSeService() {
        if (!this.nfseIngestService) {
            try {
                this.nfseIngestService = new NFSeIngestService();
                await this.nfseIngestService.initialize();
                this.logger.system('Serviço de NFSe inicializado');
            } catch (error) {
                this.logger.warn('Erro ao inicializar serviço de NFSe', {
                    error: error.message
                });
                this.nfseIngestService = null;
            }
        }
        return this.nfseIngestService;
    }

    /**
     * Processa automaticamente os NFSe baixados
     */
    async processDownloadedNFSe() {
        try {
            const nfseService = await this.initializeNFSeService();
            if (!nfseService) {
                this.logger.warn('Serviço de NFSe não disponível - pulando processamento');
                return;
            }

            // Obter informações do download atual
            const cnpj = this.config.get('credentials.username');
            const searchPeriod = this.config.get('searchPeriod');
            const [year, month] = searchPeriod.startDate.split('-');

            this.logger.system('Processando NFSe baixados automaticamente', {
                cnpj: this.maskCNPJ(cnpj),
                year,
                month
            });

            const result = await nfseService.processDownloadedFiles(cnpj, year, month);

            if (result.success > 0) {
                this.logger.success('NFSe processados com sucesso', {
                    total: result.total,
                    success: result.success,
                    errors: result.errors
                });
            } else {
                this.logger.warn('Nenhum NFSe foi processado', result);
            }

        } catch (error) {
            this.logger.warn('Erro ao processar NFSe automaticamente', {
                error: error.message
            });
        }
    }

    /**
     * Mascara CNPJ para logs
     */
    maskCNPJ(cnpj) {
        if (!cnpj || cnpj.length < 8) return cnpj;
        return cnpj.substring(0, 4) + '****' + cnpj.substring(cnpj.length - 4);
    }
    
    /**
     * Inicializa o serviço
     */
    async initialize() {
        try {
            await this.fileManager.initialize();
            this.logger.info('✅ DownloadService inicializado com FileManager', {
                fileManagerInitialized: !!this.fileManager.fs,
                hasPath: !!this.fileManager.path,
                hasCrypto: !!this.fileManager.crypto
            });
        } catch (error) {
            this.logger.error('❌ Erro ao inicializar DownloadService', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Verifica se o FileManager está inicializado
     */
    isFileManagerReady() {
        return !!(this.fileManager && this.fileManager.fs && this.fileManager.path);
    }

    /**
     * Garante que o FileManager está inicializado
     */
    async ensureFileManagerInitialized() {
        if (!this.isFileManagerReady()) {
            this.logger.warn('⚠️ FileManager não inicializado, inicializando agora...');
            await this.initialize();
        }

        if (!this.isFileManagerReady()) {
            throw new Error('FileManager não pôde ser inicializado');
        }
    }

    /**
     * Define instâncias do navegador
     */
    setBrowser(browser, page) {
        this.browser = browser;
        this.page = page;

        // Verificar se FileManager está pronto
        if (!this.isFileManagerReady()) {
            this.logger.warn('⚠️ FileManager não está pronto ao definir navegador');
        }
    }

    /**
     * Define o path organizado para downloads
     */
    setOrganizedDownloadPath(path) {
        this.organizedDownloadPath = path;
        this.logger.debug('Path organizado definido', { path });
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

            // Processar NFSe automaticamente se houve downloads bem-sucedidos
            if (successful > 0) {
                await this.processDownloadedNFSe();
            }

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
            // Log otimizado apenas para primeira tentativa
            if (retryCount === 0) {
                this.logger.download(`Processando XML ${index}`, { index });
            }
            
            // Aguardar entre tentativas
            if (retryCount > 0) {
                const retryDelay = this.config.get('advanced.retryDelay');
                await this.wait(retryDelay);
            }

            // Verificação de duplicatas (otimizada)
            const skipResult = await this.checkIfShouldSkipDownload(index);

            if (skipResult.shouldSkip) {
                this.downloadStats.skipped++;
                if (skipResult.isDuplicate) {
                    this.downloadStats.duplicates++;
                }

                this.logger.duplicate('Duplicata detectada', {
                    index,
                    reason: skipResult.reason,
                    isDuplicate: true,
                    skipped: true,
                    count: this.downloadStats.duplicates
                });

                return {
                    success: true,
                    skipped: true,
                    reason: skipResult.reason,
                    index: index,
                    attempts: 1
                };
            }

            // Passo 1: Clicar no dropdown
            const dropdownSuccess = await this.clickDropdown(index);
            if (!dropdownSuccess) {
                throw new Error('Falha ao clicar no dropdown');
            }
            
            // OTIMIZAÇÃO: Aguardar menos tempo para dropdown abrir
            await this.wait(400);
            
            // Passo 3: Clicar no link XML
            const xmlLinkSuccess = await this.clickXMLLink(index);
            if (!xmlLinkSuccess) {
                throw new Error('Falha ao clicar no link XML');
            }

            // Passo 4: Aguardar download ser concluído e organizar
            const downloadSuccess = await this.waitForDownloadAndOrganize();
            if (!downloadSuccess) {
                this.logger.warn('Download pode ter aberto em nova aba, continuando...');
                // Não falhar aqui, apenas continuar
            }

            this.downloadStats.success++;
            this.logger.success(`XML linha ${index} baixado com sucesso`);
            
            return { success: true, index: index, attempts: retryCount + 1 };
            
        } catch (error) {
            this.logger.warn(`Erro no download XML linha ${index}`, {
                attempt: retryCount + 1,
                error: error.message
            });
            
            // Fechar dropdown se estiver aberto
            await this.closeDropdown();
            
            // Sistema de retry melhorado
            if (retryCount < maxRetries) {
                this.downloadStats.retries++;
                this.logger.debug(`Retry XML linha ${index}`, {
                    nextAttempt: retryCount + 2
                });

                // Aguardar mais tempo entre retries
                const retryDelay = this.config.get('advanced.retryDelay') * (retryCount + 1);
                await this.wait(retryDelay);

                // Tentar recarregar a página se for a segunda tentativa
                if (retryCount === 1) {
                    this.logger.debug('Recarregando página para retry');
                    try {
                        await this.page.reload({ waitUntil: 'networkidle2', timeout: 10000 });
                        await this.wait(2000);
                    } catch (reloadError) {
                        this.logger.warn('Erro ao recarregar página', { error: reloadError.message });
                    }
                }

                return await this.downloadSingleXML(index, retryCount + 1);
            } else {
                this.downloadStats.failed++;
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
     * Clica no dropdown de uma linha específica (mais robusto)
     */
    async clickDropdown(index) {
        const strategies = [
            `tr:nth-of-type(${index}) button.dropdown-toggle`,
            `tbody tr:nth-child(${index}) .dropdown-toggle`,
            `tbody tr:nth-child(${index}) button[data-bs-toggle="dropdown"]`
        ];

        for (const selector of strategies) {
            try {
                // Aguardar elemento estar visível
                await this.page.waitForSelector(selector, { timeout: 3000 });

                // Verificar se elemento está visível
                const isVisible = await this.page.evaluate((sel) => {
                    const element = document.querySelector(sel);
                    return element && element.offsetParent !== null;
                }, selector);

                if (!isVisible) {
                    this.logger.debug('Elemento não visível, tentando próximo', { selector });
                    continue;
                }

                // Clicar no dropdown
                await this.page.click(selector);

                // OTIMIZAÇÃO: Aguardar menos tempo para dropdown abrir
                await this.wait(400);

                // Verificar se dropdown abriu
                const dropdownOpen = await this.page.evaluate((idx) => {
                    const dropdown = document.querySelector(`tr:nth-of-type(${idx}) .dropdown-menu`);
                    return dropdown && dropdown.style.display !== 'none';
                }, index);

                if (dropdownOpen) {
                    this.logger.debug('Dropdown aberto com sucesso', { index, selector });
                    return true;
                }

            } catch (error) {
                this.logger.debug('Estratégia falhou', { selector, error: error.message });
                continue;
            }
        }

        throw new Error(`Falha ao abrir dropdown na linha ${index}`);
    }
    
    /**
     * Clica no link XML usando múltiplas estratégias (mais robusto)
     */
    async clickXMLLink(index) {
        // OTIMIZAÇÃO: Aguardar menos tempo para dropdown estar aberto
        await this.wait(200);

        // Estratégias ordenadas por eficiência
        const strategies = [
            {
                name: 'terceiro-link',
                selector: `tr:nth-of-type(${index}) a:nth-of-type(3)`,
                description: 'Terceiro link da linha'
            },
            {
                name: 'ultimo-dropdown',
                selector: `tr:nth-of-type(${index}) .dropdown-menu a:last-child`,
                description: 'Último link do dropdown'
            },
            {
                name: 'href-xml',
                selector: `tr:nth-of-type(${index}) a[href*="xml"]`,
                description: 'Link com XML no href'
            },
            {
                name: 'qualquer-dropdown',
                selector: `tr:nth-of-type(${index}) .dropdown-menu a`,
                description: 'Qualquer link do dropdown'
            }
        ];

        for (const strategy of strategies) {
            try {
                // OTIMIZAÇÃO: Timeout reduzido para elementos aparecerem
                await this.page.waitForSelector(strategy.selector, { timeout: 1000 });

                // Verificar se elemento está visível
                const isVisible = await this.page.evaluate((sel) => {
                    const element = document.querySelector(sel);
                    return element && element.offsetParent !== null;
                }, strategy.selector);

                if (!isVisible) {
                    this.logger.debug('Link não visível', { strategy: strategy.name });
                    continue;
                }

                // Clicar no link
                await this.page.click(strategy.selector);

                this.logger.download('XML link clicado', { strategy: strategy.name });
                return true;

            } catch (error) {
                this.logger.debug(`Estratégia ${strategy.name} falhou`, { error: error.message });
                continue;
            }
        }

        // Fallback: XPath para texto contendo XML
        try {
            this.logger.debug('Tentando fallback XPath');
            const elements = await this.page.$x(`//tr[${index}]//a[contains(text(), 'XML') or contains(text(), 'xml')]`);

            if (elements.length > 0) {
                await elements[0].click();
                this.logger.success('Link XML clicado via XPath');
                return true;
            }
        } catch (error) {
            this.logger.debug('XPath fallback falhou', { error: error.message });
        }

        throw new Error(`Nenhum link XML encontrado na linha ${index}`);
    }
    


    /**
     * Verifica se deve pular o download (arquivo já existe) - VERSÃO SIMPLIFICADA
     */
    async checkIfShouldSkipDownload(index) {
        try {
            // Obter informações do CNPJ e período
            const cnpj = this.config.get('credentials.username');
            const searchPeriod = this.config.get('searchPeriod');

            this.logger.info('🔍 VERIFICANDO duplicatas pré-download', {
                index,
                cnpj: cnpj ? this.fileManager.maskCNPJ(cnpj) : 'undefined',
                searchPeriod: searchPeriod ? searchPeriod.startDate : 'undefined'
            });

            if (!cnpj || !searchPeriod) {
                this.logger.debug('CNPJ ou período não encontrado, pulando verificação', {
                    cnpj: !!cnpj,
                    searchPeriod: !!searchPeriod
                });
                return { shouldSkip: false };
            }

            // Garantir que FileManager está inicializado
            try {
                await this.ensureFileManagerInitialized();
            } catch (error) {
                this.logger.warn('FileManager não pôde ser inicializado, pulando verificação', {
                    error: error.message
                });
                return { shouldSkip: false };
            }

            // Verificar arquivos existentes no diretório do CNPJ
            const existingFiles = await this.fileManager.listCNPJFiles(cnpj, searchPeriod.startDate);

            this.logger.info('🔍 ARQUIVOS EXISTENTES encontrados', {
                index,
                existingCount: existingFiles.length,
                cnpj: this.fileManager.maskCNPJ(cnpj)
            });

            // VERIFICAÇÃO SIMPLES E DIRETA: Se já temos arquivos, verificar duplicatas
            if (existingFiles.length > 0) {
                this.logger.info('🔍 ARQUIVOS ENCONTRADOS - verificando duplicatas', {
                    existingCount: existingFiles.length,
                    index,
                    cnpj: this.fileManager.maskCNPJ(cnpj),
                    fileNames: existingFiles.slice(0, 3).map(f => f.name)
                });

                // Se já temos 11 ou mais arquivos, são duplicatas
                if (existingFiles.length >= 11) {
                    this.logger.info('🚫 LIMITE DE ARQUIVOS ATINGIDO - pulando download', {
                        existingCount: existingFiles.length,
                        index,
                        reason: 'max_files_reached',
                        cnpj: this.fileManager.maskCNPJ(cnpj)
                    });

                    return {
                        shouldSkip: true,
                        reason: 'max_files_reached',
                        fileName: `xml-${index}.xml`,
                        isDuplicate: true
                    };
                }

                // VERIFICAÇÃO POR NÚMERO DA NOTA FISCAL
                const noteNumber = await this.extractNoteNumberFromPage(index);
                if (noteNumber) {
                    const isDuplicate = existingFiles.some(file =>
                        file.name.includes(noteNumber)
                    );

                    if (isDuplicate) {
                        this.logger.info('🔄 NOTA FISCAL JÁ EXISTE - pulando download', {
                            noteNumber,
                            index,
                            reason: 'note_number_exists',
                            cnpj: this.fileManager.maskCNPJ(cnpj),
                            existingCount: existingFiles.length
                        });

                        return {
                            shouldSkip: true,
                            reason: 'note_exists',
                            fileName: `note-${noteNumber}.xml`,
                            isDuplicate: true
                        };
                    }
                }
            } else {
                this.logger.info('📁 NENHUM ARQUIVO EXISTENTE - prosseguindo com download', {
                    index,
                    cnpj: this.fileManager.maskCNPJ(cnpj)
                });
            }

            // VERIFICAÇÃO POR NÚMERO DA NOTA FISCAL
            const noteNumber = await this.extractNoteNumberFromPage(index);
            if (noteNumber) {
                const isDuplicate = existingFiles.some(file =>
                    file.name.includes(noteNumber)
                );

                if (isDuplicate) {
                    this.logger.info('🔄 Nota fiscal já existe - pulando download', {
                        noteNumber,
                        index,
                        reason: 'note_number_exists',
                        cnpj: this.fileManager.maskCNPJ(cnpj),
                        existingCount: existingFiles.length
                    });

                    return {
                        shouldSkip: true,
                        reason: 'note_exists',
                        fileName: `note-${noteNumber}.xml`,
                        isDuplicate: true
                    };
                }
            }

            this.logger.debug('🔍 Nenhuma duplicata detectada, prosseguindo com download', { index });
            return { shouldSkip: false };

        } catch (error) {
            this.logger.error('Erro ao verificar se deve pular download', {
                index,
                error: error.message
            });
            return { shouldSkip: false };
        }
    }

    /**
     * Extrai número da nota fiscal da página (otimizado)
     */
    async extractNoteNumberFromPage(index) {
        try {
            // Tentar extrair número da nota fiscal da linha da tabela
            const noteNumber = await this.page.evaluate((idx) => {
                const row = document.querySelector(`tr:nth-of-type(${idx})`);
                if (row) {
                    // Procurar por número da nota fiscal (geralmente na primeira ou segunda coluna)
                    const cells = row.querySelectorAll('td');
                    for (let i = 0; i < Math.min(4, cells.length); i++) {
                        const text = cells[i].textContent.trim();

                        // Procurar por padrão de número da nota fiscal (9-10 dígitos)
                        const match = text.match(/\b(\d{9,10})\b/);
                        if (match) {
                            return match[1];
                        }

                        // Fallback: procurar por números menores (6-8 dígitos)
                        const fallbackMatch = text.match(/\b(\d{6,8})\b/);
                        if (fallbackMatch && !text.includes('/') && !text.includes('-')) {
                            return fallbackMatch[1];
                        }
                    }
                }
                return null;
            }, index);

            if (noteNumber) {
                this.logger.debug('Número da nota fiscal extraído', {
                    index,
                    noteNumber
                });
            }

            return noteNumber;

        } catch (error) {
            this.logger.debug('Erro ao extrair número da nota fiscal', {
                index,
                error: error.message
            });
            return null;
        }
    }

    /**
     * Aguarda download e organiza automaticamente
     */
    async waitForDownloadAndOrganize() {
        try {
            // Usar pasta padrão para detectar downloads
            const downloadPath = this.config.get('download.path');
            const fs = await import('fs-extra');
            const path = await import('path');

            const absoluteDownloadPath = path.resolve(downloadPath);
            const filesBefore = await this.countFiles(absoluteDownloadPath);

            this.logger.debug('Aguardando download para organizar', {
                path: absoluteDownloadPath,
                filesBefore
            });

            // Aguardar até 3 segundos para download aparecer
            for (let i = 0; i < 6; i++) {
                await this.wait(500);

                const filesAfter = await this.countFiles(absoluteDownloadPath);
                if (filesAfter > filesBefore) {
                    this.logger.debug('Download detectado, organizando...', {
                        filesBefore,
                        filesAfter
                    });
                    await this.wait(500); // Aguardar finalizar

                    // Organizar arquivo baixado
                    this.logger.debug('Iniciando organização do arquivo...');
                    const organized = await this.organizeLatestDownload();
                    if (organized) {
                        this.logger.success('Arquivo organizado automaticamente');
                    } else {
                        this.logger.warn('Falha ao organizar arquivo');
                    }
                    return true;
                }
            }

            return false;

        } catch (error) {
            this.logger.debug('Erro ao aguardar download', { error: error.message });
            return false;
        }
    }

    /**
     * Aguarda download ser concluído (versão simples)
     */
    async waitForDownloadSimple() {
        try {
            // Usar path organizado se disponível, senão usar padrão
            const downloadPath = this.organizedDownloadPath || this.config.get('download.path');
            const fs = await import('fs-extra');
            const path = await import('path');

            const absoluteDownloadPath = path.resolve(downloadPath);
            const filesBefore = await this.countFiles(absoluteDownloadPath);

            this.logger.debug('Aguardando download', {
                path: absoluteDownloadPath,
                filesBefore
            });

            // Aguardar até 3 segundos para download aparecer
            for (let i = 0; i < 6; i++) {
                await this.wait(500);

                const filesAfter = await this.countFiles(absoluteDownloadPath);
                if (filesAfter > filesBefore) {
                    this.logger.success('Download detectado na pasta organizada', {
                        path: absoluteDownloadPath,
                        filesAfter
                    });
                    await this.wait(500); // Aguardar finalizar
                    return true;
                }
            }

            return false;

        } catch (error) {
            this.logger.debug('Erro ao aguardar download', { error: error.message });
            return false;
        }
    }







    /**
     * Obtém o período de pesquisa atual
     */
    getSearchPeriod() {
        return {
            startDate: this.config.get('searchPeriod.startDate') || '2025-07-01',
            endDate: this.config.get('searchPeriod.endDate') || '2025-08-01'
        };
    }

    /**
     * Obtém o CNPJ atual
     */
    getCNPJ() {
        return this.config.get('credentials.username') || '32800353000162';
    }





    /**
     * Organiza o arquivo mais recente baixado usando FileManager
     */
    async organizeLatestDownload() {
        try {
            this.logger.debug('Iniciando organização inteligente de arquivo...');

            const downloadPath = this.config.get('download.path');
            const fs = await import('fs-extra');
            const path = await import('path');

            const absoluteDownloadPath = path.resolve(downloadPath);

            // Encontrar o arquivo XML mais recente
            const files = await fs.readdir(absoluteDownloadPath);
            const xmlFiles = files.filter(file => file.endsWith('.xml'));

            this.logger.debug('Arquivos encontrados', {
                totalFiles: files.length,
                xmlFiles: xmlFiles.length,
                xmlFilesList: xmlFiles
            });

            if (xmlFiles.length === 0) {
                this.logger.debug('Nenhum arquivo XML encontrado para organizar');
                return false;
            }

            // Pegar o arquivo mais recente
            let newestFile = null;
            let newestTime = 0;

            for (const file of xmlFiles) {
                const filePath = path.join(absoluteDownloadPath, file);
                const stats = await fs.stat(filePath);
                if (stats.mtime.getTime() > newestTime) {
                    newestTime = stats.mtime.getTime();
                    newestFile = file;
                }
            }

            if (!newestFile) {
                this.logger.debug('Nenhum arquivo válido encontrado');
                return false;
            }

            // Garantir que FileManager está pronto e usar para organização inteligente
            await this.ensureFileManagerInitialized();

            const cnpj = this.config.get('credentials.username');
            const searchPeriod = this.config.get('searchPeriod');
            const sourceFile = path.join(absoluteDownloadPath, newestFile);

            const result = await this.fileManager.organizeFile(sourceFile, cnpj, searchPeriod.startDate);

            if (result.skipped) {
                this.downloadStats.skipped++;

                // Contar todos os tipos de duplicatas
                const duplicateReasons = [
                    'content_duplicate',
                    'name_duplicate',
                    'file_exists',
                    'advanced_name_duplicate',
                    'xml_content_duplicate'
                ];

                if (duplicateReasons.includes(result.reason)) {
                    this.downloadStats.duplicates++;
                }

                this.logger.info('🔄 Arquivo foi pulado durante organização', {
                    fileName: result.fileName,
                    reason: result.reason,
                    duplicateOf: result.duplicateOf,
                    skippedCount: this.downloadStats.skipped,
                    duplicatesCount: this.downloadStats.duplicates,
                    isDuplicate: duplicateReasons.includes(result.reason)
                });

                return false; // Não contar como sucesso
            }

            if (result.organized) {
                this.logger.success('Arquivo organizado com FileManager', {
                    fileName: result.fileName,
                    targetPath: result.targetPath
                });
                return true;
            }

            return false;

        } catch (error) {
            this.logger.warn('Erro ao organizar arquivo com FileManager', { error: error.message });
            return false;
        }
    }

    /**
     * Cria path organizado: downloads/ANO/MÊS/CNPJ
     */
    createOrganizedPath() {
        // Obter configurações
        const baseDownloadPath = this.config.get('download.path');
        const cnpj = this.config.get('credentials.username') || '32800353000162';
        const searchPeriod = this.config.get('searchPeriod');

        this.logger.debug('Configurações para path organizado', {
            baseDownloadPath,
            cnpj,
            searchPeriod
        });

        // Extrair ano e mês da data de início (forçar timezone local)
        const dateStr = searchPeriod.startDate || '2025-07-01';
        const [yearStr, monthStr] = dateStr.split('-');
        const year = yearStr;
        const month = monthStr;

        this.logger.debug('Data extraída', {
            startDate: searchPeriod.startDate,
            year,
            month
        });

        // Criar estrutura: downloads/ANO/MÊS/CNPJ usando separador do sistema
        const organizedPath = `${baseDownloadPath}/${year}/${month}/${cnpj}`.replace(/\//g, process.platform === 'win32' ? '\\' : '/');

        this.logger.debug('Path final criado', { organizedPath });

        return organizedPath;
    }

    /**
     * Conta arquivos em um diretório
     */
    async countFiles(dirPath) {
        try {
            const fs = await import('fs-extra');
            const files = await fs.readdir(dirPath);
            return files.filter(file => !file.startsWith('.')).length;
        } catch (error) {
            return 0;
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
     * Obtém arquivos existentes com cache para otimização
     */
    async getCachedExistingFiles(cnpj, startDate) {
        const now = Date.now();
        const cacheTimeout = 30000; // 30 segundos

        // Verificar se o cache é válido
        if (this.fileCache.existingFiles &&
            this.fileCache.cnpj === cnpj &&
            this.fileCache.lastCheck &&
            (now - this.fileCache.lastCheck) < cacheTimeout) {

            this.logger.debug('📋 Usando cache de arquivos existentes', {
                cnpj: this.fileManager.maskCNPJ(cnpj),
                cacheAge: Math.round((now - this.fileCache.lastCheck) / 1000),
                fileCount: this.fileCache.existingFiles.length
            });

            return this.fileCache.existingFiles;
        }

        // Buscar arquivos e atualizar cache
        const existingFiles = await this.fileManager.listCNPJFiles(cnpj, startDate);

        this.fileCache = {
            existingFiles,
            lastCheck: now,
            cnpj
        };

        this.logger.debug('🔄 Cache de arquivos atualizado', {
            cnpj: this.fileManager.maskCNPJ(cnpj),
            fileCount: existingFiles.length
        });

        return existingFiles;
    }

    /**
     * Limpa o cache de arquivos
     */
    clearFileCache() {
        this.fileCache = {
            existingFiles: null,
            lastCheck: null,
            cnpj: null
        };
        this.logger.debug('🗑️ Cache de arquivos limpo');
    }

    /**
     * Obtém estatísticas detalhadas de download
     */
    getDetailedStats() {
        const total = this.downloadStats.successful + this.downloadStats.failed + this.downloadStats.skipped;

        return {
            ...this.downloadStats,
            total,
            successRate: total > 0 ? Math.round((this.downloadStats.successful / total) * 100) : 0,
            duplicateRate: total > 0 ? Math.round((this.downloadStats.duplicates / total) * 100) : 0,
            skipRate: total > 0 ? Math.round((this.downloadStats.skipped / total) * 100) : 0
        };
    }

    /**
     * Reseta estatísticas de download
     */
    resetStats() {
        this.downloadStats = {
            successful: 0,
            failed: 0,
            retries: 0,
            skipped: 0,
            duplicates: 0
        };
        this.logger.debug('Estatísticas de download resetadas');
    }

    /**
     * Log detalhado de resumo de duplicatas
     */
    logDuplicateSummary() {
        const stats = this.getDetailedStats();

        this.logger.info('📊 Resumo de Detecção de Duplicatas', {
            totalProcessed: stats.total,
            successful: stats.successful,
            skipped: stats.skipped,
            duplicates: stats.duplicates,
            failed: stats.failed,
            successRate: `${stats.successRate}%`,
            duplicateRate: `${stats.duplicateRate}%`,
            skipRate: `${stats.skipRate}%`,
            efficiency: stats.skipped > 0 ? 'Otimizado - evitou downloads desnecessários' : 'Normal',
            timestamp: new Date().toISOString()
        });

        if (stats.duplicates > 0) {
            this.logger.success(`🎯 Sistema inteligente evitou ${stats.duplicates} downloads duplicados!`);
        }
    }

    /**
     * Utilitário para aguardar
     */
    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
