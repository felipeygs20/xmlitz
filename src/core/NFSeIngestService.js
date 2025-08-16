/**
 * Serviço de ingestão de NFSe
 * Processa arquivos XML e armazena no banco de dados
 */

import path from 'path';
import fs from 'fs-extra';
import { NFSeParser } from './NFSeParser.js';
import { NFSeDatabase } from './NFSeDatabase.js';
import { logger } from '../utils/OptimizedLogger.js';

export class NFSeIngestService {
    constructor() {
        this.parser = new NFSeParser();
        this.database = new NFSeDatabase();
        this.isInitialized = false;
    }

    /**
     * Inicializa o serviço
     */
    async initialize() {
        try {
            await this.database.initialize();
            this.isInitialized = true;
            logger.system('Serviço de ingestão NFSe inicializado');
        } catch (error) {
            logger.error('Erro ao inicializar serviço de ingestão', { 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Processa um arquivo XML individual
     */
    async processFile(filePath, source = 'sistema') {
        this.ensureInitialized();

        logger.system(`Iniciando ingestão de arquivo: ${filePath}`);

        try {
            // 1. Verificar se arquivo existe
            const exists = await fs.pathExists(filePath);
            if (!exists) {
                throw new Error(`Arquivo não encontrado: ${filePath}`);
            }

            // 2. Processar XML
            const result = await this.parser.processXMLFile(filePath, source);

            // 3. Armazenar no banco
            const dbResult = this.database.processBatch(result.batch, result.nfseList);

            logger.success('Arquivo ingerido com sucesso', {
                file: filePath,
                batchId: dbResult.batchId,
                inserted: dbResult.insertedCount,
                duplicates: dbResult.duplicateCount,
                total: dbResult.totalCount
            });

            return {
                success: true,
                batchId: dbResult.batchId,
                filename: result.batch.filename,
                totalNFSe: result.batch.totalNfse,
                processedNFSe: result.batch.processedNfse,
                insertedNFSe: dbResult.insertedCount,
                duplicateNFSe: dbResult.duplicateCount,
                filePath
            };

        } catch (error) {
            logger.error('Erro ao processar arquivo', {
                filePath,
                error: error.message
            });

            return {
                success: false,
                error: error.message,
                filePath
            };
        }
    }

    /**
     * Processa múltiplos arquivos XML
     */
    async processFiles(filePaths, source = 'sistema') {
        this.ensureInitialized();

        logger.system(`Iniciando ingestão de ${filePaths.length} arquivos`);

        const results = [];
        let successCount = 0;
        let errorCount = 0;

        for (const filePath of filePaths) {
            try {
                const result = await this.processFile(filePath, source);
                results.push(result);

                if (result.success) {
                    successCount++;
                } else {
                    errorCount++;
                }

            } catch (error) {
                logger.error('Erro ao processar arquivo', {
                    filePath,
                    error: error.message
                });

                results.push({
                    success: false,
                    error: error.message,
                    filePath
                });
                errorCount++;
            }
        }

        logger.success('Ingestão em lote concluída', {
            total: filePaths.length,
            success: successCount,
            errors: errorCount
        });

        return {
            total: filePaths.length,
            success: successCount,
            errors: errorCount,
            results
        };
    }

    /**
     * Processa diretório de arquivos XML
     */
    async processDirectory(dirPath, source = 'sistema', pattern = '*.xml') {
        this.ensureInitialized();

        logger.system(`Processando diretório: ${dirPath}`);

        try {
            // 1. Verificar se diretório existe
            const exists = await fs.pathExists(dirPath);
            if (!exists) {
                throw new Error(`Diretório não encontrado: ${dirPath}`);
            }

            // 2. Listar arquivos XML
            const files = await fs.readdir(dirPath);
            const xmlFiles = files
                .filter(file => file.toLowerCase().endsWith('.xml'))
                .map(file => path.join(dirPath, file));

            if (xmlFiles.length === 0) {
                logger.warn('Nenhum arquivo XML encontrado no diretório', { dirPath });
                return {
                    total: 0,
                    success: 0,
                    errors: 0,
                    results: []
                };
            }

            logger.system(`Encontrados ${xmlFiles.length} arquivos XML`);

            // 3. Processar arquivos
            return await this.processFiles(xmlFiles, source);

        } catch (error) {
            logger.error('Erro ao processar diretório', {
                dirPath,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Processa arquivos baixados pelo sistema XMLITZ
     */
    async processDownloadedFiles(cnpj, year, month) {
        this.ensureInitialized();

        // Usar o caminho correto do ConfigManager
        const { ConfigManager } = await import('../config/ConfigManager.js');
        const config = ConfigManager.getInstance();
        const baseDownloadPath = config.get('download.path');

        // Construir caminho seguindo a mesma estrutura do BrowserManager
        const downloadPath = path.join(baseDownloadPath, year, month, cnpj);

        logger.system(`🚀 Processando arquivos baixados`, {
            cnpj: this.maskCNPJ(cnpj),
            path: downloadPath
        });

        try {
            const exists = await fs.pathExists(downloadPath);
            if (!exists) {
                logger.warn('Diretório de downloads não encontrado', { downloadPath });
                return {
                    total: 0,
                    success: 0,
                    errors: 0,
                    results: []
                };
            }

            // Primeiro, reorganizar arquivos por competência real
            await this.reorganizeFilesByCompetencia(baseDownloadPath, cnpj);

            // Depois processar todos os diretórios de competência para este CNPJ
            return await this.processAllCompetenciasForCNPJ(baseDownloadPath, cnpj);

        } catch (error) {
            logger.error('Erro ao processar arquivos baixados', {
                cnpj: this.maskCNPJ(cnpj),
                downloadPath,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Busca NFSe por número
     */
    async findNFSeByNumero(numero) {
        this.ensureInitialized();
        return this.database.findByNumero(numero);
    }

    /**
     * Busca NFSe por CNPJ do prestador
     */
    async findNFSeByPrestador(cnpj, limit = 100) {
        this.ensureInitialized();
        return this.database.findByPrestadorCnpj(cnpj, limit);
    }

    /**
     * Busca NFSe por período
     */
    async findNFSeByPeriod(startDate, endDate, limit = 100) {
        this.ensureInitialized();
        return this.database.findByPeriod(startDate, endDate, limit);
    }

    /**
     * Obtém estatísticas dos lotes
     */
    async getBatchStats() {
        this.ensureInitialized();
        return this.database.getBatchStats();
    }

    /**
     * Obtém estatísticas gerais
     */
    async getGeneralStats() {
        this.ensureInitialized();
        return this.database.getGeneralStats();
    }

    /**
     * Obtém estatísticas por CNPJ
     */
    async getStatsByCNPJ(limit = 50) {
        this.ensureInitialized();
        return this.database.getStatsByCNPJ(limit);
    }

    /**
     * Obtém estatísticas detalhadas de um CNPJ específico
     */
    async getDetailedStatsByCNPJ(cnpj) {
        this.ensureInitialized();
        return this.database.getDetailedStatsByCNPJ(cnpj);
    }

    /**
     * Obtém estatísticas por competência
     */
    async getStatsByCompetencia(limit = 24) {
        this.ensureInitialized();
        return this.database.getStatsByCompetencia(limit);
    }

    /**
     * Obtém estatísticas detalhadas de uma competência específica
     */
    async getDetailedStatsByCompetencia(ano, mes) {
        this.ensureInitialized();
        return this.database.getDetailedStatsByCompetencia(ano, mes);
    }

    /**
     * Obtém estatísticas de downloads por CNPJ
     */
    async getDownloadStatsByCNPJ() {
        this.ensureInitialized();
        return this.database.getDownloadStatsByCNPJ();
    }

    /**
     * Reorganiza arquivos por competência real extraída do XML
     */
    async reorganizeFilesByCompetencia(baseDownloadPath, cnpj) {
        try {
            logger.system('🔄 Reorganizando arquivos por competência real', {
                cnpj: this.maskCNPJ(cnpj)
            });

            // Buscar todos os arquivos XML deste CNPJ em todas as pastas
            const allFiles = await this.findAllXMLFilesForCNPJ(baseDownloadPath, cnpj);

            if (allFiles.length === 0) {
                logger.info('Nenhum arquivo XML encontrado para reorganizar');
                return;
            }

            logger.info(`📁 Encontrados ${allFiles.length} arquivos para verificar competência`);

            let reorganized = 0;
            let errors = 0;

            for (const filePath of allFiles) {
                try {
                    const moved = await this.moveFileToCorrectCompetencia(filePath, cnpj, baseDownloadPath);
                    if (moved) reorganized++;
                } catch (error) {
                    logger.warn('Erro ao reorganizar arquivo', {
                        arquivo: path.basename(filePath),
                        error: error.message
                    });
                    errors++;
                }
            }

            logger.success('✅ Reorganização por competência concluída', {
                cnpj: this.maskCNPJ(cnpj),
                total: allFiles.length,
                reorganized,
                errors
            });

        } catch (error) {
            logger.error('Erro na reorganização por competência', {
                cnpj: this.maskCNPJ(cnpj),
                error: error.message
            });
        }
    }

    /**
     * Processa todas as competências para um CNPJ
     */
    async processAllCompetenciasForCNPJ(baseDownloadPath, cnpj) {
        try {
            logger.system('🚀 Processando todas as competências', {
                cnpj: this.maskCNPJ(cnpj)
            });

            // Buscar todas as pastas de competência que contêm arquivos deste CNPJ
            const competenciasPaths = await this.findCompetenciasForCNPJ(baseDownloadPath, cnpj);

            if (competenciasPaths.length === 0) {
                logger.warn('Nenhuma competência encontrada para processar');
                return {
                    total: 0,
                    success: 0,
                    errors: 0,
                    results: []
                };
            }

            logger.info(`📅 Processando ${competenciasPaths.length} competências`, {
                competencias: competenciasPaths.map(p => p.competencia)
            });

            let totalResults = {
                total: 0,
                success: 0,
                errors: 0,
                results: []
            };

            // Processar cada competência
            for (const competenciaPath of competenciasPaths) {
                try {
                    logger.info(`📊 Processando competência ${competenciaPath.competencia}`);
                    const result = await this.processDirectory(competenciaPath.path, `xmlitz-${cnpj}-${competenciaPath.competencia}`);

                    totalResults.total += result.total;
                    totalResults.success += result.success;
                    totalResults.errors += result.errors;
                    totalResults.results.push(...result.results);

                } catch (error) {
                    logger.error(`Erro ao processar competência ${competenciaPath.competencia}`, {
                        error: error.message
                    });
                    totalResults.errors++;
                }
            }

            logger.success('✅ Processamento de todas as competências concluído', {
                cnpj: this.maskCNPJ(cnpj),
                competenciasProcessadas: competenciasPaths.length,
                ...totalResults
            });

            return totalResults;

        } catch (error) {
            logger.error('Erro no processamento de competências', {
                cnpj: this.maskCNPJ(cnpj),
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Encontra todos os arquivos XML de um CNPJ em todas as pastas
     */
    async findAllXMLFilesForCNPJ(baseDownloadPath, cnpj) {
        const allFiles = [];

        try {
            // Buscar em todas as pastas de ano
            const yearDirs = await fs.readdir(baseDownloadPath);

            for (const yearDir of yearDirs) {
                const yearPath = path.join(baseDownloadPath, yearDir);
                const yearStat = await fs.stat(yearPath);

                if (!yearStat.isDirectory()) continue;

                // Buscar em todas as pastas de mês
                const monthDirs = await fs.readdir(yearPath);

                for (const monthDir of monthDirs) {
                    const monthPath = path.join(yearPath, monthDir);
                    const monthStat = await fs.stat(monthPath);

                    if (!monthStat.isDirectory()) continue;

                    // Verificar se existe pasta do CNPJ
                    const cnpjPath = path.join(monthPath, cnpj);
                    const cnpjExists = await fs.pathExists(cnpjPath);

                    if (cnpjExists) {
                        const files = await fs.readdir(cnpjPath);
                        const xmlFiles = files
                            .filter(file => file.toLowerCase().endsWith('.xml'))
                            .map(file => path.join(cnpjPath, file));

                        allFiles.push(...xmlFiles);
                    }
                }
            }

        } catch (error) {
            logger.warn('Erro ao buscar arquivos XML', { error: error.message });
        }

        return allFiles;
    }

    /**
     * Move arquivo para competência correta baseada no conteúdo XML
     */
    async moveFileToCorrectCompetencia(filePath, cnpj, baseDownloadPath) {
        try {
            // Extrair competência real do XML
            const realCompetencia = await this.extractCompetenciaFromXML(filePath);

            if (!realCompetencia) {
                return false; // Não conseguiu extrair competência
            }

            // Verificar se já está na pasta correta
            const currentPath = path.dirname(filePath);
            const [year, month] = realCompetencia.split('-');
            const correctPath = path.join(baseDownloadPath, year, month, cnpj);

            if (currentPath === correctPath) {
                return false; // Já está na pasta correta
            }

            // Criar estrutura de diretório se não existir
            await fs.ensureDir(correctPath);

            // Mover arquivo
            const fileName = path.basename(filePath);
            const newFilePath = path.join(correctPath, fileName);

            // Verificar se arquivo já existe no destino
            const exists = await fs.pathExists(newFilePath);
            if (exists) {
                logger.info('📁 Arquivo já existe na competência correta, removendo duplicata', {
                    arquivo: fileName,
                    competencia: `${year}/${month}`,
                    cnpj: this.maskCNPJ(cnpj)
                });
                await fs.remove(filePath);
                return true;
            }

            await fs.move(filePath, newFilePath);

            logger.success('📅 Arquivo movido para competência correta', {
                arquivo: fileName,
                competenciaAnterior: path.dirname(filePath).split(path.sep).slice(-2).join('/'),
                competenciaCorreta: `${year}/${month}`,
                cnpj: this.maskCNPJ(cnpj)
            });

            return true;

        } catch (error) {
            logger.warn('Erro ao mover arquivo para competência correta', {
                arquivo: path.basename(filePath),
                error: error.message
            });
            return false;
        }
    }

    /**
     * Extrai competência do arquivo XML (mesmo método do FileManagerService)
     */
    async extractCompetenciaFromXML(filePath) {
        try {
            const xmlContent = await fs.readFile(filePath, 'utf8');

            const patterns = [
                /<Competencia>(\d{4}-\d{2}-\d{2})/i,
                /<DataEmissao>(\d{4}-\d{2}-\d{2})/i,
                /<DataEmissaoRps>(\d{4}-\d{2}-\d{2})/i,
                /(\d{4}-\d{2}-\d{2})/
            ];

            for (const pattern of patterns) {
                const match = xmlContent.match(pattern);
                if (match && match[1]) {
                    const date = new Date(match[1]);
                    if (!isNaN(date.getTime())) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        return `${year}-${month}-01`;
                    }
                }
            }

            return null;

        } catch (error) {
            return null;
        }
    }

    /**
     * Encontra todas as competências que contêm arquivos de um CNPJ
     */
    async findCompetenciasForCNPJ(baseDownloadPath, cnpj) {
        const competencias = [];

        try {
            const yearDirs = await fs.readdir(baseDownloadPath);

            for (const yearDir of yearDirs) {
                const yearPath = path.join(baseDownloadPath, yearDir);
                const yearStat = await fs.stat(yearPath);

                if (!yearStat.isDirectory()) continue;

                const monthDirs = await fs.readdir(yearPath);

                for (const monthDir of monthDirs) {
                    const cnpjPath = path.join(yearPath, monthDir, cnpj);
                    const cnpjExists = await fs.pathExists(cnpjPath);

                    if (cnpjExists) {
                        const files = await fs.readdir(cnpjPath);
                        const xmlFiles = files.filter(file => file.toLowerCase().endsWith('.xml'));

                        if (xmlFiles.length > 0) {
                            competencias.push({
                                competencia: `${yearDir}/${monthDir}`,
                                path: cnpjPath,
                                year: yearDir,
                                month: monthDir,
                                fileCount: xmlFiles.length
                            });
                        }
                    }
                }
            }

        } catch (error) {
            logger.warn('Erro ao buscar competências', { error: error.message });
        }

        return competencias;
    }

    /**
     * Mascara CNPJ para logs
     */
    maskCNPJ(cnpj) {
        if (!cnpj || cnpj.length < 8) return cnpj;
        return cnpj.substring(0, 4) + '****' + cnpj.substring(cnpj.length - 4);
    }

    /**
     * Verifica se o serviço foi inicializado
     */
    ensureInitialized() {
        if (!this.isInitialized) {
            throw new Error('Serviço de ingestão não foi inicializado');
        }
    }

    /**
     * Fecha o serviço
     */
    async close() {
        if (this.database) {
            this.database.close();
        }
        this.isInitialized = false;
        logger.debug('Serviço de ingestão NFSe fechado');
    }
}
