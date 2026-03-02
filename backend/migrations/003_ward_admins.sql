-- CiviFlow: 12 Chennai Ward Zones + 12 Ward Admins
-- Run as: psql $DATABASE_URL -f migrations/003_ward_admins.sql

BEGIN;

-- ============================================================
-- ADD ward_id TO incident_modes (scope incident mode per ward)
-- ============================================================
ALTER TABLE incident_modes ADD COLUMN IF NOT EXISTS ward_id INTEGER REFERENCES wards(id);
CREATE INDEX IF NOT EXISTS idx_incident_modes_ward ON incident_modes(ward_id, active);

-- Deactivate any previously active global incident modes
UPDATE incident_modes SET active = FALSE, ended_at = NOW() WHERE active = TRUE;

-- ============================================================
-- 12 REAL CHENNAI WARD ZONES
-- ============================================================
INSERT INTO wards (id, name, city, boundary_description) VALUES
  (1,  'Zone 1 - Thiruvottiyur',    'Chennai', 'Thiruvottiyur, Kathivakkam, Wimco Nagar areas'),
  (2,  'Zone 2 - Manali',           'Chennai', 'Manali, Kodungaiyur, Madhavaram areas'),
  (3,  'Zone 3 - Madhavaram',       'Chennai', 'Madhavaram, Redhills, Ambattur areas'),
  (4,  'Zone 4 - Tondiarpet',       'Chennai', 'Tondiarpet, Basin Bridge, Perambur areas'),
  (5,  'Zone 5 - Royapuram',        'Chennai', 'Royapuram, Washermanpet, Flower Bazaar areas'),
  (6,  'Zone 6 - Thiru Vi Ka Nagar','Chennai', 'Thiru Vi Ka Nagar, Pulianthope, Perambur areas'),
  (7,  'Zone 7 - Ambattur',         'Chennai', 'Ambattur, Padi, Puzhuthivakkam areas'),
  (8,  'Zone 8 - Anna Nagar',       'Chennai', 'Anna Nagar, Kilpauk, Aminjikarai areas'),
  (9,  'Zone 9 - Teynampet',        'Chennai', 'Teynampet, Alwarpet, Nandanam, Mylapore areas'),
  (10, 'Zone 10 - Kodambakkam',     'Chennai', 'Kodambakkam, Ashok Nagar, K.K. Nagar areas'),
  (11, 'Zone 11 - Valasaravakkam',  'Chennai', 'Valasaravakkam, Virugambakkam, Porur areas'),
  (12, 'Zone 12 - Alandur',         'Chennai', 'Alandur, Adambakkam, Guindy, Velachery areas')
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      city = EXCLUDED.city,
      boundary_description = EXCLUDED.boundary_description;

SELECT setval('wards_id_seq', (SELECT MAX(id) FROM wards));

-- ============================================================
-- 12 WARD ADMIN USERS (password for all: Admin@123)
-- bcrypt hash of "Admin@123" (cost 10) — verified correct
--   $2a$10$NF/QnD2Rnk7Y7AU1gNc8KOPpEFqTzVefvt/tL6OHaxOffWPLuHLaG
-- ============================================================
INSERT INTO users (name, email, password_hash, role, ward_id, phone, is_active, verification_status) VALUES
  ('Admin – Zone 1 Thiruvottiyur',    'admin.ward1@civiflow.gov',  '$2a$10$NF/QnD2Rnk7Y7AU1gNc8KOPpEFqTzVefvt/tL6OHaxOffWPLuHLaG', 'ADMIN', 1,  '9110000001', TRUE, 'APPROVED'),
  ('Admin – Zone 2 Manali',           'admin.ward2@civiflow.gov',  '$2a$10$NF/QnD2Rnk7Y7AU1gNc8KOPpEFqTzVefvt/tL6OHaxOffWPLuHLaG', 'ADMIN', 2,  '9110000002', TRUE, 'APPROVED'),
  ('Admin – Zone 3 Madhavaram',       'admin.ward3@civiflow.gov',  '$2a$10$NF/QnD2Rnk7Y7AU1gNc8KOPpEFqTzVefvt/tL6OHaxOffWPLuHLaG', 'ADMIN', 3,  '9110000003', TRUE, 'APPROVED'),
  ('Admin – Zone 4 Tondiarpet',       'admin.ward4@civiflow.gov',  '$2a$10$NF/QnD2Rnk7Y7AU1gNc8KOPpEFqTzVefvt/tL6OHaxOffWPLuHLaG', 'ADMIN', 4,  '9110000004', TRUE, 'APPROVED'),
  ('Admin – Zone 5 Royapuram',        'admin.ward5@civiflow.gov',  '$2a$10$NF/QnD2Rnk7Y7AU1gNc8KOPpEFqTzVefvt/tL6OHaxOffWPLuHLaG', 'ADMIN', 5,  '9110000005', TRUE, 'APPROVED'),
  ('Admin – Zone 6 Thiru Vi Ka Nagar','admin.ward6@civiflow.gov',  '$2a$10$NF/QnD2Rnk7Y7AU1gNc8KOPpEFqTzVefvt/tL6OHaxOffWPLuHLaG', 'ADMIN', 6,  '9110000006', TRUE, 'APPROVED'),
  ('Admin – Zone 7 Ambattur',         'admin.ward7@civiflow.gov',  '$2a$10$NF/QnD2Rnk7Y7AU1gNc8KOPpEFqTzVefvt/tL6OHaxOffWPLuHLaG', 'ADMIN', 7,  '9110000007', TRUE, 'APPROVED'),
  ('Admin – Zone 8 Anna Nagar',       'admin.ward8@civiflow.gov',  '$2a$10$NF/QnD2Rnk7Y7AU1gNc8KOPpEFqTzVefvt/tL6OHaxOffWPLuHLaG', 'ADMIN', 8,  '9110000008', TRUE, 'APPROVED'),
  ('Admin – Zone 9 Teynampet',        'admin.ward9@civiflow.gov',  '$2a$10$NF/QnD2Rnk7Y7AU1gNc8KOPpEFqTzVefvt/tL6OHaxOffWPLuHLaG', 'ADMIN', 9,  '9110000009', TRUE, 'APPROVED'),
  ('Admin – Zone 10 Kodambakkam',     'admin.ward10@civiflow.gov', '$2a$10$NF/QnD2Rnk7Y7AU1gNc8KOPpEFqTzVefvt/tL6OHaxOffWPLuHLaG', 'ADMIN', 10, '9110000010', TRUE, 'APPROVED'),
  ('Admin – Zone 11 Valasaravakkam',  'admin.ward11@civiflow.gov', '$2a$10$NF/QnD2Rnk7Y7AU1gNc8KOPpEFqTzVefvt/tL6OHaxOffWPLuHLaG', 'ADMIN', 11, '9110000011', TRUE, 'APPROVED'),
  ('Admin – Zone 12 Alandur',         'admin.ward12@civiflow.gov', '$2a$10$NF/QnD2Rnk7Y7AU1gNc8KOPpEFqTzVefvt/tL6OHaxOffWPLuHLaG', 'ADMIN', 12, '9110000012', TRUE, 'APPROVED')
ON CONFLICT (email) DO NOTHING;

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

COMMIT;
