-- CiviFlow Seed Data
-- Run after migration: psql -U postgres -d civiflow -f seeds/seed.sql

BEGIN;

-- ============================================================
-- WARDS
-- ============================================================
INSERT INTO wards (id, name, city, boundary_description) VALUES
(1, 'Ward 1 - North Zone', 'Metro City', 'Northern residential zone'),
(2, 'Ward 2 - South Zone', 'Metro City', 'Southern commercial zone'),
(3, 'Ward 3 - East Zone', 'Metro City', 'Eastern industrial zone'),
(4, 'Ward 4 - Central Zone', 'Metro City', 'Central business district')
ON CONFLICT (name) DO NOTHING;

-- Reset sequence
SELECT setval('wards_id_seq', (SELECT MAX(id) FROM wards));

-- ============================================================
-- USERS (password: Admin@123 for all)
-- bcrypt hash of "Admin@123"
-- ============================================================
INSERT INTO users (id, name, email, password_hash, role, ward_id, phone) VALUES
(1, 'Admin User', 'admin@civiflow.gov', '$2b$10$YKd5mBEe8s6H3fv5eHNTj.1NPZPanEr5Q4RCB3YxGG6m6UJBqF2Fy', 'ADMIN', 1, '9000000001'),
(2, 'Supervisor Singh', 'supervisor@civiflow.gov', '$2b$10$YKd5mBEe8s6H3fv5eHNTj.1NPZPanEr5Q4RCB3YxGG6m6UJBqF2Fy', 'SUPERVISOR', 1, '9000000002'),
(3, 'Worker Rahul', 'worker@civiflow.gov', '$2b$10$YKd5mBEe8s6H3fv5eHNTj.1NPZPanEr5Q4RCB3YxGG6m6UJBqF2Fy', 'WORKER', 1, '9000000003'),
(4, 'Citizen Priya', 'citizen@civiflow.gov', '$2b$10$YKd5mBEe8s6H3fv5eHNTj.1NPZPanEr5Q4RCB3YxGG6m6UJBqF2Fy', 'CITIZEN', 2, '9000000004'),
(5, 'Worker Kumar', 'worker2@civiflow.gov', '$2b$10$YKd5mBEe8s6H3fv5eHNTj.1NPZPanEr5Q4RCB3YxGG6m6UJBqF2Fy', 'WORKER', 2, '9000000005'),
(6, 'Citizen Ravi', 'citizen2@civiflow.gov', '$2b$10$YKd5mBEe8s6H3fv5eHNTj.1NPZPanEr5Q4RCB3YxGG6m6UJBqF2Fy', 'CITIZEN', 1, '9000000006')
ON CONFLICT (email) DO NOTHING;

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- ============================================================
-- DEPARTMENTS
-- ============================================================
INSERT INTO departments (id, name, category_codes, ward_id, supervisor_id) VALUES
(1, 'Roads & Infrastructure', ARRAY['ROAD','DRAINAGE'], 1, 2),
(2, 'Water & Utilities', ARRAY['WATER','ELECTRICITY'], 1, 2),
(3, 'Sanitation Department', ARRAY['SANITATION'], 2, 2),
(4, 'Parks & Environment', ARRAY['PARK','NOISE','STREETLIGHT','OTHER'], 3, 2)
ON CONFLICT DO NOTHING;

SELECT setval('departments_id_seq', (SELECT MAX(id) FROM departments));

-- ============================================================
-- SAMPLE ISSUES (for demo)
-- ============================================================
INSERT INTO issue_reports (issue_id, reporter_id, description) SELECT 1, 4, 'Multiple reports for this pothole' WHERE EXISTS (SELECT 1 FROM issues WHERE id = 1);

-- Insert sample issues
INSERT INTO issues (ticket_id, category, description, lat, lng, ward_id, severity, priority_score, status, reporter_id, department_id, sla_deadline, created_at)
VALUES 
  ('CVF-20260301-0001', 'ROAD', 'Large pothole on Main Street causing accidents', 12.9716, 77.5946, 1, 'HIGH', 22.5, 'NEW', 4, 1, NOW() + INTERVAL '48 hours', NOW() - INTERVAL '2 hours'),
  ('CVF-20260301-0002', 'WATER', 'Water pipe burst near Sector 4 causing flooding', 12.9800, 77.5900, 1, 'CRITICAL', 35.0, 'IN_PROGRESS', 4, 2, NOW() + INTERVAL '12 hours', NOW() - INTERVAL '5 hours'),
  ('CVF-20260301-0003', 'SANITATION', 'Garbage pile has not been cleared for 3 days', 12.9650, 77.6000, 2, 'HIGH', 18.0, 'ASSIGNED', 6, 3, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '30 hours')
ON CONFLICT (ticket_id) DO NOTHING;

-- Assign worker to issue 2
UPDATE issues SET assigned_worker_id = 3 WHERE ticket_id = 'CVF-20260301-0002';
UPDATE issues SET assigned_worker_id = 3 WHERE ticket_id = 'CVF-20260301-0003';

-- Update sequence so new issues get correct next IDs
SELECT setval('issues_ticket_seq', 3);

-- Status history for sample issues
INSERT INTO status_history (issue_id, from_status, to_status, actor_id, actor_role, note, created_at)
SELECT 
  i.id, NULL, 'NEW', 4, 'CITIZEN', 'Issue reported by citizen', i.created_at
FROM issues i
WHERE i.status IN ('NEW','ASSIGNED','IN_PROGRESS')
ON CONFLICT DO NOTHING;

COMMIT;
