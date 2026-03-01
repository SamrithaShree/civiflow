-- CiviFlow Database Schema Migration
-- Run as: psql -U postgres -d civiflow -f migrations/001_schema.sql

BEGIN;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- WARDS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS wards (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  city VARCHAR(100) NOT NULL DEFAULT 'Metro City',
  boundary_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('CITIZEN','WORKER','SUPERVISOR','ADMIN')),
  ward_id INTEGER REFERENCES wards(id),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DEPARTMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category_codes TEXT[] NOT NULL,
  ward_id INTEGER REFERENCES wards(id),
  supervisor_id INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sequence for ticket_id (must exist before issues table)
CREATE SEQUENCE IF NOT EXISTS issues_ticket_seq START 1;

-- ============================================================
-- ISSUES TABLE (core)
-- ============================================================
CREATE TABLE IF NOT EXISTS issues (
  id SERIAL PRIMARY KEY,
  ticket_id VARCHAR(20) NOT NULL UNIQUE,
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  ward_id INTEGER REFERENCES wards(id),
  severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  priority_score NUMERIC(10,2) DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','ASSIGNED','IN_PROGRESS','RESOLVED','PENDING_VERIFICATION','CLOSED','REOPENED')),
  parent_issue_id INTEGER REFERENCES issues(id),
  reporter_id INTEGER NOT NULL REFERENCES users(id),
  department_id INTEGER REFERENCES departments(id),
  assigned_worker_id INTEGER REFERENCES users(id),
  sla_deadline TIMESTAMPTZ,
  resolution_note TEXT,
  reopen_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ISSUE REPORTS TABLE (duplicate attachments)
-- ============================================================
CREATE TABLE IF NOT EXISTS issue_reports (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  reporter_id INTEGER NOT NULL REFERENCES users(id),
  description TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ASSIGNMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS assignments (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  worker_id INTEGER NOT NULL REFERENCES users(id),
  assigned_by INTEGER NOT NULL REFERENCES users(id),
  reason TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STATUS HISTORY TABLE (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS status_history (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  actor_id INTEGER REFERENCES users(id),
  actor_role VARCHAR(20),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ESCALATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS escalations (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  escalated_to VARCHAR(20) NOT NULL CHECK (escalated_to IN ('SUPERVISOR','ADMIN')),
  level INTEGER NOT NULL DEFAULT 1,
  reason TEXT NOT NULL,
  hours_overdue NUMERIC(10,2),
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INCIDENT MODES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS incident_modes (
  id SERIAL PRIMARY KEY,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  triggered_by INTEGER REFERENCES users(id),
  reason TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default inactive incident mode
INSERT INTO incident_modes (active) VALUES (FALSE) ON CONFLICT DO NOTHING;

-- ============================================================
-- ISSUE MEDIA TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS issue_media (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  media_type VARCHAR(20) DEFAULT 'IMAGE',
  uploaded_by INTEGER REFERENCES users(id),
  stage VARCHAR(30) CHECK (stage IN ('REPORT','RESOLUTION')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(category);
CREATE INDEX IF NOT EXISTS idx_issues_ward ON issues(ward_id);
CREATE INDEX IF NOT EXISTS idx_issues_reporter ON issues(reporter_id);
CREATE INDEX IF NOT EXISTS idx_issues_worker ON issues(assigned_worker_id);
CREATE INDEX IF NOT EXISTS idx_issues_sla ON issues(sla_deadline);
CREATE INDEX IF NOT EXISTS idx_status_history_issue ON status_history(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_reports_issue ON issue_reports(issue_id);

COMMIT;
