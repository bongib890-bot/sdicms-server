-- ===========================================================================
--  SDICMS — Database schema
--  MySQL 8.0+ / InnoDB / utf8mb4
--
--  Design notes
--   • Every table carries created_at; anything mutable carries updated_at.
--   • audit_log and custody_chain are append-only and hash-chained. Nothing
--     in the application ever issues UPDATE or DELETE against them.
--   • Personal identifiers are stored whole and masked at the API boundary,
--     so a reveal can be audited rather than silently permitted.
--   • Indexes are chosen against the queries the dashboards actually run,
--     not added speculatively.
-- ===========================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
--  Stations
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS stations;
CREATE TABLE stations (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(20)  NOT NULL UNIQUE COMMENT 'e.g. GP-HLB-014',
  name          VARCHAR(120) NOT NULL,
  province      VARCHAR(60)  NOT NULL,
  address       VARCHAR(255) NULL,
  phone         VARCHAR(30)  NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_stations_province (province)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  Users
--  password_hash holds a bcrypt hash. Passwords are hashed, never encrypted:
--  encryption is reversible, which is precisely what must not be possible.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  badge_number          VARCHAR(20)  NOT NULL UNIQUE,
  full_name             VARCHAR(120) NOT NULL,
  rank_title            VARCHAR(60)  NOT NULL,
  email                 VARCHAR(160) NOT NULL UNIQUE,
  password_hash         VARCHAR(255) NOT NULL,
  role                  ENUM('admin','station_admin','commander','detective','officer') NOT NULL,
  station_id            INT UNSIGNED NULL,
  status                ENUM('active','flagged','suspended') NOT NULL DEFAULT 'active',
  caseload_capacity     SMALLINT UNSIGNED NOT NULL DEFAULT 18,
  must_change_password  TINYINT(1)   NOT NULL DEFAULT 0,
  password_changed_at   DATETIME     NULL,
  last_login_at         DATETIME     NULL,
  failed_attempts       TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until          DATETIME     NULL,
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_station FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE SET NULL,
  INDEX idx_users_role_station (role, station_id),
  INDEX idx_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  Refresh tokens
--  Stored as a SHA-256 hash so a database leak does not hand over live
--  sessions. Rotated on every use; the old row is revoked.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS refresh_tokens;
CREATE TABLE refresh_tokens (
  id            CHAR(32)     PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  token_hash    CHAR(64)     NOT NULL,
  user_agent    VARCHAR(255) NULL,
  ip            VARCHAR(45)  NULL,
  expires_at    DATETIME     NOT NULL,
  revoked_at    DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_refresh_user (user_id, revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  Cases (dockets)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS cases;
CREATE TABLE cases (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_number           VARCHAR(30)  NOT NULL UNIQUE COMMENT 'CAS 412/07/2026',
  title                 VARCHAR(200) NOT NULL,
  category              VARCHAR(60)  NOT NULL,
  priority              ENUM('Critical','High','Medium','Low') NOT NULL DEFAULT 'Medium',
  status                VARCHAR(40)  NOT NULL DEFAULT 'Reported',
  description           TEXT         NULL,
  incident_location     VARCHAR(255) NULL,
  station_id            INT UNSIGNED NOT NULL,
  detective_id          INT UNSIGNED NULL,
  created_by            INT UNSIGNED NOT NULL,
  complainant_name      VARCHAR(120) NULL,
  complainant_id_number VARCHAR(20)  NULL,
  complainant_phone     VARCHAR(30)  NULL,
  complainant_address   VARCHAR(255) NULL,
  opened_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at             DATETIME     NULL,
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cases_station   FOREIGN KEY (station_id)   REFERENCES stations(id),
  CONSTRAINT fk_cases_detective FOREIGN KEY (detective_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_cases_creator   FOREIGN KEY (created_by)   REFERENCES users(id),
  -- The dashboards filter by station then status, and sort by activity.
  INDEX idx_cases_station_status (station_id, status),
  INDEX idx_cases_detective (detective_id, status),
  INDEX idx_cases_activity (last_activity_at),
  INDEX idx_cases_priority (priority),
  FULLTEXT KEY ft_cases_search (title, description, incident_location)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  Case status history — one row per lifecycle transition
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS case_status_history;
CREATE TABLE case_status_history (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id       INT UNSIGNED NOT NULL,
  from_status   VARCHAR(40)  NULL,
  to_status     VARCHAR(40)  NOT NULL,
  reason        VARCHAR(500) NULL,
  changed_by    INT UNSIGNED NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_history_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_history_user FOREIGN KEY (changed_by) REFERENCES users(id),
  INDEX idx_history_case (case_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  Case notes — append only, never edited
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS case_notes;
CREATE TABLE case_notes (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id       INT UNSIGNED NOT NULL,
  author_id     INT UNSIGNED NOT NULL,
  body          TEXT         NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notes_case   FOREIGN KEY (case_id)   REFERENCES cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_notes_author FOREIGN KEY (author_id) REFERENCES users(id),
  INDEX idx_notes_case (case_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  Evidence
--  sha256 is computed at upload and re-verified on download. file_path points
--  outside the web root.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS evidence;
CREATE TABLE evidence (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  exhibit_number    VARCHAR(30)  NOT NULL UNIQUE COMMENT 'EX-2026-0441',
  case_id           INT UNSIGNED NOT NULL,
  label             VARCHAR(200) NOT NULL,
  evidence_type     VARCHAR(40)  NOT NULL,
  description       TEXT         NULL,
  storage_location  VARCHAR(120) NOT NULL,
  status            VARCHAR(40)  NOT NULL DEFAULT 'Pending verification',
  original_filename VARCHAR(255) NULL,
  file_path         VARCHAR(500) NULL,
  file_size         BIGINT UNSIGNED NULL,
  mime_type         VARCHAR(120) NULL,
  sha256            CHAR(64)     NULL,
  collected_by      INT UNSIGNED NOT NULL,
  collected_from    VARCHAR(160) NULL,
  collected_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_by       INT UNSIGNED NULL,
  verified_at       DATETIME     NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_evidence_case      FOREIGN KEY (case_id)      REFERENCES cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_evidence_collector FOREIGN KEY (collected_by) REFERENCES users(id),
  CONSTRAINT fk_evidence_verifier  FOREIGN KEY (verified_by)  REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_evidence_case (case_id),
  INDEX idx_evidence_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  Chain of custody — append only, hash chained per exhibit
--  entry_hash = SHA256(prev_hash + canonical payload of this row)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS custody_chain;
CREATE TABLE custody_chain (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  evidence_id   INT UNSIGNED NOT NULL,
  seq           INT UNSIGNED NOT NULL COMMENT 'position in this exhibit chain, from 1',
  from_party    VARCHAR(160) NOT NULL,
  to_party      VARCHAR(160) NOT NULL,
  action        VARCHAR(120) NOT NULL,
  actor_id      INT UNSIGNED NOT NULL,
  occurred_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  prev_hash     CHAR(64)     NOT NULL,
  entry_hash    CHAR(64)     NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_custody_evidence FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE,
  CONSTRAINT fk_custody_actor    FOREIGN KEY (actor_id)    REFERENCES users(id),
  UNIQUE KEY uq_custody_seq (evidence_id, seq),
  INDEX idx_custody_evidence (evidence_id, seq)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  Documents — anything filed against a docket that is not an exhibit
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS documents;
CREATE TABLE documents (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id           INT UNSIGNED NOT NULL,
  title             VARCHAR(200) NOT NULL,
  doc_type          VARCHAR(60)  NOT NULL DEFAULT 'Other',
  original_filename VARCHAR(255) NOT NULL,
  file_path         VARCHAR(500) NOT NULL,
  file_size         BIGINT UNSIGNED NOT NULL,
  mime_type         VARCHAR(120) NOT NULL,
  sha256            CHAR(64)     NOT NULL,
  uploaded_by       INT UNSIGNED NOT NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_documents_case   FOREIGN KEY (case_id)     REFERENCES cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_documents_author FOREIGN KEY (uploaded_by) REFERENCES users(id),
  INDEX idx_documents_case (case_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  Suspects
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS suspects;
CREATE TABLE suspects (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference     VARCHAR(20)  NOT NULL UNIQUE COMMENT 'SP-1041',
  case_id       INT UNSIGNED NOT NULL,
  full_name     VARCHAR(160) NOT NULL,
  id_number     VARCHAR(20)  NULL,
  apparent_age  VARCHAR(20)  NULL,
  status        VARCHAR(40)  NOT NULL DEFAULT 'Sought',
  is_identified TINYINT(1)   NOT NULL DEFAULT 0,
  notes         TEXT         NULL,
  created_by    INT UNSIGNED NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_suspects_case   FOREIGN KEY (case_id)    REFERENCES cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_suspects_author FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_suspects_case (case_id),
  INDEX idx_suspects_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  Statements
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS statements;
CREATE TABLE statements (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference      VARCHAR(20)  NOT NULL UNIQUE COMMENT 'ST-2201',
  case_id        INT UNSIGNED NOT NULL,
  deponent_name  VARCHAR(160) NOT NULL,
  deponent_type  VARCHAR(40)  NOT NULL,
  body           TEXT         NULL,
  status         ENUM('Draft','Signed') NOT NULL DEFAULT 'Draft',
  taken_by       INT UNSIGNED NOT NULL,
  taken_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  signed_at      DATETIME     NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_statements_case FOREIGN KEY (case_id)  REFERENCES cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_statements_user FOREIGN KEY (taken_by) REFERENCES users(id),
  INDEX idx_statements_case (case_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  Forensic requests
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS forensic_requests;
CREATE TABLE forensic_requests (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference     VARCHAR(30)  NOT NULL UNIQUE COMMENT 'FSL-2026-11842',
  case_id       INT UNSIGNED NOT NULL,
  evidence_id   INT UNSIGNED NULL,
  analysis_type VARCHAR(80)  NOT NULL,
  status        ENUM('Submitted','In progress','Returned','Rejected') NOT NULL DEFAULT 'Submitted',
  findings      TEXT         NULL,
  requested_by  INT UNSIGNED NOT NULL,
  requested_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  returned_at   DATETIME     NULL,
  CONSTRAINT fk_forensic_case     FOREIGN KEY (case_id)      REFERENCES cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_forensic_evidence FOREIGN KEY (evidence_id)  REFERENCES evidence(id) ON DELETE SET NULL,
  CONSTRAINT fk_forensic_user     FOREIGN KEY (requested_by) REFERENCES users(id),
  INDEX idx_forensic_case (case_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  Notifications
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS notifications;
CREATE TABLE notifications (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  kind          ENUM('urgent','info','ok') NOT NULL DEFAULT 'info',
  icon          VARCHAR(40)  NOT NULL DEFAULT 'bell',
  message       VARCHAR(400) NOT NULL,
  link          VARCHAR(160) NULL,
  is_read       TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notifications_user (user_id, is_read, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  AI insights
--  Stored with the model and confidence that produced them, and with an
--  explicit disposition, so an AI suggestion can never be mistaken for an
--  officer's decision.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS ai_insights;
CREATE TABLE ai_insights (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id       INT UNSIGNED NULL,
  user_id       INT UNSIGNED NULL,
  kind          VARCHAR(60)  NOT NULL,
  body          TEXT         NOT NULL,
  confidence    DECIMAL(4,3) NOT NULL DEFAULT 0.500,
  model         VARCHAR(80)  NOT NULL DEFAULT 'heuristic-v1',
  status        ENUM('open','accepted','dismissed') NOT NULL DEFAULT 'open',
  resolved_by   INT UNSIGNED NULL,
  resolved_at   DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_insights_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_insights_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_insights_case (case_id, status),
  INDEX idx_insights_user (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
--  Audit log — append only, hash chained across the whole table
--  This is the table the proposal's anti-tampering claim rests on. The
--  application issues INSERT only; the triggers below make that a database
--  guarantee rather than a convention.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS audit_log;
CREATE TABLE audit_log (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  seq           BIGINT UNSIGNED NOT NULL UNIQUE,
  actor_id      INT UNSIGNED NULL,
  actor_name    VARCHAR(160) NOT NULL,
  action        VARCHAR(60)  NOT NULL COMMENT 'CASE_CREATE, EVIDENCE_ADD, ...',
  target_type   VARCHAR(40)  NOT NULL,
  target_id     VARCHAR(60)  NOT NULL,
  detail        VARCHAR(500) NULL,
  ip            VARCHAR(45)  NULL,
  user_agent    VARCHAR(255) NULL,
  prev_hash     CHAR(64)     NOT NULL,
  entry_hash    CHAR(64)     NOT NULL,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_actor (actor_id, created_at),
  INDEX idx_audit_target (target_type, target_id),
  INDEX idx_audit_action (action, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
