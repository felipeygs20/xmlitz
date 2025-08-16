#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkDependencies() {
  log('🔍 Verificando dependências...', 'cyan');
  
  // Verificar se node_modules existe na raiz
  if (!fs.existsSync(join(__dirname, 'node_modules'))) {
    log('❌ Dependências da raiz não encontradas. Execute: npm install', 'red');
    return false;
  }
  
  // Verificar se node_modules existe no frontend
  if (!fs.existsSync(join(__dirname, 'frontend', 'node_modules'))) {
    log('❌ Dependências do frontend não encontradas. Execute: cd frontend && npm install', 'red');
    return false;
  }
  
  log('✅ Todas as dependências encontradas!', 'green');
  return true;
}

function startProcess(name, command, args, cwd, color) {
  return new Promise((resolve, reject) => {
    log(`🚀 Iniciando ${name}...`, color);
    
    const process = spawn(command, args, {
      cwd: cwd || __dirname,
      stdio: 'pipe',
      shell: true
    });

    process.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        log(`[${name}] ${output}`, color);
      }
    });

    process.stderr.on('data', (data) => {
      const output = data.toString().trim();
      if (output && !output.includes('ExperimentalWarning')) {
        log(`[${name}] ${output}`, 'yellow');
      }
    });

    process.on('close', (code) => {
      if (code === 0) {
        log(`✅ ${name} finalizado com sucesso`, 'green');
        resolve();
      } else {
        log(`❌ ${name} falhou com código ${code}`, 'red');
        reject(new Error(`${name} failed with code ${code}`));
      }
    });

    process.on('error', (error) => {
      log(`❌ Erro ao iniciar ${name}: ${error.message}`, 'red');
      reject(error);
    });

    return process;
  });
}

async function main() {
  log('🎯 XMLITZ NFSe - Sistema Completo', 'bright');
  log('=====================================', 'bright');
  
  // Verificar dependências
  if (!checkDependencies()) {
    log('\n📦 Para instalar todas as dependências, execute:', 'yellow');
    log('npm run install:all', 'cyan');
    process.exit(1);
  }

  log('\n🔥 Iniciando Backend e Frontend simultaneamente...', 'bright');
  
  try {
    // Iniciar backend
    const backendProcess = spawn('npm', ['run', 'backend:dev'], {
      cwd: __dirname,
      stdio: 'pipe',
      shell: true
    });

    // Iniciar frontend
    const frontendProcess = spawn('npm', ['run', 'frontend:dev'], {
      cwd: __dirname,
      stdio: 'pipe',
      shell: true
    });

    // Configurar outputs
    backendProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        log(`[BACKEND] ${output}`, 'blue');
      }
    });

    backendProcess.stderr.on('data', (data) => {
      const output = data.toString().trim();
      if (output && !output.includes('ExperimentalWarning')) {
        log(`[BACKEND] ${output}`, 'yellow');
      }
    });

    frontendProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        log(`[FRONTEND] ${output}`, 'magenta');
      }
    });

    frontendProcess.stderr.on('data', (data) => {
      const output = data.toString().trim();
      if (output && !output.includes('ExperimentalWarning')) {
        log(`[FRONTEND] ${output}`, 'yellow');
      }
    });

    // Aguardar um pouco e mostrar URLs
    setTimeout(() => {
      log('\n🌐 URLs do Sistema:', 'bright');
      log('📊 Backend API: http://localhost:3000', 'blue');
      log('🎨 Frontend:    http://localhost:3001', 'magenta');
      log('\n💡 Pressione Ctrl+C para parar ambos os serviços', 'yellow');
    }, 3000);

    // Lidar com Ctrl+C
    process.on('SIGINT', () => {
      log('\n🛑 Parando serviços...', 'yellow');
      backendProcess.kill('SIGINT');
      frontendProcess.kill('SIGINT');
      setTimeout(() => {
        log('👋 Serviços parados. Até logo!', 'green');
        process.exit(0);
      }, 1000);
    });

    // Aguardar os processos
    await Promise.all([
      new Promise((resolve) => backendProcess.on('close', resolve)),
      new Promise((resolve) => frontendProcess.on('close', resolve))
    ]);

  } catch (error) {
    log(`❌ Erro: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Executar apenas se for o arquivo principal
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    log(`❌ Erro fatal: ${error.message}`, 'red');
    process.exit(1);
  });
}
