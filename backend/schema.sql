CREATE DATABASE IF NOT EXISTS dinamicash CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE dinamicash;

CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  correo VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  email_verificado TINYINT(1) NOT NULL DEFAULT 0,
  email_verificado_en DATETIME NULL,
  correo_pendiente VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_usuarios_correo (correo)
);

CREATE TABLE IF NOT EXISTS categorias (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  icono VARCHAR(10) NOT NULL DEFAULT '📦',
  id_usuario INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_categorias_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  UNIQUE KEY uq_categorias_usuario_nombre (id_usuario, nombre)
);

CREATE TABLE IF NOT EXISTS movimientos (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tipo ENUM('ingreso', 'gasto') NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  descripcion VARCHAR(255) NULL,
  id_usuario INT NOT NULL,
  categoria_id INT NOT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_movimientos_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  CONSTRAINT fk_movimientos_categoria FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT,
  INDEX idx_movimientos_usuario_fecha (id_usuario, fecha),
  INDEX idx_movimientos_categoria (categoria_id)
);

CREATE TABLE IF NOT EXISTS metas (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  fecha_limite DATE NOT NULL,
  id_usuario INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_metas_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  INDEX idx_metas_usuario_fecha (id_usuario, fecha_limite)
);

CREATE TABLE IF NOT EXISTS email_tokens (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  correo VARCHAR(255) NOT NULL,
  tipo VARCHAR(40) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expira_en DATETIME NOT NULL,
  usado_en DATETIME NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_tokens_lookup (token_hash, tipo, usado_en, expira_en),
  INDEX idx_email_tokens_user (id_usuario, tipo),
  CONSTRAINT fk_email_tokens_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_en DATETIME NOT NULL,
  user_agent VARCHAR(255) NULL,
  ip_address VARCHAR(64) NULL,
  last_used_en DATETIME NULL,
  revocado_en DATETIME NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_sessions_token_hash (token_hash),
  INDEX idx_user_sessions_user (id_usuario, revocado_en, expires_en),
  CONSTRAINT fk_user_sessions_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NULL,
  entidad VARCHAR(60) NOT NULL,
  entidad_id INT NULL,
  accion VARCHAR(60) NOT NULL,
  detalle_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_logs_user (id_usuario, created_at),
  INDEX idx_audit_logs_entity (entidad, entidad_id, created_at),
  CONSTRAINT fk_audit_logs_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
);
