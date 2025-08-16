#!/usr/bin/env node

/**
 * XMLITZ API Server
 * Servidor HTTP para execução de downloads via API REST
 */

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';

import { ConfigManager } from '../config/ConfigManager.js';
import { logger } from '../utils/OptimizedLogger.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';

import { setupRoutes } from './routes/index.js';
import { setupMiddlewares } from './middlewares/index.js';
import { ExecutionManager } from './services/ExecutionManager.js';

class XMLITZAPIServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.logger = logger;

        // Configurar logger para API (sem logs de requisições por padrão)
        this.logger.configure({
            compactMode: true,
            enableRequestLogs: false,
            enableDebugLogs: false
        });
        this.errorHandler = ErrorHandler.getInstance();
        this.config = null;
        this.executionManager = null;
    }
    
    /**
     * Inicializa o servidor
     */
    async initialize() {
        try {
            this.logger.info('Inicializando servidor XMLITZ API');
            
            // Carregar configurações
            this.config = ConfigManager.getInstance();
            await this.config.load();
            
            // Inicializar gerenciador de execuções
            this.executionManager = new ExecutionManager(this.config);
            
            // Configurar middlewares básicos
            this.setupBasicMiddlewares();
            
            // Configurar middlewares customizados
            setupMiddlewares(this.app, this.config, this.logger);
            
            // Configurar rotas
            setupRoutes(this.app, this.config, this.executionManager);
            
            // Configurar tratamento de erros
            this.setupErrorHandling();
            
            this.logger.success('Servidor inicializado com sucesso');
            
        } catch (error) {
            this.errorHandler.handle(error, 'server-initialize');
            throw error;
        }
    }
    
    /**
     * Configura middlewares básicos
     */
    setupBasicMiddlewares() {
        // Segurança
        this.app.use(helmet({
            contentSecurityPolicy: false,
            crossOriginEmbedderPolicy: false
        }));
        
        // CORS
        this.app.use(cors({
            origin: true,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        }));
        
        // Compressão
        this.app.use(compression());
        
        // Parsing de JSON
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Servir arquivos estáticos (frontend)
        this.app.use(express.static('public'));
        
        // Headers de resposta
        this.app.use((req, res, next) => {
            res.header('X-Powered-By', 'XMLITZ API v2.0');
            res.header('X-API-Version', '2.0.0');
            next();
        });
    }
    
    /**
     * Configura tratamento de erros
     */
    setupErrorHandling() {
        // Handler para rotas não encontradas
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Endpoint não encontrado',
                message: `Rota ${req.method} ${req.originalUrl} não existe`,
                availableEndpoints: {
                    'GET /': 'Status da API',
                    'POST /download': 'Iniciar download de XMLs',
                    'GET /status/:id': 'Verificar status de execução',
                    'GET /executions': 'Listar todas as execuções',
                    'GET /health': 'Health check da API'
                }
            });
        });
        
        // Handler global de erros
        this.app.use((error, req, res, next) => {
            this.errorHandler.handle(error, 'api-global-error');
            
            const statusCode = error.statusCode || 500;
            const message = error.message || 'Erro interno do servidor';
            
            res.status(statusCode).json({
                error: 'Erro no servidor',
                message: message,
                timestamp: new Date().toISOString(),
                requestId: req.id || 'unknown'
            });
        });
    }
    
    /**
     * Inicia o servidor
     */
    async start() {
        try {
            await this.initialize();
            
            const server = this.app.listen(this.port, () => {
                this.displayStartupBanner();
            });
            
            // Configurar graceful shutdown
            this.setupGracefulShutdown(server);
            
            return server;
            
        } catch (error) {
            this.logger.error('Falha ao iniciar servidor', { error: error.message });
            process.exit(1);
        }
    }
    
    /**
     * Exibe banner de inicialização
     */
    displayStartupBanner() {
        console.log('\n🚀 XMLITZ API v2.0 - Servidor iniciado');
        console.log(`📡 Servidor rodando em: http://localhost:${this.port}`);
        console.log('📋 Endpoints disponíveis:');
        console.log(`   GET  http://localhost:${this.port}/`);
        console.log(`   GET  http://localhost:${this.port}/health`);
        console.log(`   POST http://localhost:${this.port}/download`);
        console.log(`   GET  http://localhost:${this.port}/status/:id`);
        console.log(`   GET  http://localhost:${this.port}/executions`);
        console.log('');
        console.log('💡 Exemplo de uso:');
        console.log(`   curl -X POST http://localhost:${this.port}/download \\`);
        console.log(`        -H "Content-Type: application/json" \\`);
        console.log(`        -d '{"cnpj":"12345678000199","senha":"suasenha","startDate":"2025-07-01","endDate":"2025-07-31"}'`);
        console.log('');
        
        this.logger.info('Servidor XMLITZ API iniciado', {
            port: this.port,
            environment: this.config.getEnvironment(),
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * Configura graceful shutdown
     */
    setupGracefulShutdown(server) {
        const shutdown = async (signal) => {
            this.logger.info(`Recebido sinal ${signal}, iniciando shutdown graceful`);
            
            // Parar de aceitar novas conexões
            server.close(async () => {
                this.logger.info('Servidor HTTP fechado');
                
                try {
                    // Aguardar execuções em andamento terminarem
                    if (this.executionManager) {
                        await this.executionManager.shutdown();
                    }
                    
                    this.logger.info('Shutdown graceful concluído');
                    process.exit(0);
                } catch (error) {
                    this.logger.error('Erro durante shutdown', { error: error.message });
                    process.exit(1);
                }
            });
            
            // Forçar shutdown após timeout
            setTimeout(() => {
                this.logger.warn('Forçando shutdown após timeout');
                process.exit(1);
            }, 30000);
        };
        
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        
        process.on('uncaughtException', (error) => {
            this.errorHandler.handle(error, 'uncaught-exception');
            process.exit(1);
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            this.errorHandler.handle(new Error(`Unhandled Rejection: ${reason}`), 'unhandled-rejection');
            process.exit(1);
        });
    }
    
    /**
     * Obtém instância do app Express
     */
    getApp() {
        return this.app;
    }
}

// Inicializar e executar servidor se este arquivo for executado diretamente
// Corrigir para Windows - normalizar caminhos
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const currentFile = fileURLToPath(import.meta.url);
const executedFile = resolve(process.argv[1]);

if (currentFile === executedFile) {
    console.log('🔧 Iniciando servidor XMLITZ API...');
    const server = new XMLITZAPIServer();
    server.start().catch(error => {
        console.error('❌ Erro ao iniciar servidor:', error);
        process.exit(1);
    });
}

export default XMLITZAPIServer;
