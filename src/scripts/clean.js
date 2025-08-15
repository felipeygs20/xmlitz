#!/usr/bin/env node

/**
 * Script de Limpeza
 * Remove arquivos temporários, logs antigos e screenshots
 */

import fs from 'fs-extra';
import path from 'path';

async function clean() {
    console.log('🧹 Iniciando limpeza do projeto...\n');
    
    const cleanTasks = [
        {
            name: 'Logs antigos',
            path: './logs',
            pattern: /\.log$/,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
        },
        {
            name: 'Screenshots antigos',
            path: './screenshots',
            pattern: /\.(png|jpg|jpeg)$/,
            maxAge: 3 * 24 * 60 * 60 * 1000 // 3 dias
        },
        {
            name: 'Arquivos temporários',
            path: './',
            pattern: /\.(tmp|temp)$/,
            maxAge: 0 // Remover todos
        },
        {
            name: 'Screenshots de debug',
            path: './',
            pattern: /^(debug_screenshot|xmlitz_.*\.png)$/,
            maxAge: 24 * 60 * 60 * 1000 // 1 dia
        }
    ];
    
    let totalCleaned = 0;
    let totalSize = 0;
    
    for (const task of cleanTasks) {
        try {
            const result = await cleanDirectory(task);
            console.log(`✅ ${task.name}: ${result.count} arquivos removidos (${formatBytes(result.size)})`);
            totalCleaned += result.count;
            totalSize += result.size;
        } catch (error) {
            console.log(`❌ ${task.name}: Erro - ${error.message}`);
        }
    }
    
    console.log(`\n📊 Resumo da limpeza:`);
    console.log(`   • Total de arquivos removidos: ${totalCleaned}`);
    console.log(`   • Espaço liberado: ${formatBytes(totalSize)}`);
    console.log(`\n✨ Limpeza concluída!`);
}

async function cleanDirectory(task) {
    const { path: dirPath, pattern, maxAge } = task;
    
    if (!await fs.pathExists(dirPath)) {
        return { count: 0, size: 0 };
    }
    
    const files = await fs.readdir(dirPath);
    const cutoffTime = Date.now() - maxAge;
    
    let count = 0;
    let size = 0;
    
    for (const file of files) {
        if (!pattern.test(file)) continue;
        
        const filePath = path.join(dirPath, file);
        
        try {
            const stats = await fs.stat(filePath);
            
            if (stats.mtime.getTime() < cutoffTime) {
                size += stats.size;
                await fs.remove(filePath);
                count++;
            }
        } catch (error) {
            // Ignorar erros de arquivos individuais
        }
    }
    
    return { count, size };
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
    clean().catch(console.error);
}

export { clean };
