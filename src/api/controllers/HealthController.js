/**
 * Controller de Health Check
 * Responsável por verificações de saúde da aplicação
 */

import { Logger } from '../../utils/Logger.js';

export class HealthController {
    constructor(config) {
        this.config = config;
        this.logger = Logger.getInstance();
    }
    
    /**
     * GET /health - Health check detalhado
     */
    async getHealth(req, res) {
        try {
            const startTime = Date.now();
            
            // Verificações de saúde
            const healthChecks = await this.performHealthChecks();
            
            const duration = Date.now() - startTime;
            const isHealthy = healthChecks.every(check => check.status === 'ok');
            
            const health = {
                status: isHealthy ? 'healthy' : 'unhealthy',
                timestamp: new Date().toISOString(),
                duration: `${duration}ms`,
                version: '2.0.0',
                environment: this.config.getEnvironment(),
                uptime: process.uptime(),
                checks: healthChecks,
                system: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    arch: process.arch,
                    memory: {
                        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                        external: Math.round(process.memoryUsage().external / 1024 / 1024)
                    },
                    cpu: {
                        usage: process.cpuUsage()
                    }
                }
            };
            
            const statusCode = isHealthy ? 200 : 503;
            
            this.logger.debug('Health check executado', {
                requestId: req.id,
                status: health.status,
                duration: health.duration,
                checksCount: healthChecks.length
            });
            
            res.status(statusCode).json(health);
            
        } catch (error) {
            this.logger.error('Erro no health check', {
                requestId: req.id,
                error: error.message
            });
            
            res.status(503).json({
                status: 'unhealthy',
                error: 'Falha no health check',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    /**
     * Executa verificações de saúde
     */
    async performHealthChecks() {
        const checks = [];
        
        // Check 1: Configuração
        checks.push(await this.checkConfiguration());
        
        // Check 2: Sistema de arquivos
        checks.push(await this.checkFileSystem());
        
        // Check 3: Memória
        checks.push(await this.checkMemory());
        
        // Check 4: Dependências
        checks.push(await this.checkDependencies());
        
        return checks;
    }
    
    /**
     * Verifica configuração
     */
    async checkConfiguration() {
        try {
            const config = this.config.getAll();
            
            // Verificar se configurações essenciais estão presentes
            const hasCredentials = config.credentials && 
                                 config.credentials.username && 
                                 config.credentials.password;
            
            const hasUrls = config.urls && 
                          config.urls.base && 
                          config.urls.login && 
                          config.urls.reports;
            
            const hasTimeouts = config.timeouts && 
                              config.timeouts.navigation && 
                              config.timeouts.element;
            
            if (hasCredentials && hasUrls && hasTimeouts) {
                return {
                    name: 'configuration',
                    status: 'ok',
                    message: 'Configuração válida',
                    details: {
                        environment: this.config.getEnvironment(),
                        hasCredentials: true,
                        hasUrls: true,
                        hasTimeouts: true
                    }
                };
            } else {
                return {
                    name: 'configuration',
                    status: 'error',
                    message: 'Configuração incompleta',
                    details: {
                        hasCredentials,
                        hasUrls,
                        hasTimeouts
                    }
                };
            }
            
        } catch (error) {
            return {
                name: 'configuration',
                status: 'error',
                message: 'Erro ao verificar configuração',
                error: error.message
            };
        }
    }
    
    /**
     * Verifica sistema de arquivos
     */
    async checkFileSystem() {
        try {
            const fs = await import('fs-extra');
            const downloadPath = this.config.get('download.path');
            
            // Verificar se diretório de download existe e é acessível
            const exists = await fs.pathExists(downloadPath);
            
            if (exists) {
                // Tentar criar arquivo de teste
                const testFile = `${downloadPath}/health-check-${Date.now()}.tmp`;
                await fs.writeFile(testFile, 'health check test');
                await fs.remove(testFile);
                
                return {
                    name: 'filesystem',
                    status: 'ok',
                    message: 'Sistema de arquivos acessível',
                    details: {
                        downloadPath: downloadPath,
                        writable: true
                    }
                };
            } else {
                return {
                    name: 'filesystem',
                    status: 'warning',
                    message: 'Diretório de download não existe',
                    details: {
                        downloadPath: downloadPath,
                        exists: false
                    }
                };
            }
            
        } catch (error) {
            return {
                name: 'filesystem',
                status: 'error',
                message: 'Erro no sistema de arquivos',
                error: error.message
            };
        }
    }
    
    /**
     * Verifica uso de memória
     */
    async checkMemory() {
        try {
            const memUsage = process.memoryUsage();
            const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
            const totalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
            const usagePercent = Math.round((usedMB / totalMB) * 100);
            
            let status = 'ok';
            let message = 'Uso de memória normal';
            
            if (usagePercent > 90) {
                status = 'error';
                message = 'Uso de memória crítico';
            } else if (usagePercent > 75) {
                status = 'warning';
                message = 'Uso de memória alto';
            }
            
            return {
                name: 'memory',
                status: status,
                message: message,
                details: {
                    used: `${usedMB}MB`,
                    total: `${totalMB}MB`,
                    percentage: `${usagePercent}%`,
                    external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
                }
            };
            
        } catch (error) {
            return {
                name: 'memory',
                status: 'error',
                message: 'Erro ao verificar memória',
                error: error.message
            };
        }
    }
    
    /**
     * Verifica dependências críticas
     */
    async checkDependencies() {
        try {
            const dependencies = [];
            
            // Verificar Puppeteer
            try {
                const puppeteer = await import('puppeteer');
                dependencies.push({
                    name: 'puppeteer',
                    status: 'ok',
                    version: puppeteer.default.version || 'unknown'
                });
            } catch (e) {
                dependencies.push({
                    name: 'puppeteer',
                    status: 'error',
                    error: e.message
                });
            }
            
            // Verificar Express
            try {
                const express = await import('express');
                dependencies.push({
                    name: 'express',
                    status: 'ok',
                    version: 'loaded'
                });
            } catch (e) {
                dependencies.push({
                    name: 'express',
                    status: 'error',
                    error: e.message
                });
            }
            
            const allOk = dependencies.every(dep => dep.status === 'ok');
            
            return {
                name: 'dependencies',
                status: allOk ? 'ok' : 'error',
                message: allOk ? 'Todas as dependências carregadas' : 'Algumas dependências falharam',
                details: dependencies
            };
            
        } catch (error) {
            return {
                name: 'dependencies',
                status: 'error',
                message: 'Erro ao verificar dependências',
                error: error.message
            };
        }
    }
}
