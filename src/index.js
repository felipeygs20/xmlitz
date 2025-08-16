#!/usr/bin/env node

/**
 * XMLITZ - Sistema de Download de XMLs NFSe
 * Entry point principal para execução via CLI
 * 
 * @version 2.0.0
 * @author XMLITZ Team
 */

import { XMLITZOrchestrator } from './core/XMLITZOrchestrator.js';
import { ConfigManager } from './config/ConfigManager.js';
import { logger } from './utils/OptimizedLogger.js';
import { ErrorHandler } from './utils/ErrorHandler.js';

/**
 * Função principal do CLI
 */
async function main() {
    const loggerInstance = logger;
    const errorHandler = ErrorHandler.getInstance();

    try {
        // Banner do sistema
        displayBanner();

        // Solicitar credenciais via argumentos ou prompt
        const credentials = await getCredentialsFromArgs();

        if (!credentials.username || !credentials.password) {
            console.error('\n❌ Erro: Credenciais são obrigatórias!');
            console.log('\n💡 Use:');
            console.log('   npm start -- --cnpj=SEU_CNPJ --senha=SUA_SENHA');
            console.log('   ou');
            console.log('   node src/index.js --cnpj=SEU_CNPJ --senha=SUA_SENHA');
            process.exit(1);
        }

        // Carregar configurações
        const config = ConfigManager.getInstance();
        await config.load();

        // Aplicar credenciais dinâmicas
        config.set('credentials.username', credentials.username);
        config.set('credentials.password', credentials.password);

        loggerInstance.info('Sistema XMLITZ iniciado', {
            version: '2.0.0',
            environment: process.env.NODE_ENV || 'development',
            cnpj: maskCNPJ(credentials.username)
        });

        // Criar e executar orchestrator
        const orchestrator = new XMLITZOrchestrator(config);
        const report = await orchestrator.execute();
        
        // Verificar resultados
        if (report.success && report.xmlsDownloaded > 0) {
            loggerInstance.info('Execução finalizada com sucesso', {
                xmlsDownloaded: report.xmlsDownloaded,
                duration: report.duration
            });
            
            console.log('\n🎉 Execução finalizada com sucesso!');
            console.log(`📁 ${report.xmlsDownloaded} XMLs baixados em ${report.duration}s`);
            process.exit(0);
        } else {
            loggerInstance.warn('Nenhum XML foi baixado', report);
            console.log('\n⚠️ Nenhum XML foi baixado.');
            console.log('💡 Verifique as credenciais e o período de pesquisa.');
            process.exit(1);
        }
        
    } catch (error) {
        errorHandler.handle(error, 'main');
        
        console.error('\n💥 Erro fatal:', error.message);
        console.log('\n🔧 Dicas para solução:');
        console.log('   • Verifique sua conexão com a internet');
        console.log('   • Confirme se as credenciais estão corretas');
        console.log('   • Tente executar novamente em alguns minutos');
        console.log('   • Verifique se o site está acessível');
        
        process.exit(1);
    }
}

/**
 * Obtém credenciais dos argumentos da linha de comando
 */
async function getCredentialsFromArgs() {
    const args = process.argv.slice(2);
    const credentials = {
        username: null,
        password: null
    };

    for (const arg of args) {
        if (arg.startsWith('--cnpj=')) {
            credentials.username = arg.split('=')[1];
        } else if (arg.startsWith('--senha=')) {
            credentials.password = arg.split('=')[1];
        }
    }

    return credentials;
}

/**
 * Mascara CNPJ para logs
 */
function maskCNPJ(cnpj) {
    if (!cnpj || cnpj.length < 8) return cnpj;
    return cnpj.substring(0, 4) + '****' + cnpj.substring(cnpj.length - 4);
}

/**
 * Exibe o banner do sistema
 */
function displayBanner() {
    console.log('╔' + '═'.repeat(68) + '╗');
    console.log('║' + ' '.repeat(68) + '║');
    console.log('║' + '🚀 XMLITZ - Sistema de Download de XMLs NFSe v2.0'.padEnd(68) + '║');
    console.log('║' + '📋 Prefeitura de Imperatriz/MA - Portal NFSe'.padEnd(68) + '║');
    console.log('║' + ' '.repeat(68) + '║');
    console.log('║' + '✨ Funcionalidades:'.padEnd(68) + '║');
    console.log('║' + '   • Login automático com tratamento de alertas'.padEnd(68) + '║');
    console.log('║' + '   • Pesquisa por período configurável'.padEnd(68) + '║');
    console.log('║' + '   • Download em lote de XMLs'.padEnd(68) + '║');
    console.log('║' + '   • Relatórios detalhados de progresso'.padEnd(68) + '║');
    console.log('║' + '   • Arquitetura modular e escalável'.padEnd(68) + '║');
    console.log('║' + '   • Credenciais dinâmicas via parâmetros'.padEnd(68) + '║');
    console.log('║' + ' '.repeat(68) + '║');
    console.log('║' + '💡 Uso: npm start -- --cnpj=SEU_CNPJ --senha=SUA_SENHA'.padEnd(68) + '║');
    console.log('║' + ' '.repeat(68) + '║');
    console.log('╚' + '═'.repeat(68) + '╝');
    console.log('');
}

/**
 * Tratamento de sinais para limpeza adequada
 */
function setupSignalHandlers() {
    process.on('SIGINT', () => {
        console.log('\n⚠️ Processo interrompido pelo usuário');
        process.exit(130);
    });

    process.on('SIGTERM', () => {
        console.log('\n⚠️ Processo terminado');
        process.exit(143);
    });

    process.on('uncaughtException', (error) => {
        const errorHandler = ErrorHandler.getInstance();
        errorHandler.handle(error, 'uncaughtException');
        process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
        const errorHandler = ErrorHandler.getInstance();
        errorHandler.handle(new Error(`Unhandled Rejection: ${reason}`), 'unhandledRejection');
        process.exit(1);
    });
}

// Configurar handlers de sinal
setupSignalHandlers();

// Executar função principal
main().catch(error => {
    const errorHandler = ErrorHandler.getInstance();
    errorHandler.handle(error, 'main-catch');
    process.exit(1);
});
