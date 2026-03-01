const pool = require('../../config/db');
const { PRIORITY } = require('../../config/constants');

/**
 * Toggle incident mode on or off.
 */
const toggleIncidentMode = async (userId, activate, reason) => {
    if (activate) {
        await pool.query(`UPDATE incident_modes SET active = FALSE, ended_at = NOW() WHERE active = TRUE`);
        const result = await pool.query(
            `INSERT INTO incident_modes (active, triggered_by, reason, started_at) VALUES (TRUE, $1, $2, NOW()) RETURNING *`,
            [userId, reason || 'Incident mode activated by admin']
        );
        console.log('[AdminService] Incident mode ACTIVATED');
        return result.rows[0];
    } else {
        await pool.query(`UPDATE incident_modes SET active = FALSE, ended_at = NOW() WHERE active = TRUE`);
        console.log('[AdminService] Incident mode DEACTIVATED');
        return { active: false, ended_at: new Date() };
    }
};

const getIncidentMode = async () => {
    const result = await pool.query('SELECT * FROM incident_modes ORDER BY id DESC LIMIT 1');
    return result.rows[0] || { active: false };
};

const getAllDepartments = async () => {
    const result = await pool.query(`
    SELECT d.*, w.name as ward_name, u.name as supervisor_name,
      COUNT(i.id) as total_issues,
      COUNT(i.id) FILTER (WHERE i.status NOT IN ('CLOSED')) as open_issues
    FROM departments d
    LEFT JOIN wards w ON w.id = d.ward_id
    LEFT JOIN users u ON u.id = d.supervisor_id
    LEFT JOIN issues i ON i.department_id = d.id
    GROUP BY d.id, w.name, u.name
    ORDER BY d.id
  `);
    return result.rows;
};

const createDepartment = async ({ name, category_codes, ward_id, supervisor_id }) => {
    const result = await pool.query(
        `INSERT INTO departments (name, category_codes, ward_id, supervisor_id) VALUES ($1, $2, $3, $4) RETURNING *`,
        [name, category_codes, ward_id || null, supervisor_id || null]
    );
    return result.rows[0];
};

const getAllUsers = async (role) => {
    let query = `SELECT id, name, email, role, ward_id, phone, is_active, created_at FROM users`;
    const params = [];
    if (role) { query += ` WHERE role = $1`; params.push(role); }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    return result.rows;
};

module.exports = { toggleIncidentMode, getIncidentMode, getAllDepartments, createDepartment, getAllUsers };
