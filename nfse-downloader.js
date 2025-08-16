#!/usr/bin/env node

/**
 * NFSe XML Downloader - Imperatriz-MA
 * 
 * Script de automação para download de XMLs de NFSe do sistema de Imperatriz-MA
 * Baseado nos arquivos recorde_joson e recorde_puptier
 * 
 * Uso: node nfse-downloader.js
 * 
 * Configurações podem ser alteradas nas constantes abaixo
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// ==================== CONFIGURAÇÕES OTIMIZADAS ====================
const CONFIG = {
    // Credenciais (ALTERE AQUI)
    CNPJ: '34194865000158',
    SENHA: '123456',

    // Período de busca (ALTERE AQUI) - Formato YYYY-MM-DD como no record
    DATA_INICIAL: '2025-07-01',
    DATA_FINAL: '2025-08-01',

    // Configurações do navegador otimizadas
    HEADLESS: true,
    TIMEOUT: 15000, // Reduzido para 15s para falhas mais rápidas
    DEBUG: true,

    // Performance otimizada
    NAVIGATION_TIMEOUT: 10000, // 10s para navegação
    DOWNLOAD_TIMEOUT: 8000, // 8s para cada download
    ELEMENT_TIMEOUT: 5000, // 5s para encontrar elementos

    // Configurações de download otimizadas
    DOWNLOAD_DIR: path.join(__dirname, 'xmls-nfse'),
    DELAY_BETWEEN_DOWNLOADS: 500, // Reduzido para 500ms
    PARALLEL_DOWNLOADS: 2, // Downloads paralelos (máximo 2 para não sobrecarregar)

    // Sistema de retry robusto
    MAX_RETRIES: 5, // Aumentado para 5 tentativas
    RETRY_DELAY: 2000, // Reduzido para 2s
    EXPONENTIAL_BACKOFF: true, // Backoff exponencial

    // Validação e verificação
    VALIDATE_XML: true, // Validar estrutura XML
    CHECK_FILE_SIZE: true, // Verificar tamanho mínimo
    MIN_FILE_SIZE: 100, // Tamanho mínimo em bytes
    DUPLICATE_CHECK: true, // Verificar duplicatas
    SMART_DUPLICATE_HANDLING: true, // Sobrescrever apenas se houver mudanças

    // Configurações de memória
    MAX_MEMORY_USAGE: 512 * 1024 * 1024, // 512MB
    GARBAGE_COLLECT_INTERVAL: 10, // A cada 10 downloads

    // Logging avançado
    LOG_LEVEL: 'DEBUG', // DEBUG, INFO, WARN, ERROR
    LOG_TO_FILE: true,
    LOG_FILE: 'nfse-detailed.log',
    PERFORMANCE_METRICS: true,

    // Organização automática
    AUTO_ORGANIZE: true, // Organizar arquivos automaticamente após download
    ORGANIZE_BASE_DIR: 'organized', // Diretório base para organização

    // URLs do sistema
    LOGIN_URL: 'https://imperatriz-ma.prefeituramoderna.com.br/meuiss_new/nfe/?pg=login_nfe'
};

// ==================== SISTEMA DE LOGGING AVANÇADO ====================
class AdvancedLogger {
    constructor() {
        this.startTime = Date.now();
        this.metrics = {
            downloads: { attempted: 0, successful: 0, failed: 0, retries: 0 },
            performance: { totalTime: 0, avgDownloadTime: 0, fastestDownload: Infinity, slowestDownload: 0 },
            errors: { network: 0, timeout: 0, validation: 0, other: 0 },
            files: { totalSize: 0, validXMLs: 0, duplicates: 0 }
        };
        this.downloadTimes = [];
    }

    _writeToFile(level, message, metrics = null) {
        if (!CONFIG.LOG_TO_FILE) return;

        try {
            const timestamp = new Date().toISOString();
            const logEntry = {
                timestamp,
                level,
                message,
                metrics: metrics || null,
                memoryUsage: process.memoryUsage(),
                uptime: Date.now() - this.startTime
            };

            const logLine = JSON.stringify(logEntry) + '\n';
            fs.appendFileSync(path.join(__dirname, CONFIG.LOG_FILE), logLine);
        } catch (error) {
            // Ignorar erros de escrita de log
        }
    }

    _shouldLog(level) {
        const levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
        return levels[level] >= levels[CONFIG.LOG_LEVEL];
    }

    _formatMessage(level, message) {
        const timestamp = new Date().toLocaleTimeString();
        const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
        return `[${level}] ${timestamp} (+${elapsed}s) - ${message}`;
    }

    info(message, metrics = null) {
        if (this._shouldLog('INFO')) {
            console.log(this._formatMessage('INFO', message));
            this._writeToFile('INFO', message, metrics);
        }
    }

    success(message, metrics = null) {
        if (this._shouldLog('INFO')) {
            console.log(`✅ ${this._formatMessage('SUCCESS', message)}`);
            this._writeToFile('SUCCESS', message, metrics);
        }
    }

    error(message, error = null, metrics = null) {
        if (this._shouldLog('ERROR')) {
            console.error(`❌ ${this._formatMessage('ERROR', message)}`);
            this._writeToFile('ERROR', message, { ...metrics, error: error?.stack });

            if (error) {
                this._categorizeError(error);
            }
        }
    }

    warn(message, metrics = null) {
        if (this._shouldLog('WARN')) {
            console.warn(`⚠️ ${this._formatMessage('WARN', message)}`);
            this._writeToFile('WARN', message, metrics);
        }
    }

    debug(message, metrics = null) {
        if (this._shouldLog('DEBUG')) {
            console.log(`🔍 ${this._formatMessage('DEBUG', message)}`);
            this._writeToFile('DEBUG', message, metrics);
        }
    }

    performance(operation, duration, details = null) {
        if (CONFIG.PERFORMANCE_METRICS) {
            const message = `${operation} completed in ${duration}ms`;
            this.debug(message, { operation, duration, details });

            if (operation === 'download') {
                this.downloadTimes.push(duration);
                this._updatePerformanceMetrics(duration);
            }
        }
    }

    _categorizeError(error) {
        const message = error.message.toLowerCase();
        if (message.includes('timeout') || message.includes('timed out')) {
            this.metrics.errors.timeout++;
        } else if (message.includes('network') || message.includes('connection')) {
            this.metrics.errors.network++;
        } else if (message.includes('xml') || message.includes('validation')) {
            this.metrics.errors.validation++;
        } else {
            this.metrics.errors.other++;
        }
    }

    _updatePerformanceMetrics(duration) {
        this.metrics.performance.fastestDownload = Math.min(this.metrics.performance.fastestDownload, duration);
        this.metrics.performance.slowestDownload = Math.max(this.metrics.performance.slowestDownload, duration);
        this.metrics.performance.avgDownloadTime = this.downloadTimes.reduce((a, b) => a + b, 0) / this.downloadTimes.length;
    }

    updateMetrics(type, operation, value = 1) {
        if (this.metrics[type] && this.metrics[type][operation] !== undefined) {
            this.metrics[type][operation] += value;
        }
    }

    getMetrics() {
        this.metrics.performance.totalTime = Date.now() - this.startTime;
        return { ...this.metrics };
    }

    generateReport() {
        const metrics = this.getMetrics();
        const successRate = metrics.downloads.attempted > 0
            ? ((metrics.downloads.successful / metrics.downloads.attempted) * 100).toFixed(1)
            : 0;

        return {
            summary: {
                totalTime: `${(metrics.performance.totalTime / 1000).toFixed(1)}s`,
                successRate: `${successRate}%`,
                downloadsAttempted: metrics.downloads.attempted,
                downloadsSuccessful: metrics.downloads.successful,
                downloadsFailed: metrics.downloads.failed,
                retries: metrics.downloads.retries
            },
            performance: {
                avgDownloadTime: `${metrics.performance.avgDownloadTime.toFixed(0)}ms`,
                fastestDownload: `${metrics.performance.fastestDownload}ms`,
                slowestDownload: `${metrics.performance.slowestDownload}ms`
            },
            files: {
                totalSize: `${(metrics.files.totalSize / 1024).toFixed(1)}KB`,
                validXMLs: metrics.files.validXMLs,
                duplicates: metrics.files.duplicates
            },
            errors: metrics.errors
        };
    }
}

// Instância global do logger
const Logger = new AdvancedLogger();

// ==================== SISTEMA DE ORGANIZAÇÃO AUTOMÁTICA ====================
class XMLOrganizer {
    constructor() {
        this.processedFiles = [];
        this.errors = [];
        this.stats = {
            total: 0,
            organized: 0,
            errors: 0,
            duplicates: 0,
            directoriesCreated: 0
        };
    }

    // Extrair dados do XML NFSe
    extractXMLData(xmlContent) {
        try {
            // Extrair competência (formato: 2025-07-18 10:37:35.434237)
            const competenciaMatch = xmlContent.match(/<Competencia>(.*?)<\/Competencia>/);
            if (!competenciaMatch) {
                throw new Error('Competência não encontrada no XML');
            }

            const competenciaStr = competenciaMatch[1].trim();
            const competenciaDate = new Date(competenciaStr);

            if (isNaN(competenciaDate.getTime())) {
                throw new Error(`Data de competência inválida: ${competenciaStr}`);
            }

            const year = competenciaDate.getFullYear();
            const month = String(competenciaDate.getMonth() + 1).padStart(2, '0');
            const competencia = `${month}${year}`;

            // Extrair CNPJ do prestador
            const prestadorCnpjMatch = xmlContent.match(/<PrestadorServico>[\s\S]*?<Cnpj>(.*?)<\/Cnpj>/);
            if (!prestadorCnpjMatch) {
                throw new Error('CNPJ do prestador não encontrado no XML');
            }

            const prestadorCnpj = prestadorCnpjMatch[1].trim();

            // Extrair CNPJ do tomador (pode não existir)
            const tomadorCnpjMatch = xmlContent.match(/<TomadorServico>[\s\S]*?<Cnpj>(.*?)<\/Cnpj>/);
            const tomadorCnpj = tomadorCnpjMatch ? tomadorCnpjMatch[1].trim() : null;

            // Extrair número da NFSe
            const numeroMatch = xmlContent.match(/<Numero>(.*?)<\/Numero>/);
            const numero = numeroMatch ? numeroMatch[1].trim() : 'SemNumero';

            // Validar CNPJ
            if (!this.isValidCNPJ(prestadorCnpj)) {
                throw new Error(`CNPJ do prestador inválido: ${prestadorCnpj}`);
            }

            if (tomadorCnpj && !this.isValidCNPJ(tomadorCnpj)) {
                Logger.warn(`CNPJ do tomador inválido: ${tomadorCnpj}`);
            }

            return {
                year,
                month,
                competencia,
                prestadorCnpj,
                tomadorCnpj,
                numero,
                valid: true
            };

        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    // Validar CNPJ (validação básica de formato)
    isValidCNPJ(cnpj) {
        if (!cnpj) return false;

        // Remover caracteres não numéricos
        const cleanCnpj = cnpj.replace(/\D/g, '');

        // Verificar se tem 14 dígitos
        if (cleanCnpj.length !== 14) return false;

        // Verificar se não são todos os dígitos iguais
        if (/^(\d)\1{13}$/.test(cleanCnpj)) return false;

        return true;
    }

    // Gerar caminho do diretório baseado nos dados extraídos
    generateDirectoryPath(xmlData, baseDir) {
        const { year, competencia, prestadorCnpj } = xmlData;
        return path.join(baseDir, String(year), competencia, prestadorCnpj);
    }

    // Criar estrutura de diretórios
    async createDirectoryStructure(dirPath) {
        try {
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
                this.stats.directoriesCreated++;
                Logger.debug(`Diretório criado: ${dirPath}`);
                return true;
            }
            return false;
        } catch (error) {
            throw new Error(`Erro ao criar diretório ${dirPath}: ${error.message}`);
        }
    }

    // Verificar se arquivo já existe no destino
    checkFileExists(destPath) {
        return fs.existsSync(destPath);
    }

    // Mover arquivo para o diretório organizado
    async moveFile(sourcePath, destPath) {
        try {
            // Verificar se arquivo de origem existe
            if (!fs.existsSync(sourcePath)) {
                throw new Error(`Arquivo de origem não encontrado: ${sourcePath}`);
            }

            // Verificar se destino já existe
            if (this.checkFileExists(destPath)) {
                // Comparar arquivos para ver se são idênticos
                const sourceContent = fs.readFileSync(sourcePath);
                const destContent = fs.readFileSync(destPath);

                if (sourceContent.equals(destContent)) {
                    Logger.info(`📄 Arquivo idêntico já existe, removendo duplicata: ${path.basename(sourcePath)}`);
                    fs.unlinkSync(sourcePath);
                    this.stats.duplicates++;
                    return { moved: false, reason: 'duplicate' };
                } else {
                    // Arquivos diferentes, criar nome único
                    const timestamp = Date.now();
                    const ext = path.extname(destPath);
                    const nameWithoutExt = path.basename(destPath, ext);
                    const dir = path.dirname(destPath);
                    const newDestPath = path.join(dir, `${nameWithoutExt}_${timestamp}${ext}`);

                    fs.renameSync(sourcePath, newDestPath);
                    Logger.info(`📁 Arquivo movido com nome único: ${path.basename(newDestPath)}`);
                    return { moved: true, path: newDestPath, reason: 'renamed' };
                }
            } else {
                // Mover arquivo normalmente
                fs.renameSync(sourcePath, destPath);
                Logger.info(`📁 Arquivo organizado: ${path.basename(destPath)}`);
                return { moved: true, path: destPath, reason: 'moved' };
            }

        } catch (error) {
            throw new Error(`Erro ao mover arquivo: ${error.message}`);
        }
    }

    // Processar um único arquivo XML
    async processFile(filePath, baseDir) {
        const fileName = path.basename(filePath);
        this.stats.total++;

        try {
            Logger.debug(`Processando arquivo: ${fileName}`);

            // Ler conteúdo do XML
            const xmlContent = fs.readFileSync(filePath, 'utf8');

            // Extrair dados do XML
            const xmlData = this.extractXMLData(xmlContent);

            if (!xmlData.valid) {
                throw new Error(`Dados inválidos no XML: ${xmlData.error}`);
            }

            Logger.debug(`Dados extraídos - Competência: ${xmlData.competencia}, CNPJ Prestador: ${xmlData.prestadorCnpj}, Número: ${xmlData.numero}`);

            // Gerar caminho do diretório de destino
            const destDir = this.generateDirectoryPath(xmlData, baseDir);

            // Criar estrutura de diretórios
            await this.createDirectoryStructure(destDir);

            // Caminho completo do arquivo de destino
            const destPath = path.join(destDir, fileName);

            // Mover arquivo
            const moveResult = await this.moveFile(filePath, destPath);

            // Registrar resultado
            const result = {
                fileName,
                sourcePath: filePath,
                destPath: moveResult.moved ? moveResult.path : destPath,
                xmlData,
                moveResult,
                success: true,
                timestamp: new Date().toISOString()
            };

            this.processedFiles.push(result);
            this.stats.organized++;

            Logger.success(`✅ ${fileName} organizado com sucesso`);
            return result;

        } catch (error) {
            const errorResult = {
                fileName,
                sourcePath: filePath,
                error: error.message,
                success: false,
                timestamp: new Date().toISOString()
            };

            this.errors.push(errorResult);
            this.stats.errors++;

            Logger.error(`❌ Erro ao processar ${fileName}: ${error.message}`);
            return errorResult;
        }
    }

    // Processar todos os arquivos XML em um diretório
    async organizeAllFiles(sourceDir, baseDir = null) {
        try {
            Logger.info('🗂️ Iniciando organização automática de arquivos XML...');

            // Usar diretório base padrão se não especificado
            if (!baseDir) {
                baseDir = path.join(sourceDir, 'organized');
            }

            // Verificar se diretório de origem existe
            if (!fs.existsSync(sourceDir)) {
                throw new Error(`Diretório de origem não encontrado: ${sourceDir}`);
            }

            // Encontrar todos os arquivos XML
            const files = fs.readdirSync(sourceDir);
            const xmlFiles = files.filter(file =>
                file.toLowerCase().endsWith('.xml') &&
                !file.startsWith('.')
            );

            if (xmlFiles.length === 0) {
                Logger.warn('Nenhum arquivo XML encontrado para organizar');
                return this.generateOrganizationReport();
            }

            Logger.info(`📄 Encontrados ${xmlFiles.length} arquivos XML para organizar`);

            // Processar cada arquivo
            for (const fileName of xmlFiles) {
                const filePath = path.join(sourceDir, fileName);
                await this.processFile(filePath, baseDir);

                // Pequeno delay para não sobrecarregar o sistema
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Gerar relatório final
            const report = this.generateOrganizationReport();
            Logger.success(`🎉 Organização concluída! ${this.stats.organized}/${this.stats.total} arquivos organizados`);

            return report;

        } catch (error) {
            Logger.error(`Erro na organização automática: ${error.message}`);
            throw error;
        }
    }

    // Gerar relatório de organização
    generateOrganizationReport() {
        const report = {
            timestamp: new Date().toISOString(),
            stats: { ...this.stats },
            processedFiles: this.processedFiles,
            errors: this.errors,
            summary: {
                successRate: this.stats.total > 0 ? ((this.stats.organized / this.stats.total) * 100).toFixed(1) : 0,
                directoriesCreated: this.stats.directoriesCreated,
                duplicatesFound: this.stats.duplicates
            }
        };

        // Salvar relatório em arquivo
        try {
            const reportPath = path.join(CONFIG.DOWNLOAD_DIR, `organization-report-${Date.now()}.json`);
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
            Logger.info(`📊 Relatório de organização salvo: ${reportPath}`);
        } catch (error) {
            Logger.warn(`Erro ao salvar relatório: ${error.message}`);
        }

        return report;
    }

    // Exibir resumo da organização
    displayOrganizationSummary(report) {
        console.log('\n' + '='.repeat(60));
        console.log('🗂️ RELATÓRIO DE ORGANIZAÇÃO AUTOMÁTICA');
        console.log('='.repeat(60));
        console.log(`📄 Total de arquivos: ${report.stats.total}`);
        console.log(`✅ Organizados com sucesso: ${report.stats.organized}`);
        console.log(`❌ Erros: ${report.stats.errors}`);
        console.log(`📁 Diretórios criados: ${report.stats.directoriesCreated}`);
        console.log(`🔄 Duplicatas encontradas: ${report.stats.duplicates}`);
        console.log(`📈 Taxa de sucesso: ${report.summary.successRate}%`);

        if (report.errors.length > 0) {
            console.log('\n❌ ARQUIVOS COM ERRO:');
            report.errors.forEach(error => {
                console.log(`   ${error.fileName}: ${error.error}`);
            });
        }

        if (report.processedFiles.length > 0) {
            console.log('\n✅ ARQUIVOS ORGANIZADOS:');
            const organized = report.processedFiles.filter(f => f.success);
            organized.forEach(file => {
                const relativePath = path.relative(CONFIG.DOWNLOAD_DIR, file.destPath);
                console.log(`   ${file.fileName} → ${relativePath}`);
            });
        }

        console.log('='.repeat(60) + '\n');
    }
}

// ==================== SISTEMA DE VALIDAÇÃO E VERIFICAÇÃO ====================
class FileValidator {
    static validateXMLStructure(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');

            // Verificações básicas de XML
            if (!content.includes('<?xml')) {
                return { valid: false, reason: 'Missing XML declaration' };
            }

            if (!content.includes('<') || !content.includes('>')) {
                return { valid: false, reason: 'Invalid XML structure' };
            }

            // Verificações específicas para NFSe
            const nfseIndicators = [
                'nfse', 'NFSe', 'NotaFiscal', 'InfNfse', 'CompNfse'
            ];

            const hasNfseContent = nfseIndicators.some(indicator =>
                content.toLowerCase().includes(indicator.toLowerCase())
            );

            if (!hasNfseContent) {
                return { valid: false, reason: 'Not a valid NFSe XML' };
            }

            // Verificar se não está truncado
            if (!content.trim().endsWith('>')) {
                return { valid: false, reason: 'XML appears to be truncated' };
            }

            return { valid: true, reason: 'Valid NFSe XML' };

        } catch (error) {
            return { valid: false, reason: `Validation error: ${error.message}` };
        }
    }

    static checkFileSize(filePath) {
        try {
            const stats = fs.statSync(filePath);
            const size = stats.size;

            if (size < CONFIG.MIN_FILE_SIZE) {
                return { valid: false, size, reason: `File too small (${size} bytes)` };
            }

            return { valid: true, size, reason: 'File size OK' };

        } catch (error) {
            return { valid: false, size: 0, reason: `Size check error: ${error.message}` };
        }
    }

    static generateChecksum(filePath) {
        try {
            const crypto = require('crypto');
            const content = fs.readFileSync(filePath);
            return crypto.createHash('md5').update(content).digest('hex');
        } catch (error) {
            return null;
        }
    }

    static isDuplicate(filePath, existingFiles) {
        try {
            const newChecksum = this.generateChecksum(filePath);
            if (!newChecksum) return { isDuplicate: false, reason: 'Checksum generation failed' };

            const fileName = path.basename(filePath);

            for (const existingFile of existingFiles) {
                const existingFileName = path.basename(existingFile);

                // Verificar se é o mesmo arquivo por nome
                if (fileName === existingFileName) {
                    const existingChecksum = this.generateChecksum(existingFile);
                    if (newChecksum === existingChecksum) {
                        return {
                            isDuplicate: true,
                            identical: true,
                            existingFile,
                            reason: 'Arquivo idêntico já existe'
                        };
                    } else {
                        return {
                            isDuplicate: true,
                            identical: false,
                            existingFile,
                            reason: 'Arquivo com mesmo nome mas conteúdo diferente'
                        };
                    }
                }

                // Verificar se é o mesmo conteúdo com nome diferente
                const existingChecksum = this.generateChecksum(existingFile);
                if (newChecksum === existingChecksum) {
                    return {
                        isDuplicate: true,
                        identical: true,
                        existingFile,
                        reason: 'Conteúdo idêntico com nome diferente'
                    };
                }
            }

            return { isDuplicate: false, reason: 'Arquivo único' };
        } catch (error) {
            return { isDuplicate: false, reason: `Erro na verificação: ${error.message}` };
        }
    }

    static validateDownload(filePath, existingFiles = []) {
        const validation = {
            filePath,
            timestamp: new Date().toISOString(),
            checks: {}
        };

        // Verificar se o arquivo existe
        if (!fs.existsSync(filePath)) {
            validation.valid = false;
            validation.reason = 'File does not exist';
            return validation;
        }

        // Verificar tamanho
        validation.checks.size = this.checkFileSize(filePath);

        // Verificar estrutura XML
        validation.checks.xml = this.validateXMLStructure(filePath);

        // Verificar duplicatas com lógica inteligente
        if (CONFIG.DUPLICATE_CHECK) {
            validation.checks.duplicate = this.isDuplicate(filePath, existingFiles);
        }

        // Gerar checksum
        validation.checksum = this.generateChecksum(filePath);

        // Determinar se é válido com lógica inteligente
        let isValid = validation.checks.size.valid && validation.checks.xml.valid;

        if (CONFIG.DUPLICATE_CHECK && validation.checks.duplicate.isDuplicate) {
            if (CONFIG.SMART_DUPLICATE_HANDLING) {
                if (validation.checks.duplicate.identical) {
                    // Arquivo idêntico - ignorar (não é erro, apenas skip)
                    validation.action = 'ignore';
                    validation.reason = 'Arquivo idêntico já existe - ignorando';
                    isValid = true; // Não é erro, apenas não precisa processar
                } else {
                    // Arquivo diferente com mesmo nome - sobrescrever
                    validation.action = 'overwrite';
                    validation.reason = 'Arquivo atualizado - sobrescrevendo';
                    isValid = true;
                }
            } else {
                // Lógica antiga - rejeitar duplicatas
                validation.action = 'reject';
                validation.reason = 'Duplicata detectada';
                isValid = false;
            }
        } else {
            // Arquivo novo
            validation.action = 'accept';
            validation.reason = 'Arquivo novo válido';
        }

        validation.valid = isValid;

        return validation;
    }
}

// ==================== SISTEMA DE RETRY COM BACKOFF EXPONENCIAL ====================
class RetryManager {
    static async executeWithRetry(operation, context = '', maxRetries = CONFIG.MAX_RETRIES) {
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                Logger.debug(`${context} - Tentativa ${attempt}/${maxRetries}`);
                const result = await operation();

                if (attempt > 1) {
                    Logger.success(`${context} - Sucesso na tentativa ${attempt}`);
                    Logger.updateMetrics('downloads', 'retries', attempt - 1);
                }

                return result;

            } catch (error) {
                lastError = error;
                Logger.warn(`${context} - Falha na tentativa ${attempt}: ${error.message}`);

                if (attempt < maxRetries) {
                    const delay = CONFIG.EXPONENTIAL_BACKOFF
                        ? CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1)
                        : CONFIG.RETRY_DELAY;

                    Logger.debug(`${context} - Aguardando ${delay}ms antes da próxima tentativa`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        Logger.error(`${context} - Todas as ${maxRetries} tentativas falharam`, lastError);
        throw lastError;
    }
}

// ==================== CLASSE PRINCIPAL ====================
class NFSeDownloader {
    constructor() {
        this.browser = null;
        this.page = null;
        this.downloadedFiles = [];
        this.totalDownloads = 0;
        this.organizer = new XMLOrganizer();
    }

    async init() {
        try {
            Logger.info('Inicializando NFSe Downloader...');
            Logger.debug(`Diretório de trabalho: ${__dirname}`);
            Logger.debug(`Diretório de downloads: ${CONFIG.DOWNLOAD_DIR}`);

            // Criar diretório de downloads se não existir
            if (!fs.existsSync(CONFIG.DOWNLOAD_DIR)) {
                fs.mkdirSync(CONFIG.DOWNLOAD_DIR, { recursive: true });
                Logger.info(`Diretório criado: ${CONFIG.DOWNLOAD_DIR}`);
            } else {
                Logger.debug(`Diretório já existe: ${CONFIG.DOWNLOAD_DIR}`);
            }

            Logger.debug('Iniciando browser com configurações compatíveis...');

            // Configurações compatíveis com Puppeteer v23+ e CSP
            const launchOptions = {
                headless: CONFIG.HEADLESS,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-dev-shm-usage',
                    '--disable-extensions',
                    '--no-first-run',
                    '--disable-default-apps'
                ]
            };

            // Inicializar browser
            this.browser = await puppeteer.launch(launchOptions);
            Logger.debug('Browser iniciado com sucesso');

            this.page = await this.browser.newPage();

            // EXATO COMO NO RECORD: Configurar viewport
            await this.page.setViewport({
                width: 1375,
                height: 791
            });

            this.page.setDefaultTimeout(CONFIG.TIMEOUT);
            Logger.debug('Nova página criada e configurada');

            // Configurar downloads
            Logger.debug('Configurando comportamento de downloads...');
            try {
                const client = await this.page.target().createCDPSession();
                await client.send('Page.setDownloadBehavior', {
                    behavior: 'allow',
                    downloadPath: CONFIG.DOWNLOAD_DIR
                });
                Logger.debug('Downloads configurados via CDP');
            } catch (cdpError) {
                Logger.warn(`Erro ao configurar downloads via CDP: ${cdpError.message}`);
                Logger.debug('Tentando método alternativo para downloads...');
                // Método alternativo - configurar via prefs
                await this.page.evaluateOnNewDocument(() => {
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined,
                    });
                });
                Logger.debug('Configuração alternativa de downloads aplicada');
            }

            // Adicionar listeners para debug
            if (CONFIG.DEBUG) {
                this.page.on('console', msg => Logger.debug(`Console: ${msg.text()}`));
                this.page.on('pageerror', error => Logger.error(`Erro na página: ${error.message}`));
                this.page.on('requestfailed', request => Logger.debug(`Request falhou: ${request.url()}`));
                this.page.on('framenavigated', frame => {
                    if (frame === this.page.mainFrame()) {
                        Logger.debug(`🌐 Navegação detectada: ${frame.url()}`);
                    }
                });
                this.page.on('response', response => {
                    if (response.url().includes('index.php')) {
                        Logger.debug(`📄 Resposta da página: ${response.url()} - Status: ${response.status()}`);
                    }
                });
            }

            Logger.success('Inicialização concluída');
        } catch (error) {
            Logger.error(`Erro na inicialização: ${error.message}`);
            throw error;
        }
    }

    async login() {
        try {
            Logger.info('Realizando login...');
            Logger.debug(`Navegando para: ${CONFIG.LOGIN_URL}`);

            // Navegar para página de login - EXATO COMO NO RECORD
            await this.page.goto(CONFIG.LOGIN_URL);
            Logger.debug('Página de login carregada');

            // EXATO COMO NO RECORD: Preencher CNPJ usando Locator
            Logger.debug('Preenchendo CNPJ...');
            await puppeteer.Locator.race([
                this.page.locator('::-p-aria(Digite seu Usuário)'),
                this.page.locator('#login_nfse'),
                this.page.locator('::-p-xpath(//*[@id=\\"login_nfse\\"])'),
                this.page.locator(':scope >>> #login_nfse')
            ])
                .setTimeout(CONFIG.TIMEOUT)
                .click({
                  offset: {
                    x: 221.2578125,
                    y: 23.36328125,
                  },
                });

            await puppeteer.Locator.race([
                this.page.locator('::-p-aria(Digite seu Usuário)'),
                this.page.locator('#login_nfse'),
                this.page.locator('::-p-xpath(//*[@id=\\"login_nfse\\"])'),
                this.page.locator(':scope >>> #login_nfse')
            ])
                .setTimeout(CONFIG.TIMEOUT)
                .fill(CONFIG.CNPJ);

            Logger.debug(`CNPJ preenchido: ${CONFIG.CNPJ}`);

            // EXATO COMO NO RECORD: Preencher senha usando Locator
            Logger.debug('Preenchendo senha...');
            await puppeteer.Locator.race([
                this.page.locator('::-p-aria(Senha de Acesso)'),
                this.page.locator('#senha_nfse_digite'),
                this.page.locator('::-p-xpath(//*[@id=\\"senha_nfse_digite\\"])'),
                this.page.locator(':scope >>> #senha_nfse_digite')
            ])
                .setTimeout(CONFIG.TIMEOUT)
                .click({
                  offset: {
                    x: 214.2578125,
                    y: 24.92578125,
                  },
                });

            await puppeteer.Locator.race([
                this.page.locator('::-p-aria(Senha de Acesso)'),
                this.page.locator('#senha_nfse_digite'),
                this.page.locator('::-p-xpath(//*[@id=\\"senha_nfse_digite\\"])'),
                this.page.locator(':scope >>> #senha_nfse_digite')
            ])
                .setTimeout(CONFIG.TIMEOUT)
                .fill(CONFIG.SENHA);

            Logger.debug('Senha preenchida');

            // EXATO COMO NO RECORD: Fazer login
            Logger.debug('Clicando no botão de login...');
            const promises = [];
            const startWaitingForEvents = () => {
                promises.push(this.page.waitForNavigation());
            }

            await puppeteer.Locator.race([
                this.page.locator('::-p-aria(Acessar Sistema[role=\\"heading\\"])'),
                this.page.locator('div.pt-0 h5'),
                this.page.locator('::-p-xpath(//*[@id=\\"form_autentica\\"]/button/h5)'),
                this.page.locator(':scope >>> div.pt-0 h5'),
                this.page.locator('::-p-text(Acessar Sistema)')
            ])
                .setTimeout(CONFIG.TIMEOUT)
                .on('action', () => startWaitingForEvents())
                .click({
                  offset: {
                    x: 433.01171875,
                    y: 11.23828125,
                  },
                });
            await Promise.all(promises);

            // Verificar se o login foi bem-sucedido
            const currentUrl = this.page.url();
            Logger.debug(`🌐 URL após login: ${currentUrl}`);

            if (!currentUrl.includes('index.php')) {
                throw new Error(`Login falhou - URL atual: ${currentUrl}`);
            }

            Logger.success('Login realizado com sucesso');

        } catch (error) {
            Logger.error(`Erro no login: ${error.message}`);
            if (CONFIG.DEBUG) {
                await this.page.screenshot({ path: 'debug-login-error.png' });
                Logger.debug('Screenshot de erro salvo: debug-login-error.png');
            }
            throw error;
        }
    }

    async navigateToReportsAndSearch() {
        try {
            Logger.info('Navegando diretamente para relatórios com pesquisa...');

            // Construir URL completa com todos os parâmetros de pesquisa
            const currentUrl = this.page.url();
            const baseUrl = currentUrl.replace(/\?.*$/, ''); // Remove parâmetros existentes

            const searchUrl = `${baseUrl}?nr_nferps_ini=&nr_nferps_fim=&dt_inicial=${CONFIG.DATA_INICIAL}&dt_final=${CONFIG.DATA_FINAL}&vl_inicial=&vl_final=&st_rps=1&nr_doc=&cd_atividade=&tp_codigo=lc116&tp_doc=1&ordem=DESC&consulta=1&pg=relatorio`;

            Logger.debug(`Navegando diretamente para URL com pesquisa: ${searchUrl}`);
            await this.page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: CONFIG.TIMEOUT });

            // Verificar se chegou na página de relatórios com resultados
            const finalUrl = this.page.url();
            Logger.debug(`🌐 URL final: ${finalUrl}`);

            if (!finalUrl.includes('pg=relatorio') || !finalUrl.includes('consulta=1')) {
                throw new Error('Navegação falhou - não chegou na página de relatórios com pesquisa');
            }

            // Aguardar a tabela de resultados carregar
            Logger.debug('Aguardando tabela de resultados...');
            await this.delay(3000);

            Logger.success('Navegação e pesquisa concluídas diretamente via URL');

        } catch (error) {
            Logger.error(`Erro ao navegar para relatórios: ${error.message}`);
            if (CONFIG.DEBUG) {
                await this.page.screenshot({ path: 'debug-navigation-error.png' });
                Logger.debug('Screenshot de erro salvo: debug-navigation-error.png');
            }
            throw error;
        }
    }

    async configurePeriod() {
        try {
            Logger.info(`Configurando período: ${CONFIG.DATA_INICIAL} a ${CONFIG.DATA_FINAL}`);

            // EXATO COMO NO RECORD: Configurar data inicial
            Logger.debug('Configurando data inicial...');
            await puppeteer.Locator.race([
                this.page.locator('#dt_inicial'),
                this.page.locator('::-p-xpath(//*[@id=\\"dt_inicial\\"])'),
                this.page.locator(':scope >>> #dt_inicial')
            ])
                .setTimeout(CONFIG.TIMEOUT)
                .click({
                  offset: {
                    x: 4.1484375,
                    y: 19.89453125,
                  },
                });

            // Simular digitação das teclas como no record
            await this.page.keyboard.down('0');
            await this.page.keyboard.up('0');
            await this.page.keyboard.down('7');
            await this.page.keyboard.up('7');
            await this.page.keyboard.down('0');
            await this.page.keyboard.up('0');
            await this.page.keyboard.down('1');
            await this.page.keyboard.up('1');

            await puppeteer.Locator.race([
                this.page.locator('#dt_inicial'),
                this.page.locator('::-p-xpath(//*[@id=\\"dt_inicial\\"])'),
                this.page.locator(':scope >>> #dt_inicial')
            ])
                .setTimeout(CONFIG.TIMEOUT)
                .fill('2025-07-01');

            // EXATO COMO NO RECORD: Configurar data final
            Logger.debug('Configurando data final...');
            await puppeteer.Locator.race([
                this.page.locator('#dt_final'),
                this.page.locator('::-p-xpath(//*[@id=\\"dt_final\\"])'),
                this.page.locator(':scope >>> #dt_final')
            ])
                .setTimeout(CONFIG.TIMEOUT)
                .click({
                  offset: {
                    x: 19.828125,
                    y: 14.89453125,
                  },
                });

            // Simular digitação das teclas como no record
            await this.page.keyboard.down('0');
            await this.page.keyboard.up('0');
            await this.page.keyboard.down('8');
            await this.page.keyboard.up('8');
            await this.page.keyboard.down('0');
            await this.page.keyboard.up('0');
            await this.page.keyboard.down('1');
            await this.page.keyboard.up('1');

            await puppeteer.Locator.race([
                this.page.locator('#dt_final'),
                this.page.locator('::-p-xpath(//*[@id=\\"dt_final\\"])'),
                this.page.locator(':scope >>> #dt_final')
            ])
                .setTimeout(CONFIG.TIMEOUT)
                .fill('2025-08-01');

            Logger.success('Período configurado');

        } catch (error) {
            Logger.error(`Erro ao configurar período: ${error.message}`);
            if (CONFIG.DEBUG) {
                await this.page.screenshot({ path: 'debug-period-error.png' });
                Logger.debug('Screenshot de erro salvo: debug-period-error.png');
            }
            throw error;
        }
    }

    // Função auxiliar para formatar data de YYYY-MM-DD para DD/MM/YYYY
    formatDateForInput(dateString) {
        try {
            // Se já está no formato DD/MM/YYYY, retorna como está
            if (dateString.includes('/')) {
                return dateString;
            }

            // Converte de YYYY-MM-DD para DD/MM/YYYY
            const [year, month, day] = dateString.split('-');
            return `${day}/${month}/${year}`;
        } catch (error) {
            Logger.warn(`Erro ao formatar data ${dateString}: ${error.message}`);
            return dateString;
        }
    }

    // Método robusto para limpar e preencher campos de data
    async clearAndFillDateField(selector, dateValue) {
        try {
            const formattedDate = this.formatDateForInput(dateValue);
            Logger.debug(`Preenchendo ${selector} com: ${formattedDate}`);

            // Aguardar o campo estar disponível
            await this.page.waitForSelector(selector, { timeout: CONFIG.TIMEOUT });

            // Focar no campo
            await this.page.focus(selector);
            await this.delay(200);

            // Método 1: Limpar via JavaScript
            await this.page.evaluate((sel) => {
                const field = document.querySelector(sel);
                if (field) {
                    field.value = '';
                    field.dispatchEvent(new Event('input', { bubbles: true }));
                    field.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, selector);

            await this.delay(300);

            // Método 2: Selecionar tudo e deletar
            await this.page.keyboard.down('Control');
            await this.page.keyboard.press('KeyA');
            await this.page.keyboard.up('Control');
            await this.page.keyboard.press('Backspace');

            await this.delay(300);

            // Digitar a nova data
            await this.page.type(selector, formattedDate, { delay: 100 });

            // Disparar eventos para garantir que o campo foi atualizado
            await this.page.evaluate((sel) => {
                const field = document.querySelector(sel);
                if (field) {
                    field.dispatchEvent(new Event('input', { bubbles: true }));
                    field.dispatchEvent(new Event('change', { bubbles: true }));
                    field.blur();
                }
            }, selector);

            await this.delay(500);

            // Verificar se o valor foi definido corretamente
            const actualValue = await this.page.$eval(selector, el => el.value);
            Logger.debug(`Valor atual no campo ${selector}: ${actualValue}`);

            return actualValue;

        } catch (error) {
            Logger.error(`Erro ao preencher campo ${selector}: ${error.message}`);
            throw error;
        }
    }

    async searchNotes() {
        try {
            Logger.info('Pesquisando notas fiscais...');

            // Aguardar a página de relatórios carregar completamente
            Logger.debug('Aguardando página de relatórios carregar...');
            await this.delay(5000);

            // Aguardar elementos específicos da página de relatórios aparecerem
            try {
                await this.page.waitForSelector('form#formrelatorio', { timeout: 10000 });
                Logger.debug('Formulário de relatório encontrado');
            } catch (error) {
                Logger.warn('Formulário de relatório não encontrado, continuando...');
            }

            // Verificar se estamos na página correta
            let currentUrl = this.page.url();
            Logger.debug(`URL atual antes da pesquisa: ${currentUrl}`);

            if (!currentUrl.includes('pg=relatorio')) {
                throw new Error('Não está na página de relatórios');
            }

            // EXATO COMO NO RECORD: Clicar no botão "Pesquisar Notas"
            Logger.debug('Clicando no botão "Pesquisar Notas"...');
            const promises = [];
            const startWaitingForEvents = () => {
                promises.push(this.page.waitForNavigation());
            }

            await puppeteer.Locator.race([
                this.page.locator('::-p-aria(Pesquisar Notas)'),
                this.page.locator('div.card-body button'),
                this.page.locator('::-p-xpath(//*[@id=\\"formrelatorio\\"]/div[2]/div[4]/div/div[1]/button)'),
                this.page.locator(':scope >>> div.card-body button'),
                this.page.locator('::-p-text(Pesquisar Notas)')
            ])
                .setTimeout(CONFIG.TIMEOUT)
                .on('action', () => startWaitingForEvents())
                .click({
                  offset: {
                    x: 33.875,
                    y: 24.97265625,
                  },
                });
            await Promise.all(promises);

            // Verificar se a pesquisa foi realizada (URL deve conter parâmetros)
            currentUrl = this.page.url();
            Logger.debug(`URL após pesquisa: ${currentUrl}`);

            if (!currentUrl.includes('consulta=1')) {
                throw new Error('Pesquisa falhou - URL não contém parâmetros de consulta');
            }

            // Aguardar carregamento dos resultados
            Logger.debug('Aguardando carregamento da tabela de resultados...');
            await this.page.waitForSelector('table tbody tr', { timeout: CONFIG.TIMEOUT });

            // Aguardar um pouco mais para garantir que a tabela carregou completamente
            await this.delay(2000);

            Logger.success('Pesquisa realizada');

        } catch (error) {
            Logger.error(`Erro na pesquisa: ${error.message}`);
            if (CONFIG.DEBUG) {
                await this.page.screenshot({ path: 'debug-search-error.png' });
                Logger.debug('Screenshot de erro salvo: debug-search-error.png');
            }
            throw error;
        }
    }

    async countTotalNotes() {
        try {
            const rows = await this.page.$$('table tbody tr');
            const totalNotes = rows.length;
            Logger.info(`Total de notas encontradas: ${totalNotes}`);
            return totalNotes;
        } catch (error) {
            Logger.warn('Não foi possível contar as notas');
            return 0;
        }
    }

    async downloadAllXMLs() {
        Logger.info('Iniciando download de todos os XMLs...');

        const totalNotes = await this.countTotalNotes();
        if (totalNotes === 0) {
            Logger.warn('Nenhuma nota fiscal encontrada para download');
            return;
        }

        let downloadCount = 0;
        let currentPage = 1;
        const downloadResults = []; // Mover para fora do loop

        while (true) {
            Logger.info(`Processando página ${currentPage}...`);

            // Obter todas as linhas da tabela na página atual
            const rows = await this.page.$$('table tbody tr');

            if (rows.length === 0) {
                Logger.info('Não há mais notas para processar');
                break;
            }

            // Processar downloads com paralelização otimizada

            if (CONFIG.PARALLEL_DOWNLOADS > 1 && rows.length > 1) {
                Logger.info(`Iniciando downloads paralelos (máximo ${CONFIG.PARALLEL_DOWNLOADS} simultâneos)`);

                // Processar em lotes paralelos
                for (let i = 0; i < rows.length; i += CONFIG.PARALLEL_DOWNLOADS) {
                    const batch = [];

                    for (let j = 0; j < CONFIG.PARALLEL_DOWNLOADS && (i + j) < rows.length; j++) {
                        const rowIndex = i + j + 1;
                        const downloadNumber = downloadCount + j + 1;

                        batch.push(
                            this.downloadXMLFromRow(rowIndex, downloadNumber)
                                .then(result => ({ rowIndex, downloadNumber, ...result }))
                                .catch(error => ({
                                    rowIndex,
                                    downloadNumber,
                                    success: false,
                                    error: error.message
                                }))
                        );
                    }

                    // Aguardar lote completar
                    const batchResults = await Promise.all(batch);
                    downloadResults.push(...batchResults);

                    // Contar sucessos
                    const successCount = batchResults.filter(r => r.success).length;
                    downloadCount += successCount;

                    Logger.info(`Lote ${Math.floor(i / CONFIG.PARALLEL_DOWNLOADS) + 1} concluído: ${successCount}/${batchResults.length} sucessos`);

                    // Delay entre lotes
                    if (i + CONFIG.PARALLEL_DOWNLOADS < rows.length) {
                        await this.delay(CONFIG.DELAY_BETWEEN_DOWNLOADS);
                    }

                    // Garbage collection periódico
                    if (downloadCount % CONFIG.GARBAGE_COLLECT_INTERVAL === 0) {
                        if (global.gc) {
                            global.gc();
                            Logger.debug('Garbage collection executado');
                        }
                    }
                }
            } else {
                // Processamento sequencial para casos simples
                Logger.info('Iniciando downloads sequenciais');

                for (let i = 0; i < rows.length; i++) {
                    try {
                        const result = await this.downloadXMLFromRow(i + 1, downloadCount + 1);
                        downloadResults.push({
                            rowIndex: i + 1,
                            downloadNumber: downloadCount + 1,
                            ...result
                        });

                        if (result.success) {
                            downloadCount++;
                        }

                        // Delay entre downloads
                        await this.delay(CONFIG.DELAY_BETWEEN_DOWNLOADS);

                    } catch (error) {
                        Logger.error(`Erro ao baixar XML da linha ${i + 1}: ${error.message}`);
                        downloadResults.push({
                            rowIndex: i + 1,
                            downloadNumber: downloadCount + 1,
                            success: false,
                            error: error.message
                        });
                    }
                }
            }

            // Verificar se há próxima página
            const hasNextPage = await this.checkNextPage();
            if (!hasNextPage) {
                break;
            }

            await this.goToNextPage();
            currentPage++;
        }

        // Gerar relatório final detalhado
        this.totalDownloads = downloadCount;
        await this.generateFinalReport(downloadResults, totalNotes);

        Logger.success(`Download concluído! Total de XMLs baixados: ${downloadCount}/${totalNotes}`);
    }

    async downloadXMLFromRow(rowIndex, downloadNumber) {
        const startTime = Date.now();
        const context = `Download XML ${downloadNumber} (linha ${rowIndex})`;

        return await RetryManager.executeWithRetry(async () => {
            Logger.debug(`${context} - Iniciando...`);
            Logger.updateMetrics('downloads', 'attempted');

            // Contar arquivos antes do download
            const filesBefore = await this.countXMLFiles();
            const existingFiles = await this.getExistingXMLFiles();

            // Usar seletores otimizados
            const dropdownSelector = `table tbody tr:nth-child(${rowIndex}) button.dropdown-toggle`;

            // Aguardar e clicar no dropdown com timeout otimizado
            await this.page.waitForSelector(dropdownSelector, { timeout: CONFIG.ELEMENT_TIMEOUT });
            await this.page.click(dropdownSelector);

            // Aguardar o menu aparecer (reduzido)
            await this.delay(300);

            // Procurar e clicar no link XML de forma mais robusta
            const downloadResult = await this.page.evaluate((rowIdx) => {
                const row = document.querySelector(`table tbody tr:nth-child(${rowIdx})`);
                if (!row) return { success: false, reason: 'Row not found' };

                // Procurar por links que contenham "xml" no href ou texto
                const links = row.querySelectorAll('a');
                for (let link of links) {
                    const href = link.href || '';
                    const text = link.textContent || '';
                    if (href.toLowerCase().includes('xml') || text.toLowerCase().includes('xml')) {
                        link.click();
                        return { success: true, linkText: text.trim(), href };
                    }
                }
                return { success: false, reason: 'XML link not found' };
            }, rowIndex);

            if (!downloadResult.success) {
                throw new Error(`Link XML não encontrado: ${downloadResult.reason}`);
            }

            Logger.debug(`${context} - Link clicado: ${downloadResult.linkText}`);

            // Aguardar download com validação
            const downloadSuccess = await this.waitForDownloadOptimized(
                filesBefore,
                existingFiles,
                CONFIG.DOWNLOAD_TIMEOUT
            );

            if (downloadSuccess.success) {
                const duration = Date.now() - startTime;
                Logger.performance('download', duration, {
                    rowIndex,
                    downloadNumber,
                    fileSize: downloadSuccess.fileSize
                });

                Logger.updateMetrics('downloads', 'successful');
                Logger.updateMetrics('files', 'totalSize', downloadSuccess.fileSize);
                Logger.updateMetrics('files', 'validXMLs');

                Logger.success(`${context} - Concluído em ${duration}ms (${downloadSuccess.fileName})`);
                return { success: true, fileName: downloadSuccess.fileName };
            } else {
                throw new Error(`Download falhou: ${downloadSuccess.reason}`);
            }

        }, context);
    }

    // Função auxiliar para contar arquivos XML
    async countXMLFiles() {
        try {
            const files = fs.readdirSync(CONFIG.DOWNLOAD_DIR);
            return files.filter(file => file.toLowerCase().endsWith('.xml')).length;
        } catch (error) {
            return 0;
        }
    }

    // Função otimizada para aguardar download com validação
    async waitForDownloadOptimized(filesBefore, existingFiles, timeout) {
        const startTime = Date.now();
        let lastFileCount = filesBefore;

        while (Date.now() - startTime < timeout) {
            const currentFileCount = await this.countXMLFiles();

            if (currentFileCount > lastFileCount) {
                // Novo arquivo detectado, aguardar um pouco para garantir que terminou
                await this.delay(500);

                // Encontrar o arquivo mais recente
                const newFile = await this.findNewestXMLFile();
                if (newFile) {
                    // Validar o arquivo com lógica inteligente
                    const validation = FileValidator.validateDownload(newFile.path, existingFiles);

                    if (validation.valid) {
                        if (validation.action === 'ignore') {
                            // Arquivo idêntico - apenas ignorar e reportar sucesso
                            Logger.info(`📄 Arquivo idêntico ignorado: ${newFile.name}`);
                            Logger.updateMetrics('files', 'duplicates');

                            // Remover o arquivo baixado já que é idêntico
                            try {
                                fs.unlinkSync(newFile.path);
                            } catch (error) {
                                Logger.debug(`Erro ao remover arquivo duplicado: ${error.message}`);
                            }

                            return {
                                success: true,
                                fileName: newFile.name,
                                fileSize: validation.checks.size.size,
                                validation,
                                action: 'ignored_duplicate'
                            };
                        } else if (validation.action === 'overwrite') {
                            // Arquivo atualizado - sobrescrever
                            Logger.info(`🔄 Sobrescrevendo arquivo atualizado: ${newFile.name}`);

                            // Remover arquivo antigo
                            try {
                                fs.unlinkSync(validation.checks.duplicate.existingFile);
                                Logger.debug(`Arquivo antigo removido: ${validation.checks.duplicate.existingFile}`);
                            } catch (error) {
                                Logger.warn(`Erro ao remover arquivo antigo: ${error.message}`);
                            }
                        }

                        return {
                            success: true,
                            fileName: newFile.name,
                            fileSize: validation.checks.size.size,
                            validation,
                            action: validation.action
                        };
                    } else {
                        Logger.warn(`Arquivo inválido detectado: ${validation.reason}`);
                        Logger.updateMetrics('downloads', 'failed');

                        // Mover arquivo inválido para pasta de quarentena
                        await this.quarantineFile(newFile.path, validation);
                    }
                }

                lastFileCount = currentFileCount;
            }

            await this.delay(100); // Verificar a cada 100ms
        }

        return {
            success: false,
            reason: `Timeout após ${timeout}ms - nenhum arquivo válido detectado`
        };
    }

    // Obter lista de arquivos XML existentes
    async getExistingXMLFiles() {
        try {
            const files = fs.readdirSync(CONFIG.DOWNLOAD_DIR);
            return files
                .filter(file => file.toLowerCase().endsWith('.xml'))
                .map(file => path.join(CONFIG.DOWNLOAD_DIR, file));
        } catch (error) {
            return [];
        }
    }

    // Encontrar o arquivo XML mais recente
    async findNewestXMLFile() {
        try {
            const files = fs.readdirSync(CONFIG.DOWNLOAD_DIR);
            const xmlFiles = files
                .filter(file => file.toLowerCase().endsWith('.xml'))
                .map(file => {
                    const filePath = path.join(CONFIG.DOWNLOAD_DIR, file);
                    const stats = fs.statSync(filePath);
                    return { name: file, path: filePath, mtime: stats.mtime };
                })
                .sort((a, b) => b.mtime - a.mtime);

            return xmlFiles.length > 0 ? xmlFiles[0] : null;
        } catch (error) {
            return null;
        }
    }

    // Mover arquivo para quarentena
    async quarantineFile(filePath, validation) {
        try {
            const quarantineDir = path.join(CONFIG.DOWNLOAD_DIR, 'quarantine');
            if (!fs.existsSync(quarantineDir)) {
                fs.mkdirSync(quarantineDir, { recursive: true });
            }

            const fileName = path.basename(filePath);
            const quarantinePath = path.join(quarantineDir, `${Date.now()}_${fileName}`);

            fs.renameSync(filePath, quarantinePath);

            // Salvar relatório de validação
            const reportPath = quarantinePath + '.validation.json';
            fs.writeFileSync(reportPath, JSON.stringify(validation, null, 2));

            Logger.warn(`Arquivo movido para quarentena: ${quarantinePath}`);
        } catch (error) {
            Logger.error(`Erro ao mover arquivo para quarentena: ${error.message}`);
        }
    }

    // Função auxiliar para aguardar download (mantida para compatibilidade)
    async waitForDownload(filesBefore, timeout = 3000) {
        const result = await this.waitForDownloadOptimized(filesBefore, [], timeout);
        return result.success;
    }

    async getNoteInfo(rowIndex) {
        try {
            const rowSelector = `table tbody tr:nth-child(${rowIndex})`;

            const noteInfo = await this.page.evaluate((selector) => {
                const row = document.querySelector(selector);
                if (!row) return null;

                const cells = row.querySelectorAll('td');
                return {
                    numero: cells[0]?.textContent?.trim() || 'N/A',
                    data: cells[1]?.textContent?.trim() || 'N/A',
                    prestador: cells[2]?.textContent?.trim() || 'N/A',
                    valor: cells[3]?.textContent?.trim() || 'N/A'
                };
            }, rowSelector);

            return noteInfo || { numero: 'N/A', data: 'N/A', prestador: 'N/A', valor: 'N/A' };

        } catch (error) {
            Logger.warn(`Erro ao obter informações da nota: ${error.message}`);
            return { numero: 'N/A', data: 'N/A', prestador: 'N/A', valor: 'N/A' };
        }
    }

    generateFileName(noteInfo, downloadNumber) {
        const timestamp = new Date().toISOString().slice(0, 10);
        const numero = noteInfo.numero.replace(/[^a-zA-Z0-9]/g, '');
        return `NFSe_${numero}_${timestamp}_${downloadNumber.toString().padStart(3, '0')}.xml`;
    }

    async waitForDownload() {
        return new Promise((resolve) => {
            Logger.debug('Aguardando download...');
            const startTime = Date.now();
            const timeout = setTimeout(() => {
                Logger.warn('Timeout aguardando download');
                resolve(null);
            }, CONFIG.TIMEOUT);

            const initialFiles = fs.readdirSync(CONFIG.DOWNLOAD_DIR);
            Logger.debug(`Arquivos iniciais: ${initialFiles.length}`);

            const checkForNewFile = () => {
                try {
                    const currentFiles = fs.readdirSync(CONFIG.DOWNLOAD_DIR);
                    const newFiles = currentFiles.filter(f => !initialFiles.includes(f));
                    const xmlFiles = newFiles.filter(f => f.endsWith('.xml') && !this.downloadedFiles.includes(f));

                    Logger.debug(`Verificando arquivos... Novos: ${newFiles.length}, XMLs: ${xmlFiles.length}`);

                    if (xmlFiles.length > 0) {
                        clearTimeout(timeout);
                        const downloadTime = Date.now() - startTime;
                        Logger.debug(`Download detectado em ${downloadTime}ms: ${xmlFiles[0]}`);
                        resolve(xmlFiles[0]);
                    } else {
                        // Verificar também arquivos .crdownload (Chrome) ou .part (Firefox)
                        const partialFiles = currentFiles.filter(f =>
                            f.endsWith('.crdownload') || f.endsWith('.part') || f.endsWith('.tmp')
                        );

                        if (partialFiles.length > 0) {
                            Logger.debug(`Download em progresso: ${partialFiles[0]}`);
                        }

                        setTimeout(checkForNewFile, 500);
                    }
                } catch (error) {
                    Logger.debug(`Erro ao verificar arquivos: ${error.message}`);
                    setTimeout(checkForNewFile, 500);
                }
            };

            // Aguardar um pouco antes de começar a verificar
            setTimeout(checkForNewFile, 1000);
        });
    }

    async checkNextPage() {
        try {
            const nextButton = await this.page.$('a:contains("Próxima"), a:contains(">>"), .pagination .next');
            return nextButton !== null;
        } catch (error) {
            return false;
        }
    }

    async goToNextPage() {
        try {
            await Promise.all([
                this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
                this.page.click('a:contains("Próxima"), a:contains(">>"), .pagination .next')
            ]);
            Logger.info('Navegando para próxima página...');
        } catch (error) {
            throw new Error(`Erro ao navegar para próxima página: ${error.message}`);
        }
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            Logger.info('Browser fechado');
        }
    }

    async run() {
        try {
            Logger.debug('=== INICIANDO EXECUÇÃO ===');

            Logger.debug('Passo 1: Inicialização');
            await this.init();

            Logger.debug('Passo 2: Login');
            await this.login();

            Logger.debug('Passo 3: Navegação direta para relatórios com pesquisa');
            await this.navigateToReportsAndSearch();

            Logger.debug('Passo 6: Download de XMLs');
            await this.downloadAllXMLs();

            if (CONFIG.AUTO_ORGANIZE) {
                Logger.debug('Passo 7: Organização automática de arquivos');
                await this.organizeDownloadedFiles();
            }

            Logger.debug('Passo 8: Relatório final');
            this.generateReport();

            Logger.debug('=== EXECUÇÃO CONCLUÍDA ===');

        } catch (error) {
            Logger.error(`Erro durante execução: ${error.message}`);
            if (CONFIG.DEBUG) {
                Logger.error(`Stack trace: ${error.stack}`);
                // Tentar screenshot de erro
                try {
                    if (this.page) {
                        await this.page.screenshot({ path: 'debug-error.png' });
                        Logger.debug('Screenshot de erro salvo: debug-error.png');
                    }
                } catch (screenshotError) {
                    Logger.debug(`Erro ao salvar screenshot: ${screenshotError.message}`);
                }
            }
            throw error;
        } finally {
            Logger.debug('Executando limpeza...');
            await this.cleanup();
        }
    }

    generateReport() {
        Logger.info('='.repeat(50));
        Logger.info('RELATÓRIO DE DOWNLOAD');
        Logger.info('='.repeat(50));
        Logger.info(`Período: ${CONFIG.DATA_INICIAL} a ${CONFIG.DATA_FINAL}`);
        Logger.info(`CNPJ: ${CONFIG.CNPJ}`);
        Logger.info(`Total de XMLs baixados: ${this.totalDownloads}`);
        Logger.info(`Diretório: ${CONFIG.DOWNLOAD_DIR}`);
        Logger.info('='.repeat(50));

        if (this.downloadedFiles.length > 0) {
            Logger.info('Arquivos baixados:');
            this.downloadedFiles.forEach((file, index) => {
                Logger.info(`  ${index + 1}. ${file}`);
            });
        }
    }

    // Gerar relatório final detalhado
    async generateFinalReport(downloadResults, totalNotes) {
        try {
            const metrics = Logger.getMetrics();
            const report = Logger.generateReport();

            // Análise detalhada dos resultados
            const successful = downloadResults.filter(r => r.success);
            const failed = downloadResults.filter(r => !r.success);

            // Verificar arquivos no diretório
            const actualFiles = await this.getExistingXMLFiles();
            const validFiles = [];
            const invalidFiles = [];

            for (const filePath of actualFiles) {
                const validation = FileValidator.validateDownload(filePath);
                if (validation.valid) {
                    validFiles.push({ path: filePath, validation });
                } else {
                    invalidFiles.push({ path: filePath, validation });
                }
            }

            // Criar relatório completo
            const finalReport = {
                timestamp: new Date().toISOString(),
                execution: {
                    totalTime: report.summary.totalTime,
                    successRate: report.summary.successRate,
                    notesFound: totalNotes,
                    downloadsAttempted: downloadResults.length,
                    downloadsSuccessful: successful.length,
                    downloadsFailed: failed.length
                },
                performance: report.performance,
                files: {
                    ...report.files,
                    actualFilesFound: actualFiles.length,
                    validFilesConfirmed: validFiles.length,
                    invalidFilesDetected: invalidFiles.length
                },
                errors: report.errors,
                details: {
                    successfulDownloads: successful.map(r => ({
                        row: r.rowIndex,
                        downloadNumber: r.downloadNumber,
                        fileName: r.fileName
                    })),
                    failedDownloads: failed.map(r => ({
                        row: r.rowIndex,
                        downloadNumber: r.downloadNumber,
                        error: r.error
                    })),
                    invalidFiles: invalidFiles.map(f => ({
                        file: path.basename(f.path),
                        reason: f.validation.reason,
                        checks: f.validation.checks
                    }))
                },
                recommendations: this.generateRecommendations(report, successful.length, failed.length, totalNotes)
            };

            // Salvar relatório em arquivo
            const reportPath = path.join(CONFIG.DOWNLOAD_DIR, `nfse-report-${Date.now()}.json`);
            fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));

            // Exibir resumo no console
            this.displayReportSummary(finalReport);

            Logger.info(`Relatório detalhado salvo em: ${reportPath}`);

        } catch (error) {
            Logger.error(`Erro ao gerar relatório final: ${error.message}`);
        }
    }

    // Gerar recomendações baseadas nos resultados
    generateRecommendations(report, successful, failed, total) {
        const recommendations = [];

        const successRate = (successful / total) * 100;

        if (successRate < 90) {
            recommendations.push('Taxa de sucesso baixa - considere aumentar timeouts ou verificar conectividade');
        }

        if (report.errors.timeout > 0) {
            recommendations.push('Timeouts detectados - considere aumentar CONFIG.DOWNLOAD_TIMEOUT');
        }

        if (report.errors.network > 0) {
            recommendations.push('Erros de rede detectados - verificar conexão com o servidor');
        }

        if (report.files.duplicates > 0) {
            recommendations.push('Arquivos duplicados detectados - verificar lógica de detecção');
        }

        if (parseFloat(report.performance.avgDownloadTime) > 5000) {
            recommendations.push('Downloads lentos - considere otimizar configurações de rede');
        }

        if (recommendations.length === 0) {
            recommendations.push('Execução otimizada - nenhuma melhoria necessária');
        }

        return recommendations;
    }

    // Exibir resumo do relatório no console
    displayReportSummary(report) {
        console.log('\n' + '='.repeat(60));
        console.log('📊 RELATÓRIO FINAL DE EXECUÇÃO');
        console.log('='.repeat(60));
        console.log(`⏱️  Tempo total: ${report.execution.totalTime}`);
        console.log(`📈 Taxa de sucesso: ${report.execution.successRate}`);
        console.log(`📄 Notas encontradas: ${report.execution.notesFound}`);
        console.log(`✅ Downloads bem-sucedidos: ${report.execution.downloadsSuccessful}`);
        console.log(`❌ Downloads falharam: ${report.execution.downloadsFailed}`);
        console.log(`📁 Arquivos válidos: ${report.files.validFilesConfirmed}`);
        console.log(`⚠️  Arquivos inválidos: ${report.files.invalidFilesDetected}`);

        if (report.details.failedDownloads.length > 0) {
            console.log('\n❌ DOWNLOADS FALHARAM:');
            report.details.failedDownloads.forEach(f => {
                console.log(`   Linha ${f.row}: ${f.error}`);
            });
        }

        if (report.details.invalidFiles.length > 0) {
            console.log('\n⚠️  ARQUIVOS INVÁLIDOS:');
            report.details.invalidFiles.forEach(f => {
                console.log(`   ${f.file}: ${f.reason}`);
            });
        }

        console.log('\n💡 RECOMENDAÇÕES:');
        report.recommendations.forEach(rec => {
            console.log(`   • ${rec}`);
        });

        console.log('='.repeat(60) + '\n');
    }

    // Organizar arquivos XML baixados automaticamente
    async organizeDownloadedFiles() {
        try {
            Logger.info('🗂️ Iniciando organização automática dos arquivos XML baixados...');

            // Verificar se há arquivos para organizar
            const files = fs.readdirSync(CONFIG.DOWNLOAD_DIR);
            const xmlFiles = files.filter(file =>
                file.toLowerCase().endsWith('.xml') &&
                !file.startsWith('.') &&
                !file.includes('organized') // Evitar processar arquivos já organizados
            );

            if (xmlFiles.length === 0) {
                Logger.info('📄 Nenhum arquivo XML encontrado para organizar');
                return;
            }

            // Criar diretório base para organização
            const organizedDir = path.join(CONFIG.DOWNLOAD_DIR, CONFIG.ORGANIZE_BASE_DIR);

            // Executar organização
            const report = await this.organizer.organizeAllFiles(CONFIG.DOWNLOAD_DIR, organizedDir);

            // Exibir resumo
            this.organizer.displayOrganizationSummary(report);

            Logger.success(`🎉 Organização automática concluída! ${report.stats.organized}/${report.stats.total} arquivos organizados`);

        } catch (error) {
            Logger.error(`Erro na organização automática: ${error.message}`);
            // Não interromper a execução por erro na organização
        }
    }
}

// ==================== FUNÇÃO PRINCIPAL ====================
async function main() {
    let downloader = null;

    try {
        Logger.info('🚀 Iniciando NFSe XML Downloader');
        Logger.info(`Configurações:`);
        Logger.info(`  - CNPJ: ${CONFIG.CNPJ}`);
        Logger.info(`  - Período: ${CONFIG.DATA_INICIAL} a ${CONFIG.DATA_FINAL}`);
        Logger.info(`  - Headless: ${CONFIG.HEADLESS}`);
        Logger.info(`  - Debug: ${CONFIG.DEBUG}`);
        Logger.info(`  - Timeout: ${CONFIG.TIMEOUT}ms`);
        Logger.info(`  - Diretório: ${CONFIG.DOWNLOAD_DIR}`);

        downloader = new NFSeDownloader();

        // Adicionar handler para interrupção
        process.on('SIGINT', async () => {
            Logger.warn('Interrupção detectada. Fechando browser...');
            if (downloader) {
                await downloader.cleanup();
            }
            process.exit(1);
        });

        // Adicionar handler para erros não capturados
        process.on('unhandledRejection', async (reason) => {
            Logger.error('Erro não tratado detectado:', reason);
            if (downloader) {
                await downloader.cleanup();
            }
            process.exit(1);
        });

        await downloader.run();
        Logger.success('✅ Download concluído com sucesso!');
        process.exit(0);

    } catch (error) {
        Logger.error(`❌ Erro fatal: ${error.message}`);
        if (CONFIG.DEBUG) {
            console.error('Stack trace completo:');
            console.error(error.stack);
        }

        // Garantir limpeza mesmo em caso de erro
        if (downloader) {
            try {
                await downloader.cleanup();
            } catch (cleanupError) {
                Logger.error(`Erro na limpeza: ${cleanupError.message}`);
            }
        }

        process.exit(1);
    }
}

// ==================== VERIFICAÇÃO DE DEPENDÊNCIAS ====================
function checkDependencies() {
    try {
        require('puppeteer');
        return true;
    } catch (error) {
        Logger.error('Puppeteer não encontrado. Execute: npm install puppeteer');
        return false;
    }
}

// ==================== EXECUÇÃO ====================
if (require.main === module) {
    console.log('🔍 Iniciando verificações...');

    if (checkDependencies()) {
        console.log('✅ Dependências verificadas');
        main().catch(error => {
            console.error(`❌ Erro não tratado na main: ${error.message}`);
            console.error('Stack completo:', error.stack);
            process.exit(1);
        });
    } else {
        console.error('❌ Falha na verificação de dependências');
        process.exit(1);
    }
}

module.exports = NFSeDownloader;
