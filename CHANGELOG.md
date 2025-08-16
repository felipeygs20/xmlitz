# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [2.0.0] - 2025-08-16

### ✨ Adicionado
- **Sistema de Organização Automática**
  - Estrutura hierárquica baseada em competência (YYYY/MMYYYY/CNPJ/)
  - Extração automática de dados do XML (competência, CNPJ, número)
  - Criação automática de diretórios
  - Movimentação inteligente de arquivos

- **Sistema de Logging Avançado**
  - Logs estruturados em JSON
  - Métricas de performance em tempo real
  - Categorização automática de erros
  - Relatórios detalhados de execução

- **Sistema de Validação Robusto**
  - Validação de estrutura XML específica para NFSe
  - Verificação de integridade com checksums MD5
  - Sistema de quarentena para arquivos inválidos
  - Detecção inteligente de duplicatas

- **Downloads Paralelos**
  - Processamento em lotes configurável
  - Otimização de performance com 2-3 downloads simultâneos
  - Garbage collection automático

- **Sistema de Retry Inteligente**
  - Backoff exponencial
  - 5 tentativas por download
  - Recuperação automática de erros de rede

### 🚀 Melhorado
- **Performance Otimizada**
  - Navegação direta via URL (elimina cliques no menu)
  - Timeouts otimizados (15s → 8s para downloads)
  - Delays reduzidos (2s → 500ms entre downloads)
  - Detecção rápida de downloads (100ms polling)

- **Tratamento de Duplicatas**
  - Lógica inteligente: ignora idênticos, sobrescreve diferentes
  - Comparação por checksum MD5
  - Logs informativos sobre ações tomadas

- **Relatórios Detalhados**
  - Relatório de download com métricas completas
  - Relatório de organização com estrutura criada
  - Recomendações automáticas de otimização
  - Exportação em JSON para análise

### 🔧 Corrigido
- Erro de variável `downloadResults is not defined`
- Problema de timeout em downloads lentos
- Detecção incorreta de arquivos baixados
- Logs duplicados em execuções múltiplas

### 📚 Documentação
- README.md completo com exemplos
- Arquivo de configuração de exemplo
- Documentação de troubleshooting
- Guia de contribuição

## [1.0.0] - 2025-08-15

### ✨ Adicionado
- **Funcionalidade Básica de Download**
  - Login automático no sistema Prefeitura Moderna
  - Download sequencial de XMLs NFSe
  - Configuração de período de busca
  - Logs básicos de execução

- **Configurações Iniciais**
  - Suporte a CNPJ e senha
  - Configuração de datas inicial e final
  - Modo headless configurável
  - Timeout básico

### 🚀 Melhorado
- Navegação automática para página de relatórios
- Preenchimento automático de formulários
- Download de arquivos XML

### 📦 Dependências
- Puppeteer para automação web
- Node.js 16+ como requisito mínimo

---

## Tipos de Mudanças
- `✨ Adicionado` para novas funcionalidades
- `🚀 Melhorado` para mudanças em funcionalidades existentes
- `🔧 Corrigido` para correção de bugs
- `📚 Documentação` para mudanças na documentação
- `🔒 Segurança` para correções de vulnerabilidades
- `📦 Dependências` para atualizações de dependências
