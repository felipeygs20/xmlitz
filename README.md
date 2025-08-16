# 🚀 NFSe XML Downloader

Sistema automatizado para download e organização de arquivos XML de Notas Fiscais de Serviços Eletrônicos (NFSe) do sistema Prefeitura Moderna.

## ✨ Funcionalidades

### 🔄 Download Automatizado
- **Login automático** no sistema Prefeitura Moderna
- **Downloads paralelos** (configurável) para máxima velocidade
- **Sistema de retry** com backoff exponencial
- **Validação automática** de arquivos baixados
- **Detecção inteligente** de duplicatas

### 🗂️ Organização Automática
- **Estrutura hierárquica** baseada em competência e CNPJ
- **Extração automática** de dados do XML (competência, CNPJ, número)
- **Criação automática** de diretórios
- **Movimentação inteligente** de arquivos

### 📊 Relatórios e Logs
- **Logs estruturados** em JSON com métricas de performance
- **Relatórios detalhados** de download e organização
- **Métricas em tempo real** de progresso
- **Sistema de quarentena** para arquivos inválidos

## 🏗️ Estrutura de Organização

Os arquivos são organizados automaticamente na seguinte estrutura:

```
xmls-nfse/organized/
└── YYYY/                    ← Ano da competência
    └── MMYYYY/              ← Mês+Ano (ex: 072025)
        └── CNPJ/            ← CNPJ do prestador
            └── arquivo.xml  ← Arquivo XML original
```

**Exemplo:**
```
xmls-nfse/organized/
└── 2025/
    └── 072025/
        └── 34194865000158/
            ├── Nfse-16082025193013-250000055.xml
            ├── Nfse-16082025193013-250000056.xml
            └── ...
```

## 🚀 Instalação

### Pré-requisitos
- **Node.js** 16+ 
- **npm** ou **yarn**

### Dependências
```bash
npm install puppeteer
```

### Configuração
1. Clone o repositório
2. Instale as dependências
3. Configure suas credenciais no arquivo `nfse-downloader.js`:

```javascript
const CONFIG = {
    CNPJ: 'SEU_CNPJ_AQUI',
    SENHA: 'SUA_SENHA_AQUI',
    DATA_INICIAL: '2025-07-01',
    DATA_FINAL: '2025-08-01'
};
```

## 📖 Uso

### Download e Organização Completa
```bash
node nfse-downloader.js
```

### Apenas Organizar Arquivos Existentes
```bash
node organize-xmls.js
```

## ⚙️ Configurações Avançadas

### Performance
```javascript
PARALLEL_DOWNLOADS: 2,        // Downloads simultâneos
DELAY_BETWEEN_DOWNLOADS: 500, // Delay entre downloads (ms)
DOWNLOAD_TIMEOUT: 8000,       // Timeout por download (ms)
```

### Validação
```javascript
VALIDATE_XML: true,              // Validar estrutura XML
CHECK_FILE_SIZE: true,           // Verificar tamanho mínimo
DUPLICATE_CHECK: true,           // Verificar duplicatas
SMART_DUPLICATE_HANDLING: true,  // Tratamento inteligente
```

### Organização
```javascript
AUTO_ORGANIZE: true,           // Organizar automaticamente
ORGANIZE_BASE_DIR: 'organized' // Diretório base
```

## 📊 Relatórios

### Relatório de Download
- Taxa de sucesso
- Tempo total de execução
- Métricas de performance
- Arquivos baixados/falharam
- Recomendações de otimização

### Relatório de Organização
- Arquivos organizados
- Estrutura de diretórios criada
- Duplicatas detectadas
- Erros de processamento

## 🛡️ Validação e Segurança

### Validação de XML
- ✅ Estrutura XML válida
- ✅ Conteúdo NFSe específico
- ✅ Arquivo não truncado
- ✅ Tamanho mínimo

### Validação de Dados
- ✅ CNPJ válido (formato e dígitos)
- ✅ Data de competência válida
- ✅ Números de NFSe válidos

### Sistema de Quarentena
Arquivos inválidos são automaticamente movidos para quarentena com relatório detalhado.

## 🔧 Troubleshooting

### Problemas Comuns

**Timeout de Login:**
- Verifique credenciais
- Aumente `TIMEOUT` nas configurações

**Downloads Lentos:**
- Reduza `PARALLEL_DOWNLOADS`
- Aumente `DELAY_BETWEEN_DOWNLOADS`

**Arquivos em Quarentena:**
- Verifique logs de validação
- Confirme estrutura XML

### Logs Detalhados
```bash
# Ver logs em tempo real
tail -f nfse-detailed.log

# Ver apenas erros
grep "ERROR" nfse-detailed.log
```

## 📈 Performance

### Benchmarks Típicos
- **Login**: ~3s
- **Navegação**: ~4s  
- **Download por arquivo**: ~1s
- **Organização**: ~0.1s por arquivo

### Otimizações Implementadas
- Downloads paralelos
- Navegação direta via URL
- Timeouts otimizados
- Detecção rápida de downloads
- Validação em lote

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🆘 Suporte

Para suporte e dúvidas:
- Abra uma [Issue](../../issues)
- Consulte a [documentação](../../wiki)

## 🏆 Características Técnicas

- **100% JavaScript/Node.js**
- **Puppeteer** para automação web
- **Sistema de logs** estruturado
- **Arquitetura modular** e extensível
- **Tratamento robusto** de erros
- **Performance otimizada**

---

⭐ **Se este projeto foi útil, considere dar uma estrela!**
