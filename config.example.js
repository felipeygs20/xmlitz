// ==================== ARQUIVO DE CONFIGURAÇÃO DE EXEMPLO ====================
// Copie este arquivo para config.local.js e configure suas credenciais

const CONFIG_EXAMPLE = {
    // ==================== CREDENCIAIS (OBRIGATÓRIO) ====================
    CNPJ: 'SEU_CNPJ_AQUI',           // Ex: '12345678000199'
    SENHA: 'SUA_SENHA_AQUI',         // Sua senha do sistema

    // ==================== PERÍODO DE BUSCA ====================
    DATA_INICIAL: '2025-07-01',      // Formato: YYYY-MM-DD
    DATA_FINAL: '2025-08-01',        // Formato: YYYY-MM-DD

    // ==================== CONFIGURAÇÕES DO NAVEGADOR ====================
    HEADLESS: false,                 // true = sem interface gráfica
    TIMEOUT: 15000,                  // Timeout geral (ms)
    DEBUG: true,                     // Logs detalhados

    // ==================== PERFORMANCE ====================
    NAVIGATION_TIMEOUT: 10000,       // Timeout para navegação (ms)
    DOWNLOAD_TIMEOUT: 8000,          // Timeout por download (ms)
    ELEMENT_TIMEOUT: 5000,           // Timeout para encontrar elementos (ms)
    
    PARALLEL_DOWNLOADS: 2,           // Downloads simultâneos (1-3 recomendado)
    DELAY_BETWEEN_DOWNLOADS: 500,    // Delay entre downloads (ms)
    
    // ==================== SISTEMA DE RETRY ====================
    MAX_RETRIES: 5,                  // Número máximo de tentativas
    RETRY_DELAY: 2000,               // Delay entre tentativas (ms)
    EXPONENTIAL_BACKOFF: true,       // Backoff exponencial
    
    // ==================== VALIDAÇÃO ====================
    VALIDATE_XML: true,              // Validar estrutura XML
    CHECK_FILE_SIZE: true,           // Verificar tamanho mínimo
    MIN_FILE_SIZE: 100,              // Tamanho mínimo em bytes
    DUPLICATE_CHECK: true,           // Verificar duplicatas
    SMART_DUPLICATE_HANDLING: true,  // Tratamento inteligente de duplicatas
    
    // ==================== ORGANIZAÇÃO AUTOMÁTICA ====================
    AUTO_ORGANIZE: true,             // Organizar arquivos automaticamente
    ORGANIZE_BASE_DIR: 'organized',  // Diretório base para organização
    
    // ==================== LOGGING ====================
    LOG_LEVEL: 'DEBUG',              // DEBUG, INFO, WARN, ERROR
    LOG_TO_FILE: true,               // Salvar logs em arquivo
    LOG_FILE: 'nfse-detailed.log',   // Nome do arquivo de log
    PERFORMANCE_METRICS: true,       // Métricas de performance
    
    // ==================== DIRETÓRIOS ====================
    DOWNLOAD_DIR: './xmls-nfse',     // Diretório de download
    
    // ==================== URLS DO SISTEMA ====================
    LOGIN_URL: 'https://imperatriz-ma.prefeituramoderna.com.br/meuiss_new/nfe/?pg=login_nfe'
};

// ==================== CONFIGURAÇÕES AVANÇADAS ====================

// Para desenvolvimento/teste
const DEV_CONFIG = {
    ...CONFIG_EXAMPLE,
    HEADLESS: false,
    DEBUG: true,
    PARALLEL_DOWNLOADS: 1,
    LOG_LEVEL: 'DEBUG'
};

// Para produção
const PROD_CONFIG = {
    ...CONFIG_EXAMPLE,
    HEADLESS: true,
    DEBUG: false,
    PARALLEL_DOWNLOADS: 3,
    LOG_LEVEL: 'INFO'
};

// ==================== INSTRUÇÕES DE USO ====================
/*
1. Copie este arquivo para config.local.js
2. Configure suas credenciais (CNPJ e SENHA)
3. Ajuste o período de busca (DATA_INICIAL e DATA_FINAL)
4. Personalize outras configurações conforme necessário
5. Execute: node nfse-downloader.js

IMPORTANTE:
- Nunca commite o arquivo config.local.js (está no .gitignore)
- Mantenha suas credenciais seguras
- Teste com períodos pequenos primeiro
- Monitore os logs para identificar problemas
*/

module.exports = {
    CONFIG_EXAMPLE,
    DEV_CONFIG,
    PROD_CONFIG
};
