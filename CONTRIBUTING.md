# 🤝 Contribuindo para o NFSe XML Downloader

Obrigado por considerar contribuir para este projeto! Sua ajuda é muito bem-vinda.

## 📋 Código de Conduta

Este projeto adere a um código de conduta. Ao participar, você deve seguir este código.

## 🚀 Como Contribuir

### 🐛 Reportando Bugs

Antes de reportar um bug, verifique se ele já não foi reportado nas [Issues](../../issues).

Para reportar um bug, abra uma nova issue incluindo:

- **Título claro e descritivo**
- **Descrição detalhada** do problema
- **Passos para reproduzir** o bug
- **Comportamento esperado** vs **comportamento atual**
- **Screenshots** (se aplicável)
- **Informações do ambiente**:
  - Versão do Node.js
  - Sistema operacional
  - Versão do projeto

### ✨ Sugerindo Melhorias

Para sugerir uma melhoria:

1. Verifique se a sugestão já não existe nas issues
2. Abra uma nova issue com o label "enhancement"
3. Descreva claramente a melhoria proposta
4. Explique por que seria útil para o projeto

### 🔧 Contribuindo com Código

#### Configuração do Ambiente

1. **Fork** o repositório
2. **Clone** seu fork:
   ```bash
   git clone https://github.com/seu-usuario/xmlitz.git
   cd xmlitz
   ```
3. **Instale** as dependências:
   ```bash
   npm install
   ```
4. **Configure** suas credenciais:
   ```bash
   cp config.example.js config.local.js
   # Edite config.local.js com suas credenciais
   ```

#### Processo de Desenvolvimento

1. **Crie uma branch** para sua feature:
   ```bash
   git checkout -b feature/nome-da-feature
   ```

2. **Faça suas mudanças** seguindo as diretrizes de código

3. **Teste** suas mudanças:
   ```bash
   npm start
   ```

4. **Commit** suas mudanças:
   ```bash
   git commit -m "feat: adiciona nova funcionalidade"
   ```

5. **Push** para sua branch:
   ```bash
   git push origin feature/nome-da-feature
   ```

6. **Abra um Pull Request**

#### Diretrizes de Código

- **Estilo de Código**:
  - Use 4 espaços para indentação
  - Nomes de variáveis em camelCase
  - Nomes de constantes em UPPER_CASE
  - Comentários em português

- **Estrutura de Commits**:
  - Use [Conventional Commits](https://www.conventionalcommits.org/)
  - Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
  - Exemplos:
    ```
    feat: adiciona sistema de retry automático
    fix: corrige timeout em downloads lentos
    docs: atualiza README com novas configurações
    ```

- **Logs e Debugging**:
  - Use o sistema de logging existente
  - Adicione logs informativos para novas funcionalidades
  - Use níveis apropriados (DEBUG, INFO, WARN, ERROR)

#### Estrutura do Projeto

```
xmlitz/
├── nfse-downloader.js      # Script principal
├── organize-xmls.js        # Script de organização
├── config.example.js       # Configuração de exemplo
├── package.json           # Dependências e scripts
├── README.md              # Documentação principal
├── CHANGELOG.md           # Histórico de mudanças
├── CONTRIBUTING.md        # Este arquivo
├── LICENSE                # Licença MIT
├── .gitignore            # Arquivos ignorados
└── xmls-nfse/            # Diretório de downloads
    ├── organized/        # Arquivos organizados
    └── quarantine/       # Arquivos inválidos
```

### 🧪 Testando

Antes de submeter um PR:

1. **Teste o download** com um período pequeno
2. **Verifique a organização** automática
3. **Confirme os logs** estão funcionando
4. **Teste cenários de erro** (credenciais inválidas, etc.)

### 📝 Documentação

Ao adicionar novas funcionalidades:

1. **Atualize o README.md** se necessário
2. **Adicione comentários** no código
3. **Documente configurações** novas
4. **Atualize o CHANGELOG.md**

## 🏷️ Versionamento

Este projeto usa [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0): Mudanças incompatíveis
- **MINOR** (0.X.0): Novas funcionalidades compatíveis
- **PATCH** (0.0.X): Correções de bugs

## 📞 Suporte

Se precisar de ajuda:

1. Consulte a [documentação](README.md)
2. Procure nas [issues existentes](../../issues)
3. Abra uma nova issue com a tag "question"

## 🎯 Áreas que Precisam de Ajuda

- **Testes automatizados**
- **Suporte a outros sistemas** de NFSe
- **Interface gráfica** (GUI)
- **Melhorias de performance**
- **Documentação** e exemplos
- **Tratamento de erros** específicos

## 🙏 Reconhecimento

Todos os contribuidores serão reconhecidos no README.md.

---

**Obrigado por contribuir! 🚀**
