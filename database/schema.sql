-- ============================================================================
-- ClimaFy — Schema do banco de dados (MySQL 8.x)
-- ============================================================================
-- COMO RODAR:
--   * Automaticamente: npm run db:schema  (aplica no banco definido no .env)
--   * Workbench: selecione o banco alvo na sidebar (ex.: b81opqpte2pn2kobvspa)
--     e execute o script inteiro (botao de raio ⚡).
--
-- ADAPTACAO PARA A CLEVER CLOUD (importante):
--   O script original comecava com "DROP DATABASE climafy; CREATE DATABASE
--   climafy; USE climafy". Na Clever Cloud o banco JA EXISTE e se chama
--   b81opqpte2pn2kobvspa — e e nele que o app conecta (DB_DATABASE do .env).
--   Por isso este arquivo:
--     1) NAO cria nem seleciona banco: opera sempre no banco da conexao;
--     2) Limpa as tabelas antes de criar (idempotente: pode rodar varias
--        vezes sem erro).
--   Em um MySQL local, se quiser o nome "climafy", descomente o bloco abaixo,
--   rode uma vez no Workbench e aponte DB_DATABASE=climafy no .env.
--
-- (Opcional, somente MySQL local)
-- DROP DATABASE IF EXISTS climafy;
-- CREATE DATABASE climafy CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
-- USE climafy;
--
-- =====================================================================
-- OBSERVACOES DE IMPLEMENTACAO:
--  - Chave primaria: BIGINT UNSIGNED AUTO_INCREMENT em todas as tabelas.
--  - Identificador publico (UUID) apenas em usuarios e relatos, para nao
--    expor IDs sequenciais nas URLs do front-end.
--  - Charset utf8mb4 / collation utf8mb4_0900_ai_ci (MySQL 8).
--  - Engine InnoDB em todas as tabelas (FK, transacoes, integridade).
--  - Valores monetarios em DECIMAL(15,2). Nunca FLOAT.
--  - Coordenadas em DECIMAL(10,7) (opcao mais simples que POINT/SRID,
--    suficiente para a precisao de exibicao em mapa do front-end atual).
--  - Datas em DATETIME, gravadas em UTC pela aplicacao.
--  - JSON apenas para preservar a linha originalmente importada
--    (dados_originais_json), nunca substituindo campos relacionais.
--  - Contadores (numero de votos, ranking, etc.) nao sao armazenados:
--    devem ser calculados via consulta/view quando nao houver a
--    necessidade de historico (ex.: contagem de votos de um relato).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Banco de dados (adaptado: opera no banco da conexao — ver cabecalho)
-- ---------------------------------------------------------------------
SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- 0.1 Limpeza idempotente (ordem irrelevante com FK checks desligadas)
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS
    logs_auditoria, snapshot_resultados, snapshot_lotes, snapshots_prioridade,
    execucoes_orcamentarias, ocorrencias_oficiais, lotes_importacao, fontes_dados,
    notificacoes, preferencias_bairros, preferencias_categorias, preferencias_notificacao,
    moderacoes_relato, motivos_moderacao, historico_status_relato, relato_votos,
    relato_midias, relatos, categorias_ocorrencia, bairros, distritos,
    subprefeituras, cidades, consentimentos_usuario, documentos_legais,
    codigos_verificacao_email, usuarios, papeis;
SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- 1. NUCLEO DE USUARIOS E ACESSO
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1.1 papeis
-- ---------------------------------------------------------------------
CREATE TABLE papeis (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    codigo      VARCHAR(30)     NOT NULL,
    nome        VARCHAR(60)     NOT NULL,
    descricao   VARCHAR(255)    NULL,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                 ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_papeis_codigo (codigo)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Catalogo de perfis de acesso (cidadao, moderador, administrador). Registros controlados pelo sistema.';

-- ---------------------------------------------------------------------
-- 1.2 usuarios
-- ---------------------------------------------------------------------
-- COMENTÁRIO PRO CARINHA DO BACK: a coluna senha_hash está correta (nunca plaintext).
-- Regra para backend: hashear com bcrypt/argon2 antes de persistir; nunca retornar senha_hash no response.
CREATE TABLE usuarios (
    id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id             CHAR(36)        NOT NULL DEFAULT (UUID()),
    papel_id              BIGINT UNSIGNED NOT NULL,
    nome                  VARCHAR(120)    NOT NULL,
    sobrenome             VARCHAR(80)     NOT NULL,
    email                 VARCHAR(190)    NOT NULL,
    senha_hash            VARCHAR(255)    NOT NULL,
    status                ENUM('ativo','inativo','bloqueado')
                                          NOT NULL DEFAULT 'ativo',
    email_verificado_em   DATETIME        NULL,
    ultimo_acesso_em      DATETIME        NULL,
    anonimizado_em        DATETIME        NULL
        COMMENT 'Preenchido pela rotina de retencao ao anonimizar dados pessoais apos exclusao de conta (ate 30 dias).',
    created_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                          ON UPDATE CURRENT_TIMESTAMP,
    deleted_at            DATETIME        NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_usuarios_public_id (public_id),
    UNIQUE KEY uk_usuarios_email (email),
    KEY idx_usuarios_status (status),
    KEY idx_usuarios_nome (nome, sobrenome),
    CONSTRAINT fk_usuarios_papel
        FOREIGN KEY (papel_id) REFERENCES papeis (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Conta, autenticacao, perfil e estado do usuario. Sempre exigido para criar relato (sem anonimo). Soft delete via deleted_at.';

-- ---------------------------------------------------------------------
-- 1.3 codigos_verificacao_email
-- ---------------------------------------------------------------------
CREATE TABLE codigos_verificacao_email (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuario_id    BIGINT UNSIGNED NOT NULL,
    codigo_hash   CHAR(64)        NOT NULL COMMENT 'Hash (ex.: SHA-256) do codigo, nunca texto puro.',
    finalidade    ENUM('cadastro','alteracao_email','recuperacao_senha')
                                  NOT NULL,
    expira_em     DATETIME        NOT NULL,
    consumido_em  DATETIME        NULL,
    tentativas    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_cve_usuario_expira_consumido (usuario_id, expira_em, consumido_em),
    CONSTRAINT fk_cve_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Codigos temporarios de validacao (e-mail, recuperacao de senha). Dado transitorio, delete fisico controlado por rotina.';

-- ---------------------------------------------------------------------
-- 1.4 documentos_legais
-- ---------------------------------------------------------------------
CREATE TABLE documentos_legais (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tipo            ENUM('termos_uso','politica_privacidade') NOT NULL,
    versao          VARCHAR(20)     NOT NULL,
    titulo          VARCHAR(150)    NOT NULL,
    conteudo_url    VARCHAR(500)    NULL,
    conteudo        MEDIUMTEXT      NULL,
    publicado_em    DATETIME        NOT NULL,
    ativo           TINYINT(1)      NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uk_documentos_legais_tipo_versao (tipo, versao)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Versoes de termos de uso e politica de privacidade, com aceite versionado.';

-- ---------------------------------------------------------------------
-- 1.5 consentimentos_usuario
-- ---------------------------------------------------------------------
CREATE TABLE consentimentos_usuario (
    id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuario_id            BIGINT UNSIGNED NOT NULL,
    documento_legal_id    BIGINT UNSIGNED NOT NULL,
    aceito_em             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_hash               CHAR(64)        NULL,
    user_agent            VARCHAR(255)    NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_consentimentos_usuario_documento (usuario_id, documento_legal_id),
    CONSTRAINT fk_consentimentos_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_consentimentos_documento
        FOREIGN KEY (documento_legal_id) REFERENCES documentos_legais (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Registro imutavel do aceite de cada versao de documento legal por usuario.';

-- =====================================================================
-- 2. GEOGRAFIA (cidade > subprefeitura > distrito [oficial] > bairro [complementar])
-- =====================================================================

-- ---------------------------------------------------------------------
-- 2.1 cidades
-- ---------------------------------------------------------------------
CREATE TABLE cidades (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    nome                VARCHAR(120)    NOT NULL,
    codigo_ibge         CHAR(7)         NULL,
    uf                  CHAR(2)         NOT NULL,
    latitude_centro     DECIMAL(10,7)   NULL,
    longitude_centro    DECIMAL(10,7)   NULL,
    ativo               TINYINT(1)      NOT NULL DEFAULT 1,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_cidades_codigo_ibge (codigo_ibge)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Municipios cobertos pela plataforma.';

-- ---------------------------------------------------------------------
-- 2.2 subprefeituras
-- ---------------------------------------------------------------------
CREATE TABLE subprefeituras (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    cidade_id           BIGINT UNSIGNED NOT NULL,
    nome                VARCHAR(120)    NOT NULL,
    nome_normalizado    VARCHAR(120)    NOT NULL,
    slug                VARCHAR(140)    NOT NULL,
    codigo_externo      VARCHAR(30)     NULL,
    ativo               TINYINT(1)      NOT NULL DEFAULT 1,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_subprefeituras_cidade_nome (cidade_id, nome_normalizado),
    UNIQUE KEY uk_subprefeituras_slug (slug),
    CONSTRAINT fk_subprefeituras_cidade
        FOREIGN KEY (cidade_id) REFERENCES cidades (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Divisao administrativa oficial de nivel 1, usada em mapas, ranking e cruzamento territorial.';

-- ---------------------------------------------------------------------
-- 2.3 distritos  (divisao territorial OFICIAL - Lei Municipal 13.399/2002)
-- ---------------------------------------------------------------------
CREATE TABLE distritos (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    subprefeitura_id    BIGINT UNSIGNED NOT NULL,
    nome                VARCHAR(120)    NOT NULL,
    nome_normalizado    VARCHAR(120)    NOT NULL,
    codigo_oficial      VARCHAR(30)     NULL,
    ativo               TINYINT(1)      NOT NULL DEFAULT 1,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_distritos_subprefeitura_nome (subprefeitura_id, nome_normalizado),
    UNIQUE KEY uk_distritos_codigo_oficial (codigo_oficial),
    CONSTRAINT fk_distritos_subprefeitura
        FOREIGN KEY (subprefeitura_id) REFERENCES subprefeituras (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Distrito: unidade territorial OFICIAL, vinculo obrigatorio a subprefeitura. Base do cruzamento com ocorrencias e execucoes orcamentarias.';

-- ---------------------------------------------------------------------
-- 2.4 bairros  (complementar / popular - vinculo com distrito opcional)
-- ---------------------------------------------------------------------
CREATE TABLE bairros (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    cidade_id           BIGINT UNSIGNED NOT NULL,
    distrito_id         BIGINT UNSIGNED NULL
        COMMENT 'Vinculo opcional e possivelmente ambiguo com o distrito oficial. NULL quando nao mapeado.',
    nome                VARCHAR(120)    NOT NULL,
    nome_normalizado    VARCHAR(120)    NOT NULL,
    slug                VARCHAR(140)    NOT NULL,
    codigo_externo      VARCHAR(30)     NULL,
    latitude_centro     DECIMAL(10,7)   NULL
        COMMENT 'Centro geografico aproximado do bairro (fonte: OpenStreetMap).',
    longitude_centro    DECIMAL(10,7)   NULL
        COMMENT 'Centro geografico aproximado do bairro (fonte: OpenStreetMap).',
    ativo               TINYINT(1)      NOT NULL DEFAULT 1,
    created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_bairros_cidade_nome (cidade_id, nome_normalizado),
    KEY idx_bairros_slug (slug),
    KEY idx_bairros_distrito (distrito_id),
    CONSTRAINT fk_bairros_cidade
        FOREIGN KEY (cidade_id) REFERENCES cidades (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_bairros_distrito
        FOREIGN KEY (distrito_id) REFERENCES distritos (id)
        ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Bairro: recorte popular usado em filtros, formularios e exibicao. Nao e a base oficial de cruzamento territorial.';

-- =====================================================================
-- 3. CATEGORIAS E RELATOS
-- =====================================================================

-- ---------------------------------------------------------------------
-- 3.1 categorias_ocorrencia
-- ---------------------------------------------------------------------
CREATE TABLE categorias_ocorrencia (
    id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    nome              VARCHAR(80)     NOT NULL,
    slug              VARCHAR(100)    NOT NULL,
    descricao         VARCHAR(255)    NULL,
    cor               CHAR(7)         NULL COMMENT 'Cor hexadecimal, ex.: #1E88E5',
    icone             VARCHAR(60)     NULL,
    ativo             TINYINT(1)      NOT NULL DEFAULT 1,
    ordem_exibicao    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                      ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_categorias_slug (slug)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Tipos de problema urbano usados no formulario de relato, filtros e preferencias.';

-- ---------------------------------------------------------------------
-- 3.2 relatos
-- ---------------------------------------------------------------------
CREATE TABLE relatos (
    id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id              CHAR(36)        NOT NULL DEFAULT (UUID()),
    usuario_id             BIGINT UNSIGNED NOT NULL,
    categoria_id           BIGINT UNSIGNED NOT NULL,
    cidade_id              BIGINT UNSIGNED NOT NULL,
    bairro_id              BIGINT UNSIGNED NOT NULL
                                           COMMENT 'Bairro do relato (obrigatorio: nivel hiperlocal).',
    titulo                 VARCHAR(80)     NOT NULL,
    descricao              VARCHAR(280)    NOT NULL,
    gravidade              ENUM('leve','moderada','grave','critica') NOT NULL DEFAULT 'moderada',
    status                 ENUM('pendente','em_analise','resolvido','rejeitado')
                                           NOT NULL DEFAULT 'pendente',
    latitude               DECIMAL(10,7)   NOT NULL,
    longitude              DECIMAL(10,7)   NOT NULL,
    endereco_referencia    VARCHAR(255)    NULL,
    resolvido_em           DATETIME        NULL,
    created_at             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                           ON UPDATE CURRENT_TIMESTAMP,
    deleted_at             DATETIME        NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_relatos_public_id (public_id),
    KEY idx_relatos_status_created (status, created_at),
    KEY idx_relatos_bairro_status_created (bairro_id, status, created_at),
    KEY idx_relatos_categoria_status_created (categoria_id, status, created_at),
    KEY idx_relatos_usuario_created (usuario_id, created_at),
    FULLTEXT KEY ftx_relatos_titulo_descricao (titulo, descricao),
    CONSTRAINT fk_relatos_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_relatos_categoria
        FOREIGN KEY (categoria_id) REFERENCES categorias_ocorrencia (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_relatos_cidade
        FOREIGN KEY (cidade_id) REFERENCES cidades (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_relatos_bairro
        FOREIGN KEY (bairro_id) REFERENCES bairros (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Relatos enviados pelos usuarios autenticados. Subprefeitura e distrito sao derivados via bairro->distrito->subprefeitura quando disponiveis.';

-- ---------------------------------------------------------------------
-- 3.3 relato_midias
-- ---------------------------------------------------------------------
CREATE TABLE relato_midias (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    relato_id        BIGINT UNSIGNED NOT NULL,
    tipo             ENUM('foto','video') NOT NULL DEFAULT 'foto',
    chave_arquivo    VARCHAR(255)    NOT NULL COMMENT 'Caminho/chave no storage de arquivos.',
    mime_type        VARCHAR(100)    NOT NULL,
    tamanho_bytes    INT UNSIGNED    NOT NULL,
    ordem            TINYINT UNSIGNED NOT NULL DEFAULT 0,
    created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_relato_midias_relato_ordem (relato_id, ordem),
    CONSTRAINT fk_relato_midias_relato
        FOREIGN KEY (relato_id) REFERENCES relatos (id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT chk_relato_midias_tamanho
        CHECK (tamanho_bytes <= 5242880),
    CONSTRAINT chk_relato_midias_mime
        CHECK (
            (tipo = 'foto'  AND mime_type IN ('image/png','image/jpeg')) OR
            (tipo = 'video' AND mime_type IN ('video/mp4','video/webm'))
        )
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Multiplas midias por relato. Limite de 5MB e tipos PNG/JPEG validados aqui e novamente no back-end.';

-- ---------------------------------------------------------------------
-- 3.4 relato_votos
-- ---------------------------------------------------------------------
CREATE TABLE relato_votos (
    relato_id     BIGINT UNSIGNED NOT NULL,
    usuario_id    BIGINT UNSIGNED NOT NULL,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (relato_id, usuario_id),
    KEY idx_relato_votos_usuario_created (usuario_id, created_at),
    CONSTRAINT fk_relato_votos_relato
        FOREIGN KEY (relato_id) REFERENCES relatos (id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_relato_votos_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Um voto por usuario por relato. Usuario pode remover o proprio voto (DELETE da linha). A regra "nao pode votar no proprio relato" e validada na aplicacao.';

-- ---------------------------------------------------------------------
-- 3.5 historico_status_relato
-- ---------------------------------------------------------------------
CREATE TABLE historico_status_relato (
    id                         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    relato_id                  BIGINT UNSIGNED NOT NULL,
    status_anterior            ENUM('pendente','em_analise','resolvido','rejeitado') NULL,
    status_novo                ENUM('pendente','em_analise','resolvido','rejeitado') NOT NULL,
    alterado_por_usuario_id    BIGINT UNSIGNED NULL
        COMMENT 'Moderador/administrador responsavel pela mudanca de status.',
    observacao                 VARCHAR(255)    NULL,
    created_at                 DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_historico_status_relato_created (relato_id, created_at),
    CONSTRAINT fk_historico_status_relato
        FOREIGN KEY (relato_id) REFERENCES relatos (id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_historico_status_usuario
        FOREIGN KEY (alterado_por_usuario_id) REFERENCES usuarios (id)
        ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Registro imutavel de cada mudanca de status do relato (linha do tempo).';

-- ---------------------------------------------------------------------
-- 3.6 motivos_moderacao
-- ---------------------------------------------------------------------
CREATE TABLE motivos_moderacao (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    codigo       VARCHAR(40)     NOT NULL,
    titulo       VARCHAR(120)    NOT NULL,
    descricao    VARCHAR(255)    NULL,
    ativo        TINYINT(1)      NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uk_motivos_moderacao_codigo (codigo)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Catalogo de motivos padronizados de rejeicao/moderacao.';

-- ---------------------------------------------------------------------
-- 3.7 moderacoes_relato
-- ---------------------------------------------------------------------
CREATE TABLE moderacoes_relato (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    relato_id      BIGINT UNSIGNED NOT NULL,
    moderador_id   BIGINT UNSIGNED NOT NULL,
    decisao        ENUM('aprovado','rejeitado','solicitado_ajuste') NOT NULL,
    motivo_id      BIGINT UNSIGNED NULL,
    observacao     VARCHAR(255)    NULL,
    created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_moderacoes_relato_created (relato_id, created_at),
    KEY idx_moderacoes_moderador_created (moderador_id, created_at),
    CONSTRAINT fk_moderacoes_relato
        FOREIGN KEY (relato_id) REFERENCES relatos (id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_moderacoes_moderador
        FOREIGN KEY (moderador_id) REFERENCES usuarios (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_moderacoes_motivo
        FOREIGN KEY (motivo_id) REFERENCES motivos_moderacao (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Decisoes e observacoes de moderacao. Um relato pode ter mais de uma revisao ao longo do fluxo.';

-- =====================================================================
-- 4. PREFERENCIAS DO USUARIO
-- =====================================================================

-- ---------------------------------------------------------------------
-- 4.1 preferencias_notificacao
-- ---------------------------------------------------------------------
CREATE TABLE preferencias_notificacao (
    usuario_id           BIGINT UNSIGNED NOT NULL,
    frequencia           ENUM('imediato','diario','semanal') NOT NULL DEFAULT 'diario',
    canal_sistema        TINYINT(1)      NOT NULL DEFAULT 1
        COMMENT 'Unico canal do primeiro escopo (in-app). Novos canais (ex.: e-mail) exigirao ALTER TABLE futuro.',
    silencioso_inicio    TIME            NULL,
    silencioso_fim       TIME            NULL,
    updated_at           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                         ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id),
    CONSTRAINT fk_preferencias_notificacao_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Relacao 1:1 com usuarios. Frequencia e canais de aviso.';

-- ---------------------------------------------------------------------
-- 4.2 preferencias_categorias
-- ---------------------------------------------------------------------
CREATE TABLE preferencias_categorias (
    usuario_id      BIGINT UNSIGNED NOT NULL,
    categoria_id    BIGINT UNSIGNED NOT NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, categoria_id),
    KEY idx_preferencias_categorias_reverso (categoria_id, usuario_id),
    CONSTRAINT fk_preferencias_categorias_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_preferencias_categorias_categoria
        FOREIGN KEY (categoria_id) REFERENCES categorias_ocorrencia (id)
        ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Tabela associativa N:N entre usuarios e categorias seguidas.';

-- ---------------------------------------------------------------------
-- 4.3 preferencias_bairros
-- ---------------------------------------------------------------------
CREATE TABLE preferencias_bairros (
    usuario_id    BIGINT UNSIGNED NOT NULL,
    bairro_id     BIGINT UNSIGNED NOT NULL,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, bairro_id),
    KEY idx_preferencias_bairros_reverso (bairro_id, usuario_id),
    CONSTRAINT fk_preferencias_bairros_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_preferencias_bairros_bairro
        FOREIGN KEY (bairro_id) REFERENCES bairros (id)
        ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Tabela associativa N:N entre usuarios e bairros acompanhados.';

-- ---------------------------------------------------------------------
-- 4.4 notificacoes
-- ---------------------------------------------------------------------
CREATE TABLE notificacoes (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuario_id    BIGINT UNSIGNED NOT NULL,
    tipo          VARCHAR(60)     NOT NULL,
    titulo        VARCHAR(150)    NOT NULL,
    mensagem      VARCHAR(500)    NOT NULL,
    lida_em       DATETIME        NULL,
    enviada_em    DATETIME        NULL,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_notificacoes_usuario_lida_created (usuario_id, lida_em, created_at),
    CONSTRAINT fk_notificacoes_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Avisos entregues dentro do sistema (in-app, primeiro escopo).';

-- =====================================================================
-- 5. IMPORTACAO DE DADOS PUBLICOS (CSV) E CRUZAMENTO TERRITORIAL
-- =====================================================================

-- ---------------------------------------------------------------------
-- 5.1 fontes_dados
-- ---------------------------------------------------------------------
CREATE TABLE fontes_dados (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    nome            VARCHAR(150)    NOT NULL,
    portal_url      VARCHAR(500)    NULL,
    conjunto_url    VARCHAR(500)    NULL,
    licenca         VARCHAR(150)    NULL,
    tipo_dado       ENUM('ocorrencias','orcamento','outro') NOT NULL,
    ativo           TINYINT(1)      NOT NULL DEFAULT 1,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_fontes_dados_nome (nome),
    UNIQUE KEY uk_fontes_dados_conjunto_url (conjunto_url)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Portais e conjuntos de dados publicos utilizados como origem dos CSVs.';

-- ---------------------------------------------------------------------
-- 5.2 lotes_importacao
-- ---------------------------------------------------------------------
CREATE TABLE lotes_importacao (
    id                          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    fonte_id                    BIGINT UNSIGNED NOT NULL,
    nome_arquivo                VARCHAR(255)    NOT NULL,
    hash_arquivo                CHAR(64)        NOT NULL,
    periodo_referencia          VARCHAR(20)     NULL,
    iniciado_em                 DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finalizado_em               DATETIME        NULL,
    status                      ENUM('pendente_validacao','validado','importando','concluido','falhou')
                                               NOT NULL DEFAULT 'pendente_validacao',
    linhas_lidas                INT UNSIGNED    NOT NULL DEFAULT 0,
    linhas_importadas           INT UNSIGNED    NOT NULL DEFAULT 0,
    linhas_rejeitadas           INT UNSIGNED    NOT NULL DEFAULT 0,
    detalhes_erro               JSON            NULL,
    importado_por_usuario_id    BIGINT UNSIGNED NOT NULL
        COMMENT 'Sempre um administrador. Importacao exige pre-visualizacao/validacao antes da confirmacao.',
    PRIMARY KEY (id),
    UNIQUE KEY uk_lotes_importacao_fonte_hash (fonte_id, hash_arquivo),
    KEY idx_lotes_importacao_status_iniciado (status, iniciado_em),
    CONSTRAINT fk_lotes_importacao_fonte
        FOREIGN KEY (fonte_id) REFERENCES fontes_dados (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_lotes_importacao_usuario
        FOREIGN KEY (importado_por_usuario_id) REFERENCES usuarios (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Cada importacao manual de um CSV. Hash evita reimportacao duplicada da mesma fonte.';

-- ---------------------------------------------------------------------
-- 5.3 ocorrencias_oficiais
-- ---------------------------------------------------------------------
CREATE TABLE ocorrencias_oficiais (
    id                       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    lote_id                  BIGINT UNSIGNED NOT NULL,
    fonte_id                 BIGINT UNSIGNED NOT NULL,
    id_externo               VARCHAR(100)    NOT NULL,
    data_ocorrencia          DATE            NOT NULL,
    tipo                     VARCHAR(100)    NULL,
    descricao                VARCHAR(255)    NULL,
    distrito_id              BIGINT UNSIGNED NULL
        COMMENT 'Preenchido quando a fonte fornece granularidade de distrito.',
    subprefeitura_id         BIGINT UNSIGNED NULL
        COMMENT 'Preenchido quando a fonte fornece apenas granularidade de subprefeitura.',
    latitude                 DECIMAL(10,7)   NULL,
    longitude                DECIMAL(10,7)   NULL,
    dados_originais_json     JSON            NULL,
    created_at               DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_ocorrencias_oficiais_fonte_externo (fonte_id, id_externo),
    KEY idx_ocorrencias_distrito_data (distrito_id, data_ocorrencia),
    KEY idx_ocorrencias_subprefeitura_data (subprefeitura_id, data_ocorrencia),
    KEY idx_ocorrencias_tipo_data (tipo, data_ocorrencia),
    CONSTRAINT fk_ocorrencias_lote
        FOREIGN KEY (lote_id) REFERENCES lotes_importacao (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_ocorrencias_fonte
        FOREIGN KEY (fonte_id) REFERENCES fontes_dados (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_ocorrencias_distrito
        FOREIGN KEY (distrito_id) REFERENCES distritos (id)
        ON DELETE SET NULL ON UPDATE RESTRICT,
    CONSTRAINT fk_ocorrencias_subprefeitura
        FOREIGN KEY (subprefeitura_id) REFERENCES subprefeituras (id)
        ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Ocorrencias importadas dos portais publicos. Granularidade territorial respeita a fonte (distrito e/ou subprefeitura), sem inventar distribuicoes. Regra "pelo menos um vinculo preenchido" e validada na importacao (nao pode ser CHECK no banco: colidiria com ON DELETE SET NULL das FKs territoriais).';

-- ---------------------------------------------------------------------
-- 5.4 execucoes_orcamentarias
-- ---------------------------------------------------------------------
CREATE TABLE execucoes_orcamentarias (
    id                       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    lote_id                  BIGINT UNSIGNED NOT NULL,
    fonte_id                 BIGINT UNSIGNED NOT NULL,
    distrito_id              BIGINT UNSIGNED NULL
        COMMENT 'Preenchido quando a fonte fornece granularidade de distrito.',
    subprefeitura_id         BIGINT UNSIGNED NULL
        COMMENT 'Preenchido quando a fonte fornece apenas granularidade de subprefeitura.',
    ano                      SMALLINT UNSIGNED NOT NULL,
    periodo_referencia       VARCHAR(20)     NULL,
    orgao                    VARCHAR(150)    NULL,
    acao_orcamentaria        VARCHAR(255)    NULL,
    valor_previsto           DECIMAL(15,2)   NULL,
    valor_atualizado         DECIMAL(15,2)   NULL,
    valor_congelado          DECIMAL(15,2)   NULL,
    valor_descongelado       DECIMAL(15,2)   NULL,
    valor_realizado          DECIMAL(15,2)   NULL,
    percentual_execucao      DECIMAL(5,2)    NULL,
    dados_originais_json     JSON            NULL,
    created_at               DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_execucoes_subprefeitura_ano_periodo (subprefeitura_id, ano, periodo_referencia),
    KEY idx_execucoes_distrito_ano_periodo (distrito_id, ano, periodo_referencia),
    KEY idx_execucoes_orgao_ano (orgao, ano),
    CONSTRAINT fk_execucoes_lote
        FOREIGN KEY (lote_id) REFERENCES lotes_importacao (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_execucoes_fonte
        FOREIGN KEY (fonte_id) REFERENCES fontes_dados (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_execucoes_distrito
        FOREIGN KEY (distrito_id) REFERENCES distritos (id)
        ON DELETE SET NULL ON UPDATE RESTRICT,
    CONSTRAINT fk_execucoes_subprefeitura
        FOREIGN KEY (subprefeitura_id) REFERENCES subprefeituras (id)
        ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Valores orcamentarios por local e periodo. Granularidade territorial respeita a fonte, sem inventar distribuicoes inexistentes. Regra "pelo menos um vinculo preenchido" e validada na importacao (nao pode ser CHECK no banco: colidiria com ON DELETE SET NULL das FKs territoriais).';

-- =====================================================================
-- 6. RANKING (SNAPSHOTS HISTORICOS)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 6.1 snapshots_prioridade
-- ---------------------------------------------------------------------
CREATE TABLE snapshots_prioridade (
    id                        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    periodo_referencia        VARCHAR(20)     NOT NULL,
    formula_versao            VARCHAR(20)     NOT NULL,
    peso_ocorrencias          DECIMAL(4,3)    NOT NULL DEFAULT 0.650,
    peso_orcamento            DECIMAL(4,3)    NOT NULL DEFAULT 0.350,
    status                    ENUM('rascunho','finalizado') NOT NULL DEFAULT 'rascunho',
    gerado_em                 DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finalizado_em             DATETIME        NULL,
    gerado_por_usuario_id     BIGINT UNSIGNED NULL,
    PRIMARY KEY (id),
    KEY idx_snapshots_periodo_status (periodo_referencia, status),
    CONSTRAINT fk_snapshots_usuario
        FOREIGN KEY (gerado_por_usuario_id) REFERENCES usuarios (id)
        ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Snapshot historico do ranking: periodo, versao da formula e pesos. O "ranking atual" e o ultimo com status = finalizado.';

-- ---------------------------------------------------------------------
-- 6.2 snapshot_lotes (N:N snapshot <-> lote de importacao usado)
-- ---------------------------------------------------------------------
CREATE TABLE snapshot_lotes (
    snapshot_id           BIGINT UNSIGNED NOT NULL,
    lote_importacao_id    BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (snapshot_id, lote_importacao_id),
    KEY idx_snapshot_lotes_reverso (lote_importacao_id, snapshot_id),
    CONSTRAINT fk_snapshot_lotes_snapshot
        FOREIGN KEY (snapshot_id) REFERENCES snapshots_prioridade (id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_snapshot_lotes_lote
        FOREIGN KEY (lote_importacao_id) REFERENCES lotes_importacao (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Rastreia quais lotes de CSV (ocorrencias e orcamento) alimentaram cada snapshot do ranking.';

-- ---------------------------------------------------------------------
-- 6.3 snapshot_resultados (resultado do ranking por subprefeitura)
-- ---------------------------------------------------------------------
CREATE TABLE snapshot_resultados (
    id                                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    snapshot_id                         BIGINT UNSIGNED NOT NULL,
    subprefeitura_id                    BIGINT UNSIGNED NOT NULL,
    ocorrencias_normalizadas            DECIMAL(8,4)    NOT NULL,
    deficit_orcamentario_relativo       DECIMAL(8,4)    NOT NULL,
    pontuacao_final                     DECIMAL(8,4)    NOT NULL,
    posicao                             SMALLINT UNSIGNED NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_snapshot_resultados_snapshot_subprefeitura (snapshot_id, subprefeitura_id),
    KEY idx_snapshot_resultados_posicao (snapshot_id, posicao),
    CONSTRAINT fk_snapshot_resultados_snapshot
        FOREIGN KEY (snapshot_id) REFERENCES snapshots_prioridade (id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_snapshot_resultados_subprefeitura
        FOREIGN KEY (subprefeitura_id) REFERENCES subprefeituras (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Resultado do ranking por subprefeitura, dentro de um snapshot especifico.';

-- =====================================================================
-- 7. AUDITORIA
-- =====================================================================

CREATE TABLE logs_auditoria (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuario_id     BIGINT UNSIGNED NULL,
    acao           VARCHAR(60)     NOT NULL,
    entidade       VARCHAR(60)     NOT NULL,
    entidade_id    BIGINT UNSIGNED NULL,
    antes_json     JSON            NULL,
    depois_json    JSON            NULL,
    ip_hash        CHAR(64)        NULL,
    created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_logs_auditoria_entidade (entidade, entidade_id, created_at),
    KEY idx_logs_auditoria_usuario_created (usuario_id, created_at),
    CONSTRAINT fk_logs_auditoria_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci
  COMMENT = 'Registro imutavel de acoes administrativas sensiveis (moderacao, importacao, alteracoes de dados pessoais).';

-- =====================================================================
-- 8. DADOS INICIAIS (SEED)
-- =====================================================================

INSERT INTO papeis (codigo, nome, descricao) VALUES
    ('cidadao', 'Cidadao', 'Usuario padrao: cria relatos, vota e define preferencias.'),
    ('moderador', 'Moderador', 'Modera relatos. Herda as permissoes de cidadao.'),
    ('administrador', 'Administrador', 'Administra o sistema e importa dados publicos. Herda as permissoes de moderador e cidadao.');

-- ---------------------------------------------------------------------
-- 8.2 documentos_legais (D6)
-- ---------------------------------------------------------------------
INSERT INTO documentos_legais (tipo, versao, titulo, conteudo, publicado_em, ativo) VALUES
    ('termos_uso', '1.0', 'Termos de Uso do ClimaFy',
     '[PLACEHOLDER] Texto de exemplo dos Termos de Uso do ClimaFy, versao 1.0. Substituir pelo conteudo juridico definitivo antes do lancamento em producao.',
     CURRENT_TIMESTAMP, 1),
    ('politica_privacidade', '1.0', 'Politica de Privacidade do ClimaFy',
     '[PLACEHOLDER] Texto de exemplo da Politica de Privacidade do ClimaFy, versao 1.0, descrevendo de forma generica a coleta e o uso de dados pessoais. Substituir pelo conteudo juridico definitivo antes do lancamento em producao.',
     CURRENT_TIMESTAMP, 1);

-- ---------------------------------------------------------------------
-- 8.3 categorias_ocorrencia (D4) — Conjunto A (relato) + Conjunto B (preferencia)
-- ---------------------------------------------------------------------
INSERT INTO categorias_ocorrencia (nome, slug, cor, icone, ordem_exibicao) VALUES
    ('Alagamento', 'alagamento', '#2469d6', 'flood', 1),
    ('Queimada', 'queimada', '#d62727', 'fire', 2),
    ('Calor Extremo', 'calor-extremo', '#f35c22', 'heat', 3),
    ('Árvore Caída', 'arvore-caida', '#63a93a', 'tree', 4),
    ('Lixo', 'lixo', '#8b6328', 'waste', 5),
    ('Poluição da Água', 'poluicao-agua', '#16a3a3', 'water', 6);

INSERT INTO categorias_ocorrencia (nome, slug, cor, icone, ordem_exibicao) VALUES
    ('Alagamentos', 'alagamentos', NULL, NULL, 7),
    ('Deslizamentos', 'deslizamentos', NULL, NULL, 8),
    ('Chuvas fortes', 'chuvas-fortes', NULL, NULL, 9),
    ('Ondas de calor', 'ondas-de-calor', NULL, NULL, 10),
    ('Queda de árvores', 'queda-de-arvores', NULL, NULL, 11),
    ('Falta de energia', 'falta-de-energia', NULL, NULL, 12),
    ('Qualidade do ar', 'qualidade-do-ar', NULL, NULL, 13),
    ('Defesa civil', 'defesa-civil', NULL, NULL, 14);

-- ---------------------------------------------------------------------
-- 8.4 motivos_moderacao (D8)
-- ---------------------------------------------------------------------
INSERT INTO motivos_moderacao (codigo, titulo, ativo) VALUES
    ('conteudo-improprio', 'Conteúdo impróprio', 1),
    ('informacao-falsa', 'Informação falsa', 1),
    ('fora-de-escopo', 'Fora do escopo climático', 1),
    ('duplicado', 'Relato duplicado', 1),
    ('localizacao-incorreta', 'Localização incorreta', 1),
    ('spam', 'Spam/promoção', 1);

-- ---------------------------------------------------------------------
-- 8.5 geografia (D7): cidades -> subprefeituras -> distritos -> bairros
-- ---------------------------------------------------------------------

-- 8.5.1 cidades
INSERT INTO cidades (nome, codigo_ibge, uf, latitude_centro, longitude_centro, ativo) VALUES
    ('São Paulo', '3550308', 'SP', -23.5505000, -46.6333000, 1);

SET @cidade_sp_id = (SELECT id FROM cidades WHERE codigo_ibge = '3550308');

-- 8.5.2 subprefeituras (32 oficiais)
-- nome_normalizado/slug gerados pela funcao normalizarNome() do front-end,
-- garantindo casamento com os CSVs (ex.: "VP - VILA PRUDENTE" -> 'vila prudente';
-- "Freguesia do Ó/Brasilândia" -> 'freguesia do o brasilandia').
INSERT INTO subprefeituras (cidade_id, nome, nome_normalizado, slug) VALUES
    (@cidade_sp_id, 'Aricanduva/Vila Formosa', 'aricanduva vila formosa', 'aricanduva-vila-formosa'),
    (@cidade_sp_id, 'Butantã', 'butanta', 'butanta'),
    (@cidade_sp_id, 'Campo Limpo', 'campo limpo', 'campo-limpo'),
    (@cidade_sp_id, 'Capela do Socorro', 'capela do socorro', 'capela-do-socorro'),
    (@cidade_sp_id, 'Casa Verde-Cachoeirinha', 'casa verde', 'casa-verde'),
    (@cidade_sp_id, 'Cidade Ademar', 'cidade ademar', 'cidade-ademar'),
    (@cidade_sp_id, 'Cidade Tiradentes', 'cidade tiradentes', 'cidade-tiradentes'),
    (@cidade_sp_id, 'Sapopemba', 'sapopemba', 'sapopemba'),
    (@cidade_sp_id, 'Ermelino Matarazzo', 'ermelino matarazzo', 'ermelino-matarazzo'),
    (@cidade_sp_id, 'Freguesia do Ó-Brasilândia', 'freguesia do o brasilandia', 'freguesia-do-o-brasilandia'),
    (@cidade_sp_id, 'Guaianases', 'guaianases', 'guaianases'),
    (@cidade_sp_id, 'Ipiranga', 'ipiranga', 'ipiranga'),
    (@cidade_sp_id, 'Itaim Paulista', 'itaim paulista', 'itaim-paulista'),
    (@cidade_sp_id, 'Itaquera', 'itaquera', 'itaquera'),
    (@cidade_sp_id, 'Jaçanã-Tremembé', 'jacana tremembe', 'jacana-tremembe'),
    (@cidade_sp_id, 'Jabaquara', 'jabaquara', 'jabaquara'),
    (@cidade_sp_id, 'Lapa', 'lapa', 'lapa'),
    (@cidade_sp_id, 'M''Boi Mirim', 'm boi mirim', 'm-boi-mirim'),
    (@cidade_sp_id, 'Mooca', 'mooca', 'mooca'),
    (@cidade_sp_id, 'Parelheiros', 'parelheiros', 'parelheiros'),
    (@cidade_sp_id, 'Penha', 'penha', 'penha'),
    (@cidade_sp_id, 'Perus', 'perus', 'perus'),
    (@cidade_sp_id, 'Pinheiros', 'pinheiros', 'pinheiros'),
    (@cidade_sp_id, 'Pirituba-Jaraguá', 'pirituba jaragua', 'pirituba-jaragua'),
    (@cidade_sp_id, 'Santana-Tucuruvi', 'santana tucuruvi', 'santana-tucuruvi'),
    (@cidade_sp_id, 'Santo Amaro', 'santo amaro', 'santo-amaro'),
    (@cidade_sp_id, 'São Mateus', 'sao mateus', 'sao-mateus'),
    (@cidade_sp_id, 'São Miguel', 'sao miguel', 'sao-miguel'),
    (@cidade_sp_id, 'Sé', 'se', 'se'),
    (@cidade_sp_id, 'Vila Maria-Vila Guilherme', 'vila maria vila guilherme', 'vila-maria-vila-guilherme'),
    (@cidade_sp_id, 'Vila Mariana', 'vila mariana', 'vila-mariana'),
    (@cidade_sp_id, 'Vila Prudente', 'vila prudente', 'vila-prudente');

-- 8.5.3 distritos e bairros (carregamento completo)
-- Os 96 distritos oficiais (fonte: GeoSampa/Prefeitura de SP, com vinculo
-- oficial distrito -> subprefeitura) e os bairros (fonte: OpenStreetMap,
-- cruzados por ponto-em-poligono com os poligonos oficiais dos distritos)
-- NAO sao mais seedados aqui: sao carregados de forma idempotente por
-- database/carregar-geografia.js, executado automaticamente pelo
-- `npm run db:schema` (apply-schema.js) logo apos este schema.
-- Regra de garantia: todo distrito tem ao menos o bairro homonimo.