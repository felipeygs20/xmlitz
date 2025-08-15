/**
 * Configuração de Rotas da API
 * Centraliza todas as rotas da aplicação
 */

import { Router } from 'express';
import { StatusController } from '../controllers/StatusController.js';
import { DownloadController } from '../controllers/DownloadController.js';
import { ExecutionController } from '../controllers/ExecutionController.js';
import { HealthController } from '../controllers/HealthController.js';

/**
 * Configura todas as rotas da API
 */
export function setupRoutes(app, config, executionManager) {
    const router = Router();
    
    // Inicializar controllers
    const statusController = new StatusController(config);
    const downloadController = new DownloadController(config, executionManager);
    const executionController = new ExecutionController(config, executionManager);
    const healthController = new HealthController(config);
    
    // Rotas de status e informações
    router.get('/', statusController.getStatus.bind(statusController));
    router.get('/health', healthController.getHealth.bind(healthController));
    
    // Rotas de download
    router.post('/download', downloadController.startDownload.bind(downloadController));
    
    // Rotas de execução
    router.get('/status/:id', executionController.getExecutionStatus.bind(executionController));
    router.get('/executions', executionController.listExecutions.bind(executionController));
    router.delete('/executions/:id', executionController.cancelExecution.bind(executionController));
    
    // Rotas de gerenciamento
    router.post('/executions/:id/retry', executionController.retryExecution.bind(executionController));
    router.get('/stats', executionController.getStats.bind(executionController));
    
    // Aplicar rotas ao app
    app.use('/', router);
    
    return router;
}
