#!/usr/bin/env node

// ==================== SCRIPT DE ORGANIZAÇÃO AUTOMÁTICA DE XMLs NFSe ====================
// Este script organiza os arquivos XML NFSe baixados em uma estrutura hierárquica
// baseada em competência (mês/ano) e CNPJ do prestador.

const fs = require('fs');
const path = require('path');

// Importar classes do sistema principal
const { XMLOrganizer, AdvancedLogger } = (() => {
    try {
        // Tentar importar do arquivo principal
        const mainScript = require('./nfse-downloader.js');
        return mainScript;
    } catch (error) {
        // Se não conseguir importar, definir classes básicas aqui
        console.error('Erro ao importar classes principais. Usando implementação básica.');
        
        class BasicLogger {
            info(msg) { console.log(`[INFO] ${msg}`); }
            success(msg) { console.log(`[SUCCESS] ${msg}`); }
            error(msg) { console.error(`[ERROR] ${msg}`); }
            warn(msg) { console.warn(`[WARN] ${msg}`); }
            debug(msg) { console.log(`[DEBUG] ${msg}`); }
        }
        
        return { XMLOrganizer: null, AdvancedLogger: BasicLogger };
    }
})();

// Configurações
const CONFIG = {
    SOURCE_DIR: path.join(__dirname, 'xmls-nfse'),
    BASE_DIR: path.join(__dirname, 'xmls-nfse', 'organized'),
    DEBUG: true
};

// Logger
const Logger = XMLOrganizer ? new AdvancedLogger() : new (class {
    info(msg) { console.log(`[INFO] ${new Date().toLocaleTimeString()} - ${msg}`); }
    success(msg) { console.log(`✅ [SUCCESS] ${new Date().toLocaleTimeString()} - ${msg}`); }
    error(msg) { console.error(`❌ [ERROR] ${new Date().toLocaleTimeString()} - ${msg}`); }
    warn(msg) { console.warn(`⚠️ [WARN] ${new Date().toLocaleTimeString()} - ${msg}`); }
    debug(msg) { if (CONFIG.DEBUG) console.log(`🔍 [DEBUG] ${new Date().toLocaleTimeString()} - ${msg}`); }
})();

// Função principal
async function main() {
    try {
        console.log('🗂️ ==================== ORGANIZADOR DE XMLs NFSe ====================');
        console.log('📄 Este script organiza arquivos XML NFSe em estrutura hierárquica');
        console.log('📁 Estrutura: YYYY/MMYYYY/CNPJ/arquivo.xml');
        console.log('='.repeat(70));

        // Verificar se o diretório de origem existe
        if (!fs.existsSync(CONFIG.SOURCE_DIR)) {
            throw new Error(`Diretório de origem não encontrado: ${CONFIG.SOURCE_DIR}`);
        }

        // Verificar se há arquivos XML
        const files = fs.readdirSync(CONFIG.SOURCE_DIR);
        const xmlFiles = files.filter(file => 
            file.toLowerCase().endsWith('.xml') && 
            !file.startsWith('.') &&
            !file.includes('organized')
        );

        if (xmlFiles.length === 0) {
            Logger.warn('Nenhum arquivo XML encontrado para organizar');
            console.log('\n📋 Dica: Coloque os arquivos XML na pasta "xmls-nfse"');
            return;
        }

        Logger.info(`Encontrados ${xmlFiles.length} arquivos XML para organizar:`);
        xmlFiles.forEach((file, index) => {
            console.log(`   ${index + 1}. ${file}`);
        });

        console.log('\n🚀 Iniciando organização...\n');

        if (XMLOrganizer) {
            // Usar organizador completo
            const organizer = new XMLOrganizer();
            const report = await organizer.organizeAllFiles(CONFIG.SOURCE_DIR, CONFIG.BASE_DIR);
            organizer.displayOrganizationSummary(report);
        } else {
            // Implementação básica de fallback
            Logger.error('Sistema de organização não disponível. Execute o script principal primeiro.');
            return;
        }

        console.log('\n🎉 Organização concluída com sucesso!');
        console.log(`📁 Arquivos organizados em: ${CONFIG.BASE_DIR}`);

    } catch (error) {
        Logger.error(`Erro durante a organização: ${error.message}`);
        console.error('\n💡 Soluções possíveis:');
        console.error('   1. Verifique se os arquivos XML estão na pasta "xmls-nfse"');
        console.error('   2. Verifique se os arquivos XML são válidos');
        console.error('   3. Execute o script principal primeiro: node nfse-downloader.js');
        process.exit(1);
    }
}

// Verificar se está sendo executado diretamente
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Erro fatal:', error.message);
        process.exit(1);
    });
}

module.exports = { main, CONFIG };
