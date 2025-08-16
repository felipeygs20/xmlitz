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

        const downloadPath = path.join(process.cwd(), 'downloads', year, month, cnpj);
        
        logger.system(`Processando arquivos baixados`, {
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

            return await this.processDirectory(downloadPath, `xmlitz-${cnpj}`);

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
