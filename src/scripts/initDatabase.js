#!/usr/bin/env node

/**
 * Script para inicializar o banco de dados NFSe
 * Cria as tabelas e índices necessários
 */

import { NFSeDatabase } from '../core/NFSeDatabase.js';
import { logger } from '../utils/OptimizedLogger.js';

async function initDatabase() {
    logger.system('Inicializando banco de dados NFSe...');

    try {
        const database = new NFSeDatabase();
        await database.initialize();
        
        const stats = database.getGeneralStats();
        
        logger.success('Banco de dados inicializado com sucesso', {
            dbPath: database.dbPath,
            stats
        });

        database.close();

    } catch (error) {
        logger.error('Erro ao inicializar banco de dados', {
            error: error.message
        });
        process.exit(1);
    }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
    initDatabase();
}
