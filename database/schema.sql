-- ClimaFy - schema inicial do MVP
-- MySQL 8+

CREATE DATABASE IF NOT EXISTS climafy
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE climafy;

CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  cidade VARCHAR(100) NOT NULL,
  bairro VARCHAR(100) NOT NULL,
  tipo ENUM('cidadao', 'admin') NOT NULL DEFAULT 'cidadao',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY uk_usuarios_email (email),
  KEY idx_usuarios_tipo_ativo (tipo, ativo)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categorias (
  id_categoria TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(60) NOT NULL,
  slug VARCHAR(60) NOT NULL,
  icone VARCHAR(60) NOT NULL,
  cor_hex CHAR(7) NOT NULL,
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id_categoria),
  UNIQUE KEY uk_categorias_nome (nome),
  UNIQUE KEY uk_categorias_slug (slug),
  CONSTRAINT chk_categorias_cor_hex CHECK (cor_hex REGEXP '^#[0-9A-Fa-f]{6}$')
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS relatos (
  id_relato BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario INT UNSIGNED NOT NULL,
  id_categoria TINYINT UNSIGNED NOT NULL,
  titulo VARCHAR(80) NOT NULL,
  descricao VARCHAR(1000) NOT NULL,
  severidade ENUM('leve', 'moderada', 'grave', 'critica') NOT NULL DEFAULT 'moderada',
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  cidade VARCHAR(100) NOT NULL,
  bairro VARCHAR(100) NOT NULL,
  ponto_referencia VARCHAR(180) NULL,
  ocorrido_em DATETIME NULL,
  status ENUM('pendente', 'aprovado', 'rejeitado') NOT NULL DEFAULT 'pendente',
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_relato),
  CONSTRAINT fk_relatos_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario),
  CONSTRAINT fk_relatos_categoria
    FOREIGN KEY (id_categoria) REFERENCES categorias (id_categoria),
  CONSTRAINT chk_relatos_latitude CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT chk_relatos_longitude CHECK (longitude BETWEEN -180 AND 180),
  KEY idx_relatos_status_data (status, criado_em),
  KEY idx_relatos_categoria_status (id_categoria, status),
  KEY idx_relatos_local (cidade, bairro, status),
  KEY idx_relatos_usuario_status (id_usuario, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS moderacoes (
  id_moderacao BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_relato BIGINT UNSIGNED NOT NULL,
  id_admin INT UNSIGNED NOT NULL,
  decisao ENUM('aprovado', 'rejeitado') NOT NULL,
  justificativa VARCHAR(500) NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_moderacao),
  CONSTRAINT fk_moderacoes_relato
    FOREIGN KEY (id_relato) REFERENCES relatos (id_relato),
  CONSTRAINT fk_moderacoes_admin
    FOREIGN KEY (id_admin) REFERENCES usuarios (id_usuario),
  CONSTRAINT chk_moderacoes_justificativa
    CHECK (decisao = 'aprovado' OR NULLIF(TRIM(justificativa), '') IS NOT NULL),
  KEY idx_moderacoes_relato_data (id_relato, criado_em),
  KEY idx_moderacoes_admin_data (id_admin, criado_em)
) ENGINE=InnoDB;

INSERT INTO categorias (nome, slug, icone, cor_hex)
VALUES
  ('Alagamento', 'alagamento', 'waves', '#2563EB'),
  ('Seca', 'seca', 'sun', '#D97706'),
  ('Calor extremo', 'calor-extremo', 'thermometer-hot', '#DC2626'),
  ('Queimada', 'queimada', 'fire', '#EA580C'),
  ('Arvore caida', 'arvore-caida', 'tree', '#15803D'),
  ('Lixo irregular', 'lixo-irregular', 'trash', '#6B7280'),
  ('Poluicao da agua', 'poluicao-da-agua', 'drop', '#0891B2'),
  ('Outros', 'outros', 'warning-circle', '#7C3AED')
ON DUPLICATE KEY UPDATE
  nome = VALUES(nome),
  icone = VALUES(icone),
  cor_hex = VALUES(cor_hex),
  ativa = TRUE;
