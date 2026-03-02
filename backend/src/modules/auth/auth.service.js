const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../../config/db');

// ─── Helpers ────────────────────────────────────────────────────────────────
const hashAadhaar = (aadhaar) =>
    crypto.createHash('sha256').update(aadhaar.toString().trim()).digest('hex');

// Mock verification logic (in production this would call a government API)
const verifyAadhaar = (aadhaar) => {
    const str = aadhaar.toString().trim().replace(/\s/g, '');
    return /^\d{12}$/.test(str); // Must be exactly 12 digits
};

const verifyWorkerId = (workerId) =>
    /^WRK-[A-Z0-9]{4,10}$/i.test((workerId || '').trim());

const verifySupervisorId = (supervisorId) =>
    /^SUP-[A-Z0-9]{4,10}$/i.test((supervisorId || '').trim());

// ─── Register ────────────────────────────────────────────────────────────────
const register = async ({
    name, email, password, role = 'CITIZEN',
    phone, ward_id,
    aadhaar_number,
    worker_id_number,
    supervisor_id_number,
}) => {
    // 1. Validate base fields
    if (!name || name.trim().length < 2)
        throw new Error('Name must be at least 2 characters.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new Error('Invalid email address.');
    if (!password || password.length < 8)
        throw new Error('Password must be at least 8 characters.');

    const allowedRoles = ['CITIZEN', 'WORKER', 'SUPERVISOR'];
    if (!allowedRoles.includes(role))
        throw new Error('Invalid role. Must be CITIZEN, WORKER, or SUPERVISOR.');

    // 2. Aadhaar validation (all roles)
    if (!aadhaar_number)
        throw new Error('Aadhaar number is required for registration.');
    if (!verifyAadhaar(aadhaar_number))
        throw new Error('Invalid Aadhaar number. Must be exactly 12 digits.');

    const aadhaarHash = hashAadhaar(aadhaar_number);

    // 3. Role-specific validation
    if (role === 'WORKER') {
        if (!ward_id)
            throw new Error('Ward assignment is required for Worker registration.');
        if (!worker_id_number)
            throw new Error('Worker ID number is required (format: WRK-XXXXX).');
        if (!verifyWorkerId(worker_id_number))
            throw new Error('Invalid Worker ID format. Expected: WRK-XXXXX (e.g., WRK-A1234).');
    }
    if (role === 'SUPERVISOR') {
        if (!ward_id)
            throw new Error('Ward assignment is required for Supervisor registration.');
        if (!supervisor_id_number)
            throw new Error('Supervisor Legal ID is required (format: SUP-XXXXX).');
        if (!verifySupervisorId(supervisor_id_number))
            throw new Error('Invalid Supervisor ID format. Expected: SUP-XXXXX (e.g., SUP-B5678).');
    }

    // 4. Duplicate checks
    const existingEmail = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingEmail.rows.length > 0) throw new Error('Email already registered.');

    const existingAadhaar = await pool.query(
        'SELECT id FROM users WHERE aadhaar_hash = $1', [aadhaarHash]
    );
    if (existingAadhaar.rows.length > 0)
        throw new Error('Aadhaar number already linked to an existing account.');

    if (worker_id_number) {
        const existingWorker = await pool.query(
            'SELECT id FROM users WHERE worker_id_number = $1', [worker_id_number.trim()]
        );
        if (existingWorker.rows.length > 0)
            throw new Error('Worker ID already registered.');
    }
    if (supervisor_id_number) {
        const existingSuper = await pool.query(
            'SELECT id FROM users WHERE supervisor_id_number = $1', [supervisor_id_number.trim()]
        );
        if (existingSuper.rows.length > 0)
            throw new Error('Supervisor ID already registered.');
    }

    // 5. Set activation status based on role
    // Citizens: immediately active. Workers/Supervisors: pending admin approval.
    const isActive = role === 'CITIZEN';
    const verificationStatus = role === 'CITIZEN' ? 'APPROVED' : 'PENDING';

    const password_hash = await bcrypt.hash(password, 12);

    const result = await pool.query(
        `INSERT INTO users (
            name, email, password_hash, role, ward_id, phone,
            aadhaar_hash, worker_id_number, supervisor_id_number,
            is_active, verification_status
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING id, name, email, role, ward_id, is_active, verification_status`,
        [
            name.trim(), email.trim().toLowerCase(), password_hash,
            role, ward_id || null, phone || null,
            aadhaarHash,
            worker_id_number ? worker_id_number.trim().toUpperCase() : null,
            supervisor_id_number ? supervisor_id_number.trim().toUpperCase() : null,
            isActive,
            verificationStatus,
        ]
    );

    return result.rows[0];
};

// ─── Login ───────────────────────────────────────────────────────────────────
const login = async ({ email, password }) => {
    const result = await pool.query(
        'SELECT * FROM users WHERE email = $1', [email]
    );
    if (result.rows.length === 0) throw new Error('Invalid email or password.');

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new Error('Invalid email or password.');

    // Check account state
    if (user.verification_status === 'PENDING')
        throw new Error('Your account is pending approval from your ward Admin. You will be notified once approved.');
    if (user.verification_status === 'REJECTED')
        throw new Error(`Your registration was rejected. Reason: ${user.rejection_reason || 'Please contact administration.'}`);
    if (!user.is_active)
        throw new Error('Your account has been deactivated. Please contact the administrator.');

    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, ward_id: user.ward_id, name: user.name },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return {
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, ward_id: user.ward_id }
    };
};

// ─── Admin create user (unchanged) ───────────────────────────────────────────
const createUser = async ({ name, email, password, role, ward_id, phone }) => {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) throw new Error('Email already registered');

    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, ward_id, phone, is_active, verification_status)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, 'APPROVED') RETURNING id, name, email, role, ward_id`,
        [name, email, password_hash, role, ward_id || null, phone || null]
    );
    return result.rows[0];
};

// ─── Get me ───────────────────────────────────────────────────────────────────
const getMe = async (userId) => {
    const result = await pool.query(
        'SELECT id, name, email, role, ward_id, phone, created_at FROM users WHERE id = $1',
        [userId]
    );
    return result.rows[0];
};

module.exports = { register, login, createUser, getMe };
