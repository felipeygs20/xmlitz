/**
 * Serviço inteligente de gerenciamento de arquivos
 * Responsável por detecção de duplicatas, estrutura multi-CNPJ e preservação de arquivos
 */

export class FileManagerService {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.fs = null;
        this.path = null;
        this.crypto = null;
        this.competenciaPath = null; // Path específico da competência atual
    }

    /**
     * Inicializa dependências assíncronas
     */
    async initialize() {
        try {
            this.fs = await import('fs-extra');
            this.path = await import('path');
            this.crypto = await import('crypto');

            // Inicializar cache manager
            const { getCacheManager } = await import('./CacheManager.js');
            this.cacheManager = getCacheManager();

            this.logger.info('🧠 FileManagerService inicializado com sucesso', {
                hasFs: !!this.fs,
                hasPath: !!this.path,
                hasCrypto: !!this.crypto,
                hasCache: !!this.cacheManager
            });
        } catch (error) {
            this.logger.error('❌ Erro ao inicializar FileManagerService', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Define o path específico para uma competência
     */
    setCompetenciaPath(competenciaPath) {
        this.competenciaPath = competenciaPath;
        this.logger.info(`📁 FileManager configurado para competência: ${competenciaPath}`);
    }

    /**
     * Obtém o path base considerando a competência atual
     */
    getBasePath() {
        if (this.competenciaPath) {
            return this.competenciaPath;
        }
        return this.config.get('download.path');
    }

    /**
     * Cria estrutura de diretórios para um CNPJ específico
     */
    async createCNPJStructure(cnpj, startDate) {
        try {
            const baseDownloadPath = this.getBasePath();

            // Se já temos um path de competência, usar diretamente
            if (this.competenciaPath) {
                const cnpjPath = this.buildPath(baseDownloadPath, cnpj);
                await this.fs.ensureDir(cnpjPath);
                this.logger.debug(`📁 Estrutura CNPJ criada: ${cnpjPath}`);
                return cnpjPath;
            }

            // Caso contrário, usar a lógica original
            const [year, month] = startDate.split('-');
            const cnpjPath = this.buildPath(baseDownloadPath, year, month, cnpj);
            
            // Verificar se diretório já existe
            const exists = await this.fs.pathExists(cnpjPath);
            
            if (!exists) {
                await this.fs.ensureDir(cnpjPath);
                this.logger.info('Nova estrutura CNPJ criada', {
                    cnpj: this.maskCNPJ(cnpj),
                    path: cnpjPath,
                    structure: `${year}/${month}/${cnpj}`
                });
            } else {
                this.logger.debug('Estrutura CNPJ já existe', {
                    cnpj: this.maskCNPJ(cnpj),
                    path: cnpjPath
                });
            }
            
            return cnpjPath;
            
        } catch (error) {
            this.logger.error('Erro ao criar estrutura CNPJ', {
                cnpj: this.maskCNPJ(cnpj),
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Verifica se um arquivo XML já existe no diretório de destino (por nome)
     */
    async checkFileExists(fileName, cnpjPath) {
        try {
            const filePath = this.path.join(cnpjPath, fileName);
            const exists = await this.fs.pathExists(filePath);

            if (exists) {
                // Verificar se arquivo não está corrompido
                const stats = await this.fs.stat(filePath);
                const isValid = stats.size > 0;

                this.logger.info('🔍 Arquivo já existe no diretório', {
                    fileName,
                    exists,
                    size: stats.size,
                    isValid,
                    cnpjPath: cnpjPath.split('\\').slice(-3).join('/')
                });

                return isValid;
            }

            return false;

        } catch (error) {
            this.logger.debug('Erro ao verificar arquivo existente', {
                fileName,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Verifica duplicatas por conteúdo XML (Número + CodigoVerificacao)
     */
    async checkFileNameDuplicate(fileName, cnpjPath) {
        try {
            if (!await this.fs.pathExists(cnpjPath)) {
                return null;
            }

            // Verificar todos os arquivos XML no diretório
            const files = await this.fs.readdir(cnpjPath);
            const xmlFiles = files.filter(file => file.endsWith('.xml'));

            this.logger.debug('🔍 Verificando duplicata por nome exato', {
                fileName,
                existingFiles: xmlFiles.length,
                cnpjPath: cnpjPath.split('\\').slice(-3).join('/')
            });

            // Verificar se o arquivo já existe pelo nome exato
            for (const existingFile of xmlFiles) {
                if (existingFile === fileName) {
                    this.logger.info('🔄 Duplicata detectada por nome exato do arquivo', {
                        fileName,
                        existingFile
                    });
                    return existingFile;
                }
            }

            return null;

        } catch (error) {
            this.logger.debug('Erro ao verificar duplicata por nome', {
                fileName,
                error: error.message
            });
            return null;
        }
    }

    /**
     * Verifica duplicatas por conteúdo XML (Número + CodigoVerificacao)
     */
    async checkXMLContentDuplicate(sourceFile, cnpjPath) {
        try {
            if (!await this.fs.pathExists(sourceFile) || !await this.fs.pathExists(cnpjPath)) {
                return null;
            }

            // Verificar cache de duplicatas primeiro
            const cacheKey = this.cacheManager.generateDuplicateKey(sourceFile, cnpjPath, 'xml');
            const cachedResult = this.cacheManager.getDuplicateCache(cacheKey);
            if (cachedResult !== null) {
                this.logger.debug('Resultado de duplicata XML obtido do cache', {
                    file: this.path.basename(sourceFile),
                    cached: true
                });
                return cachedResult;
            }

            // Verificar cache de dados XML primeiro
            let newFileData = this.cacheManager.getXMLDataCache(sourceFile);
            if (!newFileData) {
                const newFileContent = await this.fs.readFile(sourceFile, 'utf8');
                newFileData = this.extractXMLData(newFileContent);

                // Armazenar dados XML no cache
                this.cacheManager.setXMLDataCache(sourceFile, newFileData);

                this.logger.debug('🔍 Dados XML extraídos e armazenados no cache', {
                    sourceFile: this.path.basename(sourceFile),
                    numero: newFileData.numero,
                    codigoVerificacao: newFileData.codigoVerificacao ? newFileData.codigoVerificacao.substring(0, 8) + '...' : null,
                    hasNumero: !!newFileData.numero,
                    hasCodigo: !!newFileData.codigoVerificacao
                });
            } else {
                this.logger.debug('🔍 Dados XML obtidos do cache', {
                    sourceFile: this.path.basename(sourceFile),
                    numero: newFileData.numero,
                    cached: true
                });
            }

            if (!newFileData.numero || !newFileData.codigoVerificacao) {
                this.logger.debug('❌ Não foi possível extrair dados do XML novo', {
                    sourceFile: this.path.basename(sourceFile),
                    numero: newFileData.numero,
                    codigoVerificacao: newFileData.codigoVerificacao
                });

                // Armazenar resultado negativo no cache
                this.cacheManager.setDuplicateCache(cacheKey, null);
                return null;
            }

            // Verificar todos os arquivos XML existentes
            const files = await this.fs.readdir(cnpjPath);
            const xmlFiles = files.filter(file => file.endsWith('.xml'));

            this.logger.debug('🔍 Verificando duplicata por conteúdo XML', {
                newFile: this.path.basename(sourceFile),
                numero: newFileData.numero,
                codigoVerificacao: newFileData.codigoVerificacao.substring(0, 8) + '...',
                existingFiles: xmlFiles.length
            });

            for (const existingFile of xmlFiles) {
                try {
                    const existingPath = this.path.join(cnpjPath, existingFile);

                    // Verificar cache de dados XML para arquivo existente
                    let existingData = this.cacheManager.getXMLDataCache(existingPath);
                    if (!existingData) {
                        const existingContent = await this.fs.readFile(existingPath, 'utf8');
                        existingData = this.extractXMLData(existingContent);

                        // Armazenar dados XML no cache
                        this.cacheManager.setXMLDataCache(existingPath, existingData);
                    }

                    // Comparar Número + CodigoVerificacao
                    if (existingData.numero === newFileData.numero &&
                        existingData.codigoVerificacao === newFileData.codigoVerificacao) {

                        this.logger.info('🔄 Duplicata detectada por conteúdo XML', {
                            newFile: this.path.basename(sourceFile),
                            existingFile,
                            numero: newFileData.numero,
                            codigoVerificacao: newFileData.codigoVerificacao.substring(0, 8) + '...'
                        });

                        // Armazenar resultado no cache
                        this.cacheManager.setDuplicateCache(cacheKey, existingFile);
                        return existingFile;
                    }
                } catch (fileError) {
                    this.logger.debug('Erro ao ler arquivo existente para comparação XML', {
                        existingFile,
                        error: fileError.message
                    });
                    continue;
                }
            }

            // Armazenar resultado negativo no cache
            this.cacheManager.setDuplicateCache(cacheKey, null);

            return null;

        } catch (error) {
            this.logger.debug('Erro ao verificar duplicata por conteúdo XML', {
                sourceFile,
                error: error.message
            });
            return null;
        }
    }

    /**
     * Extrai dados importantes do XML (Número e CodigoVerificacao)
     */
    extractXMLData(xmlContent) {
        try {
            this.logger.debug('🔍 Extraindo dados do XML...', {
                contentLength: xmlContent.length,
                hasNumeroTag: xmlContent.includes('<Numero>'),
                hasCodigoTag: xmlContent.includes('<CodigoVerificacao>')
            });

            // Extrair número da nota fiscal - múltiplos padrões
            let numero = null;
            const numeroPatterns = [
                /<Numero>(\d+)<\/Numero>/,
                /<numero>(\d+)<\/numero>/i,
                /<InfNfse>[\s\S]*?<Numero>(\d+)<\/Numero>/,
            ];

            for (const pattern of numeroPatterns) {
                const match = xmlContent.match(pattern);
                if (match) {
                    numero = match[1];
                    break;
                }
            }

            // Extrair código de verificação - múltiplos padrões
            let codigoVerificacao = null;
            const codigoPatterns = [
                /<CodigoVerificacao>([a-f0-9]+)<\/CodigoVerificacao>/i,
                /<codigoverificacao>([a-f0-9]+)<\/codigoverificacao>/i,
                /<CodigoVerificacao>([A-Fa-f0-9]+)<\/CodigoVerificacao>/
            ];

            for (const pattern of codigoPatterns) {
                const match = xmlContent.match(pattern);
                if (match) {
                    codigoVerificacao = match[1];
                    break;
                }
            }

            this.logger.debug('🔍 Dados extraídos do XML', {
                numero,
                codigoVerificacao: codigoVerificacao ? codigoVerificacao.substring(0, 8) + '...' : null,
                success: !!(numero && codigoVerificacao)
            });

            return {
                numero,
                codigoVerificacao
            };

        } catch (error) {
            this.logger.error('❌ Erro ao extrair dados do XML', {
                error: error.message
            });
            return {
                numero: null,
                codigoVerificacao: null
            };
        }
    }

    /**
     * Verifica duplicatas por conteúdo (hash MD5) - versão otimizada com cache
     */
    async checkContentDuplicate(filePath, cnpjPath) {
        try {
            if (!await this.fs.pathExists(filePath)) {
                this.logger.debug('Arquivo não existe para verificação de duplicata', { filePath });
                return null;
            }

            // Verificar se diretório CNPJ existe
            if (!await this.fs.pathExists(cnpjPath)) {
                this.logger.debug('Diretório CNPJ não existe', { cnpjPath });
                return null;
            }

            // Verificar cache de duplicatas primeiro
            const cacheKey = this.cacheManager.generateDuplicateKey(filePath, cnpjPath, 'md5');
            const cachedResult = this.cacheManager.getDuplicateCache(cacheKey);
            if (cachedResult !== null) {
                this.logger.debug('Resultado de duplicata obtido do cache', {
                    file: this.path.basename(filePath),
                    cached: true
                });
                return cachedResult;
            }

            // Verificar cache de hash primeiro
            let fileHash = this.cacheManager.getHashCache(filePath);
            if (!fileHash) {
                const fileContent = await this.fs.readFile(filePath);
                fileHash = this.crypto.createHash('md5').update(fileContent).digest('hex');

                // Armazenar hash no cache
                this.cacheManager.setHashCache(filePath, fileHash);

                this.logger.debug('Hash MD5 calculado e armazenado no cache', {
                    file: this.path.basename(filePath),
                    hash: fileHash.substring(0, 8),
                    size: fileContent.length
                });
            } else {
                this.logger.debug('Hash MD5 obtido do cache', {
                    file: this.path.basename(filePath),
                    hash: fileHash.substring(0, 8)
                });
            }

            // Verificar todos os arquivos XML no diretório CNPJ
            const files = await this.fs.readdir(cnpjPath);
            const xmlFiles = files.filter(file => file.endsWith('.xml'));

            this.logger.debug('Verificando duplicatas por hash', {
                newFile: this.path.basename(filePath),
                existingFiles: xmlFiles.length,
                cnpjPath
            });

            for (const existingFile of xmlFiles) {
                const existingPath = this.path.join(cnpjPath, existingFile);

                try {
                    // Verificar cache de hash para arquivo existente
                    let existingHash = this.cacheManager.getHashCache(existingPath);
                    if (!existingHash) {
                        const existingContent = await this.fs.readFile(existingPath);
                        existingHash = this.crypto.createHash('md5').update(existingContent).digest('hex');

                        // Armazenar no cache
                        this.cacheManager.setHashCache(existingPath, existingHash);
                    }

                    if (fileHash === existingHash) {
                        this.logger.info('🔄 Duplicata detectada por conteúdo MD5', {
                            newFile: this.path.basename(filePath),
                            existingFile,
                            hash: fileHash.substring(0, 8)
                        });

                        // Armazenar resultado no cache
                        this.cacheManager.setDuplicateCache(cacheKey, existingFile);
                        return existingFile;
                    }
                } catch (fileError) {
                    this.logger.debug('Erro ao ler arquivo existente para comparação', {
                        existingFile,
                        error: fileError.message
                    });
                    continue;
                }
            }

            this.logger.debug('Nenhuma duplicata encontrada por hash MD5', {
                newFile: this.path.basename(filePath),
                checkedFiles: xmlFiles.length
            });

            // Armazenar resultado negativo no cache
            this.cacheManager.setDuplicateCache(cacheKey, null);
            return null;

        } catch (error) {
            this.logger.debug('Erro ao verificar duplicata por conteúdo', {
                filePath,
                error: error.message
            });
            return null;
        }
    }

    /**
     * Verifica duplicatas por padrões avançados de nome (alternativa ao MD5)
     */
    async checkAdvancedNameDuplicate(fileName, cnpjPath) {
        try {
            if (!await this.fs.pathExists(cnpjPath)) {
                return null;
            }

            // Extrair múltiplos padrões do nome do arquivo
            const patterns = this.extractFilePatterns(fileName);

            if (patterns.length === 0) {
                this.logger.debug('Nenhum padrão identificável encontrado', { fileName });
                return null;
            }

            // Verificar todos os arquivos XML no diretório
            const files = await this.fs.readdir(cnpjPath);
            const xmlFiles = files.filter(file => file.endsWith('.xml'));

            this.logger.debug('🔍 Verificando padrões avançados', {
                fileName,
                patterns,
                existingFiles: xmlFiles.length
            });

            for (const existingFile of xmlFiles) {
                // Verificar se algum padrão coincide
                for (const pattern of patterns) {
                    if (existingFile.includes(pattern)) {
                        this.logger.info('🔄 Duplicata detectada por padrão avançado', {
                            newFile: fileName,
                            existingFile,
                            matchedPattern: pattern
                        });
                        return existingFile;
                    }
                }
            }

            return null;

        } catch (error) {
            this.logger.debug('Erro ao verificar duplicata por padrão avançado', {
                fileName,
                error: error.message
            });
            return null;
        }
    }

    /**
     * Extrai padrões identificáveis do nome do arquivo
     */
    extractFilePatterns(fileName) {
        const patterns = [];

        // Padrão 1: Número da nota fiscal (9-10 dígitos)
        const noteMatch = fileName.match(/(\d{9,10})/);
        if (noteMatch) {
            patterns.push(noteMatch[1]);
        }

        // Padrão 2: Data no formato DDMMAAAA
        const dateMatch = fileName.match(/(\d{8})/);
        if (dateMatch && dateMatch[1] !== noteMatch?.[1]) {
            patterns.push(dateMatch[1]);
        }

        // Padrão 3: Timestamp completo
        const timestampMatch = fileName.match(/(\d{14})/);
        if (timestampMatch) {
            patterns.push(timestampMatch[1]);
        }

        // Padrão 4: Sequência de 6-8 dígitos (fallback)
        const sequenceMatch = fileName.match(/(\d{6,8})/g);
        if (sequenceMatch) {
            sequenceMatch.forEach(seq => {
                if (!patterns.includes(seq)) {
                    patterns.push(seq);
                }
            });
        }

        return patterns;
    }

    /**
     * Move arquivo para estrutura organizada com verificação de duplicatas e competência
     */
    async organizeFile(sourceFile, cnpj, startDate) {
        try {
            const fileName = this.path.basename(sourceFile);

            // Extrair competência real do arquivo XML
            const realCompetencia = await this.extractCompetenciaFromXML(sourceFile);
            const finalStartDate = realCompetencia || startDate;

            if (realCompetencia && realCompetencia !== startDate) {
                this.logger.info('📅 Competência real detectada no XML', {
                    fileName,
                    cnpj: this.maskCNPJ(cnpj),
                    startDateOriginal: startDate,
                    competenciaReal: realCompetencia
                });
            }

            const cnpjPath = await this.createCNPJStructure(cnpj, finalStartDate);

            // Verificar se arquivo já existe por nome exato
            const fileExists = await this.checkFileExists(fileName, cnpjPath);
            if (fileExists) {
                this.logger.info('🔄 Arquivo já existe (nome exato), removendo temporário', {
                    fileName,
                    cnpj: this.maskCNPJ(cnpj),
                    competencia: finalStartDate
                });
                await this.fs.remove(sourceFile);
                return { skipped: true, reason: 'file_exists', fileName };
            }

            // Verificar duplicata por nome exato do arquivo
            const nameDuplicate = await this.checkFileNameDuplicate(fileName, cnpjPath);
            if (nameDuplicate) {
                this.logger.info('🔄 Duplicata detectada por nome exato, removendo temporário', {
                    fileName,
                    duplicateOf: nameDuplicate,
                    cnpj: this.maskCNPJ(cnpj)
                });
                await this.fs.remove(sourceFile);
                return { skipped: true, reason: 'name_duplicate', fileName, duplicateOf: nameDuplicate };
            }

            // VERIFICAÇÃO PRINCIPAL: Duplicata por conteúdo XML (Número + CodigoVerificacao)
            this.logger.debug('🔍 Verificando duplicata por conteúdo XML (Número + CodigoVerificacao)...');
            const xmlDuplicate = await this.checkXMLContentDuplicate(sourceFile, cnpjPath);
            if (xmlDuplicate) {
                this.logger.info('🔄 DUPLICATA DETECTADA por conteúdo XML (Número + Código), removendo temporário', {
                    fileName,
                    duplicateOf: xmlDuplicate,
                    cnpj: this.maskCNPJ(cnpj)
                });
                await this.fs.remove(sourceFile);
                return { skipped: true, reason: 'xml_content_duplicate', fileName, duplicateOf: xmlDuplicate };
            }

            // VERIFICAÇÃO ADICIONAL: Duplicata por hash MD5 (fallback)
            this.logger.debug('🔍 Verificando duplicata por hash MD5...');
            const contentDuplicate = await this.checkContentDuplicate(sourceFile, cnpjPath);
            if (contentDuplicate) {
                this.logger.info('🔄 Duplicata detectada por conteúdo MD5, removendo temporário', {
                    fileName,
                    duplicateOf: contentDuplicate,
                    cnpj: this.maskCNPJ(cnpj)
                });
                await this.fs.remove(sourceFile);
                return { skipped: true, reason: 'content_duplicate', fileName, duplicateOf: contentDuplicate };
            }
            
            // Mover arquivo para estrutura organizada
            const targetPath = this.path.join(cnpjPath, fileName);
            await this.fs.move(sourceFile, targetPath);

            this.logger.success('📁 Arquivo organizado com sucesso', {
                fileName,
                cnpj: this.maskCNPJ(cnpj),
                competencia: finalStartDate,
                targetPath: targetPath.replace(this.config.get('download.path'), 'downloads'),
                competenciaDetectada: realCompetencia ? 'sim' : 'não'
            });

            return {
                organized: true,
                fileName,
                targetPath,
                competencia: finalStartDate,
                competenciaDetectada: !!realCompetencia
            };

        } catch (error) {
            this.logger.error('Erro ao organizar arquivo', {
                sourceFile,
                cnpj: this.maskCNPJ(cnpj),
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Lista arquivos existentes para um CNPJ específico - VERSÃO ROBUSTA
     */
    async listCNPJFiles(cnpj, startDate) {
        try {
            const [year, month] = startDate.split('-');
            const baseDownloadPath = this.config.get('download.path');

            // Usar path.resolve para garantir caminho absoluto correto
            const cnpjPath = this.path.resolve(baseDownloadPath, year, month, cnpj);

            // Verificar se diretório existe
            let pathExists;
            try {
                const fsModule = this.fs.default || this.fs;
                pathExists = await fsModule.pathExists(cnpjPath);
            } catch (pathError) {
                this.logger.error('Erro ao verificar path', { error: pathError.message });
                return [];
            }

            if (!pathExists) {
                return [];
            }

            // Ler arquivos do diretório
            let files;
            try {
                const fsModule = this.fs.default || this.fs;
                files = await fsModule.readdir(cnpjPath);
            } catch (readdirError) {
                this.logger.error('Erro ao ler diretório', { error: readdirError.message });
                return [];
            }

            // Filtrar apenas arquivos XML
            const xmlFiles = files.filter(file => {
                const isXml = file.toLowerCase().endsWith('.xml');
                const isNotTemp = !file.endsWith('.crdownload') && !file.startsWith('.');
                return isXml && isNotTemp;
            });

            // Obter detalhes dos arquivos XML
            const fileDetails = [];
            const fsModule = this.fs.default || this.fs;
            const pathModule = this.path.default || this.path;

            for (const file of xmlFiles) {
                try {
                    const filePath = pathModule.join(cnpjPath, file);
                    const stats = await fsModule.stat(filePath);
                    fileDetails.push({
                        name: file,
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime
                    });
                } catch (statError) {
                    this.logger.warn('⚠️ Erro ao obter stats do arquivo', {
                        file,
                        error: statError.message
                    });
                    // Continuar com outros arquivos
                }
            }

            // Log otimizado apenas se houver arquivos
            if (fileDetails.length > 0) {
                this.logger.file('Arquivos encontrados', {
                    cnpj: this.maskCNPJ(cnpj),
                    count: fileDetails.length
                });
            }

            return fileDetails;

        } catch (error) {
            this.logger.error('❌ ERRO GERAL ao listar arquivos do CNPJ', {
                cnpj: this.maskCNPJ(cnpj),
                startDate,
                error: error.message,
                stack: error.stack
            });
            return [];
        }
    }

    /**
     * Constrói caminho do diretório usando path.join (melhores práticas)
     */
    buildPath(base, ...segments) {
        // Usar path.join para garantir separadores corretos
        return this.path.join(base, ...segments);
    }

    /**
     * Extrai competência real do arquivo XML
     */
    async extractCompetenciaFromXML(filePath) {
        try {
            // Ler conteúdo do arquivo XML
            const xmlContent = await this.fs.readFile(filePath, 'utf8');

            // Buscar por diferentes padrões de data/competência
            const patterns = [
                // Padrão 1: <Competencia>2025-07-04 17:28:26.910071</Competencia>
                /<Competencia>(\d{4}-\d{2}-\d{2})/i,
                // Padrão 2: <DataEmissao>2025-07-04 17:28:27</DataEmissao>
                /<DataEmissao>(\d{4}-\d{2}-\d{2})/i,
                // Padrão 3: <DataEmissaoRps>2025-07-04</DataEmissaoRps>
                /<DataEmissaoRps>(\d{4}-\d{2}-\d{2})/i,
                // Padrão 4: Qualquer data no formato YYYY-MM-DD
                /(\d{4}-\d{2}-\d{2})/
            ];

            for (const pattern of patterns) {
                const match = xmlContent.match(pattern);
                if (match && match[1]) {
                    const dateStr = match[1];

                    // Validar se é uma data válida
                    const date = new Date(dateStr);
                    if (!isNaN(date.getTime())) {
                        // Retornar no formato YYYY-MM-DD
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const competencia = `${year}-${month}-01`;

                        this.logger.debug('🔍 Competência extraída do XML', {
                            arquivo: this.path.basename(filePath),
                            dataEncontrada: dateStr,
                            competenciaFinal: competencia,
                            padrao: pattern.source
                        });

                        return competencia;
                    }
                }
            }

            this.logger.debug('⚠️ Nenhuma competência válida encontrada no XML', {
                arquivo: this.path.basename(filePath)
            });

            return null;

        } catch (error) {
            this.logger.warn('Erro ao extrair competência do XML', {
                arquivo: this.path.basename(filePath),
                error: error.message
            });
            return null;
        }
    }

    /**
     * Mascara CNPJ para logs (segurança)
     */
    maskCNPJ(cnpj) {
        if (!cnpj || cnpj.length < 8) return cnpj;
        return cnpj.substring(0, 4) + '****' + cnpj.substring(cnpj.length - 4);
    }

    /**
     * Obtém estatísticas de arquivos por CNPJ
     */
    async getCNPJStats(cnpj, startDate) {
        try {
            const files = await this.listCNPJFiles(cnpj, startDate);
            const totalSize = files.reduce((sum, file) => sum + file.size, 0);
            
            return {
                cnpj: this.maskCNPJ(cnpj),
                fileCount: files.length,
                totalSize,
                files: files.map(f => ({ name: f.name, size: f.size }))
            };
            
        } catch (error) {
            this.logger.debug('Erro ao obter estatísticas do CNPJ', {
                cnpj: this.maskCNPJ(cnpj),
                error: error.message
            });
            return { cnpj: this.maskCNPJ(cnpj), fileCount: 0, totalSize: 0, files: [] };
        }
    }
}
