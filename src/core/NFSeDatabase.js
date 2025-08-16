/**
 * Serviço de banco de dados SQLite para NFSe
 * Gerencia armazenamento de lotes e documentos NFSe
 */

import Database from 'better-sqlite3';
import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/OptimizedLogger.js';

export class NFSeDatabase {
    constructor(dbPath = 'database/nfse.db') {
        this.dbPath = dbPath;
        this.db = null;
        this.isInitialized = false;
    }

    /**
     * Inicializa o banco de dados
     */
    async initialize() {
        try {
            // Garantir que o diretório existe
            const dbDir = path.dirname(this.dbPath);
            await fs.ensureDir(dbDir);

            // Conectar ao banco
            this.db = new Database(this.dbPath);
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('foreign_keys = ON');

            // Executar schema
            await this.createTables();
            
            this.isInitialized = true;
            logger.system('Banco de dados NFSe inicializado', { dbPath: this.dbPath });

        } catch (error) {
            logger.error('Erro ao inicializar banco de dados', { 
                dbPath: this.dbPath,
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Cria as tabelas do banco
     */
    async createTables() {
        try {
            // Criar tabelas diretamente com SQL inline
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS nfse_batches (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source TEXT NOT NULL,
                    filename TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    raw_xml TEXT,
                    checksum TEXT UNIQUE NOT NULL,
                    size_bytes INTEGER,
                    encoding TEXT DEFAULT 'utf-8',
                    total_nfse INTEGER DEFAULT 0,
                    processed_nfse INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'pending',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);

            this.db.exec(`
                CREATE TABLE IF NOT EXISTS nfse_docs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    batch_id INTEGER NOT NULL,
                    numero TEXT NOT NULL,
                    codigo_verificacao TEXT,
                    data_emissao DATETIME,
                    competencia DATETIME,
                    prestador_cnpj TEXT,
                    prestador_razao_social TEXT,
                    prestador_inscricao_municipal TEXT,
                    tomador_cnpj TEXT,
                    tomador_razao_social TEXT,
                    valor_servicos DECIMAL(15,2),
                    valor_liquido DECIMAL(15,2),
                    valor_iss DECIMAL(15,2),
                    aliquota DECIMAL(5,4),
                    base_calculo DECIMAL(15,2),
                    item_lista_servico TEXT,
                    codigo_cnae TEXT,
                    discriminacao TEXT,
                    codigo_municipio TEXT,
                    json_data TEXT,
                    checksum TEXT UNIQUE NOT NULL,
                    size_bytes INTEGER,
                    processed BOOLEAN DEFAULT 1,
                    status TEXT DEFAULT 'active',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (batch_id) REFERENCES nfse_batches(id) ON DELETE CASCADE
                );
            `);

            // Criar índices
            this.db.exec(`CREATE INDEX IF NOT EXISTS idx_nfse_batches_checksum ON nfse_batches(checksum);`);
            this.db.exec(`CREATE INDEX IF NOT EXISTS idx_nfse_batches_created_at ON nfse_batches(created_at);`);
            this.db.exec(`CREATE INDEX IF NOT EXISTS idx_nfse_docs_batch_id ON nfse_docs(batch_id);`);
            this.db.exec(`CREATE INDEX IF NOT EXISTS idx_nfse_docs_numero ON nfse_docs(numero);`);
            this.db.exec(`CREATE INDEX IF NOT EXISTS idx_nfse_docs_prestador_cnpj ON nfse_docs(prestador_cnpj);`);
            this.db.exec(`CREATE INDEX IF NOT EXISTS idx_nfse_docs_data_emissao ON nfse_docs(data_emissao);`);
            this.db.exec(`CREATE INDEX IF NOT EXISTS idx_nfse_docs_checksum ON nfse_docs(checksum);`);

            logger.debug('Schema do banco criado com sucesso');

        } catch (error) {
            logger.error('Erro ao criar schema do banco', {
                error: error.message
            });
            throw error;
        }
    }



    /**
     * Insere um lote de NFSe
     */
    insertBatch(batchData) {
        this.ensureInitialized();

        const stmt = this.db.prepare(`
            INSERT INTO nfse_batches (
                source, filename, file_path, raw_xml, checksum, 
                size_bytes, encoding, total_nfse, processed_nfse, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        try {
            const result = stmt.run(
                batchData.source,
                batchData.filename,
                batchData.filePath,
                batchData.rawXml,
                batchData.checksum,
                batchData.sizeBytes,
                batchData.encoding,
                batchData.totalNfse,
                batchData.processedNfse,
                'completed'
            );

            logger.debug('Lote inserido no banco', { 
                batchId: result.lastInsertRowid,
                filename: batchData.filename 
            });

            return result.lastInsertRowid;

        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                logger.warn('Lote já existe no banco', { 
                    checksum: batchData.checksum,
                    filename: batchData.filename 
                });
                
                // Retornar ID do lote existente
                const existing = this.db.prepare('SELECT id FROM nfse_batches WHERE checksum = ?')
                    .get(batchData.checksum);
                return existing?.id;
            }
            
            logger.error('Erro ao inserir lote', { 
                error: error.message,
                filename: batchData.filename 
            });
            throw error;
        }
    }

    /**
     * Insere uma NFSe
     */
    insertNFSe(batchId, nfseData) {
        this.ensureInitialized();

        const stmt = this.db.prepare(`
            INSERT INTO nfse_docs (
                batch_id, numero, codigo_verificacao, data_emissao, competencia,
                prestador_cnpj, prestador_razao_social, prestador_inscricao_municipal,
                tomador_cnpj, tomador_razao_social,
                valor_servicos, valor_liquido, valor_iss, aliquota, base_calculo,
                item_lista_servico, codigo_cnae, discriminacao, codigo_municipio,
                json_data, checksum, size_bytes, processed, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        try {
            // Sanitizar dados para SQLite (converter undefined para null)
            const sanitizedData = this.sanitizeDataForSQLite(nfseData);

            const result = stmt.run(
                batchId,
                sanitizedData.numero,
                sanitizedData.codigoVerificacao,
                sanitizedData.dataEmissao,
                sanitizedData.competencia,
                sanitizedData.prestadorCnpj,
                sanitizedData.prestadorRazaoSocial,
                sanitizedData.prestadorInscricaoMunicipal,
                sanitizedData.tomadorCnpj,
                sanitizedData.tomadorRazaoSocial,
                sanitizedData.valorServicos,
                sanitizedData.valorLiquido,
                sanitizedData.valorIss,
                sanitizedData.aliquota,
                sanitizedData.baseCalculo,
                sanitizedData.itemListaServico,
                sanitizedData.codigoCnae,
                sanitizedData.discriminacao,
                sanitizedData.codigoMunicipio,
                sanitizedData.jsonData,
                sanitizedData.checksum,
                sanitizedData.sizeBytes,
                1, // true como 1
                'active'
            );

            return result.lastInsertRowid;

        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                logger.debug('NFSe já existe no banco', {
                    numero: nfseData.numero,
                    checksum: nfseData.checksum
                });
                return null; // Duplicata ignorada
            }

            logger.error('Erro ao inserir NFSe', {
                error: error.message,
                numero: nfseData.numero,
                data: nfseData
            });
            throw error;
        }
    }

    /**
     * Sanitiza dados para SQLite (converte undefined para null)
     */
    sanitizeDataForSQLite(data) {
        const sanitized = {};

        for (const [key, value] of Object.entries(data)) {
            if (value === undefined) {
                sanitized[key] = null;
            } else if (typeof value === 'boolean') {
                sanitized[key] = value ? 1 : 0;
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    /**
     * Processa um lote completo (transação)
     */
    processBatch(batchData, nfseList) {
        this.ensureInitialized();

        const transaction = this.db.transaction(() => {
            // 1. Inserir lote
            const batchId = this.insertBatch(batchData);
            
            // 2. Inserir NFSe
            let insertedCount = 0;
            let duplicateCount = 0;
            
            for (const nfseData of nfseList) {
                const nfseId = this.insertNFSe(batchId, nfseData);
                if (nfseId) {
                    insertedCount++;
                } else {
                    duplicateCount++;
                }
            }

            // 3. Atualizar estatísticas do lote
            this.db.prepare(`
                UPDATE nfse_batches 
                SET processed_nfse = ? 
                WHERE id = ?
            `).run(insertedCount, batchId);

            return {
                batchId,
                insertedCount,
                duplicateCount,
                totalCount: nfseList.length
            };
        });

        try {
            const result = transaction();
            
            logger.success('Lote processado com sucesso', {
                batchId: result.batchId,
                inserted: result.insertedCount,
                duplicates: result.duplicateCount,
                total: result.totalCount
            });

            return result;

        } catch (error) {
            logger.error('Erro ao processar lote', { 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Busca NFSe por número
     */
    findByNumero(numero) {
        this.ensureInitialized();

        const stmt = this.db.prepare(`
            SELECT
                d.id,
                d.numero,
                d.data_emissao,
                d.prestador_cnpj,
                d.prestador_razao_social,
                d.tomador_cnpj,
                d.tomador_razao_social,
                d.valor_liquido,
                d.discriminacao,
                d.status,
                b.filename as batch_filename,
                b.created_at as batch_created_at
            FROM nfse_docs d
            JOIN nfse_batches b ON d.batch_id = b.id
            WHERE d.numero = ? AND d.status = 'active'
        `);

        return stmt.get(numero);
    }

    /**
     * Busca NFSe por CNPJ do prestador
     */
    findByPrestadorCnpj(cnpj, limit = 100) {
        this.ensureInitialized();

        const stmt = this.db.prepare(`
            SELECT
                d.id,
                d.numero,
                d.data_emissao,
                d.prestador_cnpj,
                d.prestador_razao_social,
                d.tomador_cnpj,
                d.tomador_razao_social,
                d.valor_liquido,
                d.discriminacao,
                d.status,
                b.filename as batch_filename,
                b.created_at as batch_created_at
            FROM nfse_docs d
            JOIN nfse_batches b ON d.batch_id = b.id
            WHERE d.prestador_cnpj = ? AND d.status = 'active'
            ORDER BY d.data_emissao DESC
            LIMIT ?
        `);

        return stmt.all(cnpj, limit);
    }

    /**
     * Busca NFSe por período
     */
    findByPeriod(startDate, endDate, limit = 100) {
        this.ensureInitialized();

        const stmt = this.db.prepare(`
            SELECT
                d.id,
                d.numero,
                d.data_emissao,
                d.prestador_cnpj,
                d.prestador_razao_social,
                d.tomador_cnpj,
                d.tomador_razao_social,
                d.valor_liquido,
                d.discriminacao,
                d.status,
                b.filename as batch_filename,
                b.created_at as batch_created_at
            FROM nfse_docs d
            JOIN nfse_batches b ON d.batch_id = b.id
            WHERE d.data_emissao BETWEEN ? AND ? AND d.status = 'active'
            ORDER BY d.data_emissao DESC
            LIMIT ?
        `);

        return stmt.all(startDate, endDate, limit);
    }

    /**
     * Estatísticas dos lotes
     */
    getBatchStats() {
        this.ensureInitialized();
        
        const stmt = this.db.prepare(`
            SELECT * FROM v_batch_stats 
            ORDER BY created_at DESC
        `);
        
        return stmt.all();
    }

    /**
     * Estatísticas gerais
     */
    getGeneralStats() {
        this.ensureInitialized();

        const stats = this.db.prepare(`
            SELECT
                COUNT(*) as total_batches,
                SUM(total_nfse) as total_nfse_files,
                SUM(processed_nfse) as total_nfse_processed,
                SUM(size_bytes) as total_size_bytes
            FROM nfse_batches
        `).get();

        const nfseStats = this.db.prepare(`
            SELECT
                COUNT(*) as total_nfse_docs,
                COUNT(DISTINCT prestador_cnpj) as unique_prestadores,
                COUNT(DISTINCT tomador_cnpj) as unique_tomadores,
                SUM(valor_liquido) as total_valor_liquido,
                MIN(data_emissao) as oldest_nfse,
                MAX(data_emissao) as newest_nfse
            FROM nfse_docs
            WHERE status = 'active'
        `).get();

        return { ...stats, ...nfseStats };
    }

    /**
     * Estatísticas por CNPJ do prestador
     */
    getStatsByCNPJ(limit = 50) {
        this.ensureInitialized();

        const stmt = this.db.prepare(`
            SELECT
                prestador_cnpj,
                prestador_razao_social,
                COUNT(*) as total_nfse,
                SUM(valor_liquido) as total_valor_liquido,
                AVG(valor_liquido) as valor_medio,
                MIN(data_emissao) as primeira_emissao,
                MAX(data_emissao) as ultima_emissao,
                COUNT(DISTINCT DATE(data_emissao)) as dias_com_emissao,
                COUNT(DISTINCT tomador_cnpj) as total_tomadores
            FROM nfse_docs
            WHERE status = 'active' AND prestador_cnpj IS NOT NULL
            GROUP BY prestador_cnpj, prestador_razao_social
            ORDER BY total_valor_liquido DESC
            LIMIT ?
        `);

        return stmt.all(limit);
    }

    /**
     * Estatísticas detalhadas de um CNPJ específico
     */
    getDetailedStatsByCNPJ(cnpj) {
        this.ensureInitialized();

        // Estatísticas gerais do CNPJ
        const generalStats = this.db.prepare(`
            SELECT
                prestador_cnpj,
                prestador_razao_social,
                COUNT(*) as total_nfse,
                SUM(valor_liquido) as total_valor_liquido,
                AVG(valor_liquido) as valor_medio,
                MIN(valor_liquido) as menor_valor,
                MAX(valor_liquido) as maior_valor,
                MIN(data_emissao) as primeira_emissao,
                MAX(data_emissao) as ultima_emissao,
                COUNT(DISTINCT tomador_cnpj) as total_tomadores,
                COUNT(DISTINCT DATE(data_emissao)) as dias_com_emissao
            FROM nfse_docs
            WHERE status = 'active' AND prestador_cnpj = ?
            GROUP BY prestador_cnpj, prestador_razao_social
        `).get(cnpj);

        if (!generalStats) {
            return null;
        }

        // Estatísticas por mês
        const monthlyStats = this.db.prepare(`
            SELECT
                strftime('%Y-%m', data_emissao) as mes,
                COUNT(*) as total_nfse,
                SUM(valor_liquido) as total_valor_liquido,
                AVG(valor_liquido) as valor_medio
            FROM nfse_docs
            WHERE status = 'active' AND prestador_cnpj = ?
            GROUP BY strftime('%Y-%m', data_emissao)
            ORDER BY mes DESC
            LIMIT 12
        `).all(cnpj);

        // Top tomadores
        const topTomadores = this.db.prepare(`
            SELECT
                tomador_cnpj,
                tomador_razao_social,
                COUNT(*) as total_nfse,
                SUM(valor_liquido) as total_valor_liquido
            FROM nfse_docs
            WHERE status = 'active' AND prestador_cnpj = ?
            GROUP BY tomador_cnpj, tomador_razao_social
            ORDER BY total_valor_liquido DESC
            LIMIT 10
        `).all(cnpj);

        return {
            ...generalStats,
            monthly_stats: monthlyStats,
            top_tomadores: topTomadores
        };
    }

    /**
     * Estatísticas por competência (mês/ano)
     */
    getStatsByCompetencia(limit = 24) {
        this.ensureInitialized();

        const stmt = this.db.prepare(`
            SELECT
                strftime('%Y-%m', competencia) as competencia,
                strftime('%Y', competencia) as ano,
                strftime('%m', competencia) as mes,
                COUNT(*) as total_nfse,
                SUM(valor_liquido) as total_valor_liquido,
                AVG(valor_liquido) as valor_medio,
                COUNT(DISTINCT prestador_cnpj) as total_prestadores,
                COUNT(DISTINCT tomador_cnpj) as total_tomadores,
                MIN(valor_liquido) as menor_valor,
                MAX(valor_liquido) as maior_valor
            FROM nfse_docs
            WHERE status = 'active' AND competencia IS NOT NULL
            GROUP BY strftime('%Y-%m', competencia)
            ORDER BY competencia DESC
            LIMIT ?
        `);

        return stmt.all(limit);
    }

    /**
     * Estatísticas detalhadas de uma competência específica
     */
    getDetailedStatsByCompetencia(ano, mes) {
        this.ensureInitialized();

        const competenciaFilter = mes ? `${ano}-${mes.padStart(2, '0')}` : ano;
        const datePattern = mes ? `${ano}-${mes.padStart(2, '0')}-%` : `${ano}-%`;

        // Estatísticas gerais da competência
        const generalStats = this.db.prepare(`
            SELECT
                strftime('%Y-%m', competencia) as competencia,
                COUNT(*) as total_nfse,
                SUM(valor_liquido) as total_valor_liquido,
                AVG(valor_liquido) as valor_medio,
                MIN(valor_liquido) as menor_valor,
                MAX(valor_liquido) as maior_valor,
                COUNT(DISTINCT prestador_cnpj) as total_prestadores,
                COUNT(DISTINCT tomador_cnpj) as total_tomadores,
                COUNT(DISTINCT DATE(data_emissao)) as dias_com_emissao
            FROM nfse_docs
            WHERE status = 'active' AND competencia LIKE ?
            GROUP BY strftime('%Y-%m', competencia)
        `).get(datePattern);

        if (!generalStats) {
            return null;
        }

        // Top prestadores da competência
        const topPrestadores = this.db.prepare(`
            SELECT
                prestador_cnpj,
                prestador_razao_social,
                COUNT(*) as total_nfse,
                SUM(valor_liquido) as total_valor_liquido,
                AVG(valor_liquido) as valor_medio
            FROM nfse_docs
            WHERE status = 'active' AND competencia LIKE ?
            GROUP BY prestador_cnpj, prestador_razao_social
            ORDER BY total_valor_liquido DESC
            LIMIT 10
        `).all(datePattern);

        // Distribuição por dia (se for mês específico)
        let dailyDistribution = [];
        if (mes) {
            dailyDistribution = this.db.prepare(`
                SELECT
                    DATE(data_emissao) as dia,
                    COUNT(*) as total_nfse,
                    SUM(valor_liquido) as total_valor_liquido
                FROM nfse_docs
                WHERE status = 'active' AND competencia LIKE ?
                GROUP BY DATE(data_emissao)
                ORDER BY dia
            `).all(datePattern);
        }

        return {
            ...generalStats,
            top_prestadores: topPrestadores,
            daily_distribution: dailyDistribution
        };
    }

    /**
     * Estatísticas de downloads e erros por CNPJ
     */
    getDownloadStatsByCNPJ() {
        this.ensureInitialized();

        // Como não temos uma tabela específica de downloads, vamos usar os logs de processamento
        // e inferir informações dos batches
        const stmt = this.db.prepare(`
            SELECT
                SUBSTR(b.filename, 1, 14) as cnpj_from_filename,
                COUNT(DISTINCT b.id) as total_downloads,
                SUM(b.total_nfse) as total_xmls_baixados,
                COUNT(CASE WHEN b.status = 'error' THEN 1 END) as downloads_com_erro,
                MAX(b.created_at) as ultima_consulta,
                SUM(b.size_bytes) as total_size_bytes
            FROM nfse_batches b
            GROUP BY SUBSTR(b.filename, 1, 14)
            ORDER BY ultima_consulta DESC
        `);

        return stmt.all();
    }

    /**
     * Verifica se o banco foi inicializado
     */
    ensureInitialized() {
        if (!this.isInitialized || !this.db) {
            throw new Error('Banco de dados não foi inicializado');
        }
    }

    /**
     * Fecha a conexão com o banco
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.isInitialized = false;
            logger.debug('Conexão com banco de dados fechada');
        }
    }
}
