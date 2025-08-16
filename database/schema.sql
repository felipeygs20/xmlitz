-- Schema SQLite para NFSe
-- Criado para armazenar lotes de XML e documentos NFSe individuais

-- Tabela de lotes (arquivos XML originais)
CREATE TABLE IF NOT EXISTS nfse_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,                    -- origem (ex: 'sistema', 'manual')
    filename TEXT NOT NULL,                  -- nome do arquivo original
    file_path TEXT,                          -- caminho do arquivo no sistema
    raw_xml TEXT NOT NULL,                   -- XML completo do lote
    checksum TEXT NOT NULL UNIQUE,           -- SHA256 do XML para dedupe
    size_bytes INTEGER,                      -- tamanho em bytes
    encoding TEXT DEFAULT 'ISO-8859-1',     -- encoding original
    total_nfse INTEGER DEFAULT 0,            -- quantidade de NFSe no lote
    processed_nfse INTEGER DEFAULT 0,        -- quantidade processada
    status TEXT DEFAULT 'pending',           -- pending, processing, completed, error
    error_message TEXT,                      -- mensagem de erro se houver
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para batches
CREATE INDEX IF NOT EXISTS idx_nfse_batches_checksum ON nfse_batches(checksum);
CREATE INDEX IF NOT EXISTS idx_nfse_batches_status ON nfse_batches(status);
CREATE INDEX IF NOT EXISTS idx_nfse_batches_created_at ON nfse_batches(created_at);

-- Tabela de documentos NFSe individuais
CREATE TABLE IF NOT EXISTS nfse_docs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,              -- referência ao lote
    
    -- Identificação da NFSe
    numero TEXT,                             -- número da NFSe
    codigo_verificacao TEXT,                 -- código de verificação
    data_emissao DATETIME,                   -- data de emissão
    competencia DATETIME,                    -- competência
    
    -- Prestador
    prestador_cnpj TEXT,                     -- CNPJ do prestador
    prestador_razao_social TEXT,             -- razão social do prestador
    prestador_inscricao_municipal TEXT,      -- inscrição municipal
    
    -- Tomador
    tomador_cnpj TEXT,                       -- CNPJ do tomador
    tomador_razao_social TEXT,               -- razão social do tomador
    
    -- Valores
    valor_servicos DECIMAL(15,2),            -- valor dos serviços
    valor_liquido DECIMAL(15,2),             -- valor líquido
    valor_iss DECIMAL(15,2),                 -- valor do ISS
    aliquota DECIMAL(5,4),                   -- alíquota
    base_calculo DECIMAL(15,2),              -- base de cálculo
    
    -- Serviço
    item_lista_servico TEXT,                 -- código do serviço
    codigo_cnae TEXT,                        -- código CNAE
    discriminacao TEXT,                      -- discriminação do serviço
    codigo_municipio TEXT,                   -- código do município
    
    -- Dados técnicos
    xml_fragment TEXT,                       -- fragmento XML da NFSe (opcional)
    json_data TEXT,                          -- dados completos em JSON
    checksum TEXT NOT NULL UNIQUE,           -- SHA256 do JSON para dedupe
    size_bytes INTEGER,                      -- tamanho em bytes
    
    -- Controle
    processed BOOLEAN DEFAULT FALSE,         -- se foi processada
    status TEXT DEFAULT 'active',            -- active, cancelled, substituted
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (batch_id) REFERENCES nfse_batches(id) ON DELETE CASCADE
);

-- Índices para NFSe docs
CREATE INDEX IF NOT EXISTS idx_nfse_docs_batch_id ON nfse_docs(batch_id);
CREATE INDEX IF NOT EXISTS idx_nfse_docs_numero ON nfse_docs(numero);
CREATE INDEX IF NOT EXISTS idx_nfse_docs_checksum ON nfse_docs(checksum);
CREATE INDEX IF NOT EXISTS idx_nfse_docs_prestador_cnpj ON nfse_docs(prestador_cnpj);
CREATE INDEX IF NOT EXISTS idx_nfse_docs_tomador_cnpj ON nfse_docs(tomador_cnpj);
CREATE INDEX IF NOT EXISTS idx_nfse_docs_data_emissao ON nfse_docs(data_emissao);
CREATE INDEX IF NOT EXISTS idx_nfse_docs_competencia ON nfse_docs(competencia);
CREATE INDEX IF NOT EXISTS idx_nfse_docs_valor_liquido ON nfse_docs(valor_liquido);
CREATE INDEX IF NOT EXISTS idx_nfse_docs_status ON nfse_docs(status);

-- Tabela de logs de processamento
CREATE TABLE IF NOT EXISTS nfse_processing_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER,
    nfse_doc_id INTEGER,
    level TEXT NOT NULL,                     -- info, warn, error
    message TEXT NOT NULL,
    details TEXT,                            -- JSON com detalhes
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (batch_id) REFERENCES nfse_batches(id) ON DELETE CASCADE,
    FOREIGN KEY (nfse_doc_id) REFERENCES nfse_docs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_nfse_logs_batch_id ON nfse_processing_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_nfse_logs_level ON nfse_processing_logs(level);
CREATE INDEX IF NOT EXISTS idx_nfse_logs_created_at ON nfse_processing_logs(created_at);

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER IF NOT EXISTS update_nfse_batches_updated_at
    AFTER UPDATE ON nfse_batches
    FOR EACH ROW
BEGIN
    UPDATE nfse_batches SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_nfse_docs_updated_at
    AFTER UPDATE ON nfse_docs
    FOR EACH ROW
BEGIN
    UPDATE nfse_docs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Views úteis para consultas
CREATE VIEW IF NOT EXISTS v_nfse_summary AS
SELECT 
    d.id,
    d.numero,
    d.data_emissao,
    d.prestador_cnpj,
    d.prestador_razao_social,
    d.tomador_cnpj,
    d.tomador_razao_social,
    d.valor_liquido,
    d.discriminacao,
    d.status,
    b.filename as batch_filename,
    b.created_at as batch_created_at
FROM nfse_docs d
JOIN nfse_batches b ON d.batch_id = b.id
WHERE d.status = 'active';

-- View para estatísticas por lote
CREATE VIEW IF NOT EXISTS v_batch_stats AS
SELECT 
    b.id,
    b.filename,
    b.status,
    b.total_nfse,
    b.processed_nfse,
    COUNT(d.id) as docs_inserted,
    SUM(CASE WHEN d.status = 'active' THEN 1 ELSE 0 END) as docs_active,
    SUM(d.valor_liquido) as total_valor_liquido,
    b.created_at,
    b.updated_at
FROM nfse_batches b
LEFT JOIN nfse_docs d ON b.id = d.batch_id
GROUP BY b.id, b.filename, b.status, b.total_nfse, b.processed_nfse, b.created_at, b.updated_at;
