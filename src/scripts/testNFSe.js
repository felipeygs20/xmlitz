#!/usr/bin/env node

/**
 * Script para testar o sistema de NFSe
 * Processa arquivos XML de exemplo
 */

import path from 'path';
import { NFSeIngestService } from '../core/NFSeIngestService.js';
import { logger } from '../utils/OptimizedLogger.js';

async function testNFSeSystem() {
    logger.system('Testando sistema de NFSe...');

    try {
        // 1. Inicializar serviço
        const ingestService = new NFSeIngestService();
        await ingestService.initialize();

        // 2. Processar arquivos baixados (exemplo)
        const testCnpj = '32800353000162';
        const testYear = '2025';
        const testMonth = '07';

        logger.system(`Processando arquivos baixados para CNPJ ${testCnpj}`);
        
        const result = await ingestService.processDownloadedFiles(testCnpj, testYear, testMonth);
        
        logger.success('Processamento concluído', result);

        // 3. Testar consultas
        if (result.success > 0) {
            logger.system('Testando consultas...');

            // Estatísticas gerais
            const stats = await ingestService.getGeneralStats();
            logger.system('Estatísticas gerais', stats);

            // Buscar por prestador
            const nfseByPrestador = await ingestService.findNFSeByPrestador(testCnpj, 5);
            logger.system(`NFSe encontradas para prestador ${testCnpj}`, {
                count: nfseByPrestador.length,
                samples: nfseByPrestador.slice(0, 2)
            });

            // Buscar por período
            const nfseByPeriod = await ingestService.findNFSeByPeriod('2025-07-01', '2025-08-01', 5);
            logger.system('NFSe encontradas por período', {
                count: nfseByPeriod.length,
                samples: nfseByPeriod.slice(0, 2)
            });
        }

        await ingestService.close();
        logger.success('Teste concluído com sucesso!');

    } catch (error) {
        logger.error('Erro no teste', {
            error: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
    testNFSeSystem();
}
