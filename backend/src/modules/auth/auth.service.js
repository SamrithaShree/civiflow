const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../config/db');

const register = async ({ name, email, password, role, ward_id, phone }) => {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) throw new Error('Email already registered');

    // Only citizens can self-register; other roles created by admin
    const allowedSelfRegister = ['CITIZEN'];
    if (!allowedSelfRegister.includes(role)) {
        throw new Error('Only CITIZEN role can self-register');
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, ward_id, phone) 
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, ward_id`,
        [name, email, password_hash, role || 'CITIZEN', ward_id || null, phone || null]
    );
    return result.rows[0];
};

const login = async ({ email, password }) => {
    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND is_active = TRUE', [email]);
    if (result.rows.length === 0) throw new Error('Invalid email or password');

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new Error('Invalid email or password');

    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, ward_id: user.ward_id, name: user.name },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role, ward_id: user.ward_id } };
};

const createUser = async ({ name, email, password, role, ward_id, phone }) => {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) throw new Error('Email already registered');

    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, ward_id, phone) 
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, ward_id`,
        [name, email, password_hash, role, ward_id || null, phone || null]
    );
    return result.rows[0];
};

const getMe = async (userId) => {
    const result = await pool.query(
        'SELECT id, name, email, role, ward_id, phone, created_at FROM users WHERE id = $1',
        [userId]
    );
    return result.rows[0];
};

module.exports = { register, login, createUser, getMe };
