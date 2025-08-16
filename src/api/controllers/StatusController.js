/**
 * Controller de Status
 * Responsável por endpoints de informações da API
 */

import { logger } from '../../utils/OptimizedLogger.js';

export class StatusController {
    constructor(config) {
        this.config = config;
        this.logger = logger;
    }
    
    /**
     * GET / - Status geral da API
     */
    async getStatus(req, res) {
        try {
            const status = {
                service: 'XMLITZ API',
                version: '2.0.0',
                description: 'Sistema modular de Download de XMLs NFSe - Prefeitura de Imperatriz/MA',
                status: 'online',
                environment: this.config.getEnvironment(),
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                endpoints: {
                    'GET /': 'Status da API',
                    'GET /health': 'Health check detalhado',
                    'POST /download': 'Iniciar download de XMLs',
                    'GET /status/:id': 'Verificar status de execução',
                    'GET /executions': 'Listar todas as execuções',
                    'DELETE /executions/:id': 'Cancelar execução',
                    'POST /executions/:id/retry': 'Tentar execução novamente',
                    'GET /stats': 'Estatísticas gerais'
                },
                features: [
                    'Arquitetura modular e escalável',
                    'Sistema de logging estruturado',
                    'Tratamento de erros centralizado',
                    'Configuração flexível via arquivo e variáveis de ambiente',
                    'Sistema de retry inteligente',
                    'Suporte a paginação automática',
                    'Rate limiting básico',
                    'Execuções assíncronas com tracking'
                ],
                documentation: {
                    example: {
                        method: 'POST',
                        url: '/download',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: {
                            cnpj: '12345678000199',
                            senha: 'suasenha',
                            startDate: '2025-07-01',
                            endDate: '2025-07-31',
                            headless: true,
                            maxRetries: 3
                        }
                    }
                }
            };
            
            this.logger.debug('Status da API consultado', {
                requestId: req.id,
                userAgent: req.get('User-Agent')
            });
            
            res.json(status);
            
        } catch (error) {
            this.logger.error('Erro ao obter status da API', {
                requestId: req.id,
                error: error.message
            });
            
            res.status(500).json({
                error: 'Erro interno do servidor',
                message: 'Falha ao obter status da API'
            });
        }
    }
}
