/**
 * Configuração de Middlewares da API
 * Centraliza todos os middlewares customizados
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Configura middlewares customizados
 */
export function setupMiddlewares(app, config, logger) {
    // Middleware de request ID
    app.use(requestIdMiddleware);
    
    // Middleware de logging de requisições
    app.use(requestLoggingMiddleware(logger));
    
    // Middleware de rate limiting (básico)
    app.use(rateLimitingMiddleware());
    
    // Middleware de validação de content-type para POST/PUT
    app.use(contentTypeValidationMiddleware);
}

/**
 * Middleware para adicionar ID único a cada requisição
 */
function requestIdMiddleware(req, res, next) {
    req.id = uuidv4();
    res.header('X-Request-ID', req.id);
    next();
}

/**
 * Middleware para logging de requisições
 */
function requestLoggingMiddleware(logger) {
    return (req, res, next) => {
        const startTime = Date.now();
        
        // Log da requisição
        logger.info('Requisição recebida', {
            requestId: req.id,
            method: req.method,
            url: req.originalUrl,
            userAgent: req.get('User-Agent'),
            ip: req.ip || req.connection.remoteAddress
        });
        
        // Interceptar resposta para log
        const originalSend = res.send;
        res.send = function(data) {
            const duration = Date.now() - startTime;
            
            logger.info('Resposta enviada', {
                requestId: req.id,
                method: req.method,
                url: req.originalUrl,
                statusCode: res.statusCode,
                duration: `${duration}ms`
            });
            
            return originalSend.call(this, data);
        };
        
        next();
    };
}

/**
 * Middleware básico de rate limiting
 */
function rateLimitingMiddleware() {
    const requests = new Map();
    const windowMs = 15 * 60 * 1000; // 15 minutos
    const maxRequests = 100; // máximo 100 requests por IP por janela
    
    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        
        // Limpar entradas antigas
        for (const [key, data] of requests.entries()) {
            if (now - data.firstRequest > windowMs) {
                requests.delete(key);
            }
        }
        
        // Verificar limite para este IP
        const ipData = requests.get(ip);
        
        if (!ipData) {
            requests.set(ip, {
                count: 1,
                firstRequest: now
            });
        } else {
            ipData.count++;
            
            if (ipData.count > maxRequests) {
                return res.status(429).json({
                    error: 'Rate limit excedido',
                    message: `Máximo ${maxRequests} requisições por ${windowMs / 1000 / 60} minutos`,
                    retryAfter: Math.ceil((ipData.firstRequest + windowMs - now) / 1000)
                });
            }
        }
        
        // Adicionar headers de rate limit
        res.header('X-RateLimit-Limit', maxRequests);
        res.header('X-RateLimit-Remaining', Math.max(0, maxRequests - (ipData?.count || 1)));
        res.header('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
        
        next();
    };
}

/**
 * Middleware para validação de content-type
 */
function contentTypeValidationMiddleware(req, res, next) {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.get('Content-Type');
        
        if (!contentType || !contentType.includes('application/json')) {
            return res.status(400).json({
                error: 'Content-Type inválido',
                message: 'Content-Type deve ser application/json para requisições POST/PUT/PATCH',
                received: contentType || 'não especificado'
            });
        }
    }
    
    next();
}

/**
 * Middleware para validação de autenticação (se necessário no futuro)
 */
export function authenticationMiddleware(req, res, next) {
    // Implementar autenticação se necessário
    // Por enquanto, apenas passa adiante
    next();
}

/**
 * Middleware para validação de autorização (se necessário no futuro)
 */
export function authorizationMiddleware(requiredRole) {
    return (req, res, next) => {
        // Implementar autorização se necessário
        // Por enquanto, apenas passa adiante
        next();
    };
}
