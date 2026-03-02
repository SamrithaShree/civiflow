-- CiviFlow Registration Enhancement Migration
-- Run as: psql $DATABASE_URL -f migrations/002_registration.sql

BEGIN;

-- Add Aadhaar hash (SHA-256 of the Aadhaar number, never plaintext)
ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhaar_hash VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS worker_id_number VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS supervisor_id_number VARCHAR(50);

-- Verification status: PENDING (awaiting admin approval), APPROVED, REJECTED
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'APPROVED';
ALTER TABLE users ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Unique constraints (prevent duplicate identity registrations)
-- Using partial unique indexes so NULL values don't conflict
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_aadhaar_hash ON users(aadhaar_hash) WHERE aadhaar_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_worker_id ON users(worker_id_number) WHERE worker_id_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_supervisor_id ON users(supervisor_id_number) WHERE supervisor_id_number IS NOT NULL;

-- Seed demo accounts - mark them as already verified/approved
UPDATE users SET verification_status = 'APPROVED' WHERE email IN (
  'admin@civiflow.gov', 'supervisor@civiflow.gov', 
  'worker@civiflow.gov', 'citizen@civiflow.gov'
);

COMMIT;
