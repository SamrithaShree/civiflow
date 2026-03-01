const pool = require('../../config/db');
const { PRIORITY } = require('../../config/constants');
const { calculatePriority } = require('../../utils/priority');

/**
 * Toggle incident mode on or off.
 */
const toggleIncidentMode = async (userId, activate, reason) => {
    let resultRow;
    if (activate) {
        await pool.query(`UPDATE incident_modes SET active = FALSE, ended_at = NOW() WHERE active = TRUE`);
        const result = await pool.query(
            `INSERT INTO incident_modes (active, triggered_by, reason, started_at) VALUES (TRUE, $1, $2, NOW()) RETURNING *`,
            [userId, reason || 'Incident mode activated by admin']
        );
        console.log('[AdminService] Incident mode ACTIVATED');
        resultRow = result.rows[0];
    } else {
        await pool.query(`UPDATE incident_modes SET active = FALSE, ended_at = NOW() WHERE active = TRUE`);
        console.log('[AdminService] Incident mode DEACTIVATED');
        resultRow = { active: false, ended_at: new Date() };
    }

    // Background job: instantly recalculate priority for all active issues
    setImmediate(async () => {
        try {
            console.log(`[AdminService] Recalculating all priorities. Incident mode: ${activate}`);
            const issuesRes = await pool.query(`SELECT id, category, severity, status, created_at, reopen_count FROM issues WHERE status NOT IN ('CLOSED')`);
            for (const issue of issuesRes.rows) {
                const ageInDays = (Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60 * 24);
                const score = calculatePriority({
                    category: issue.category,
                    severity: issue.severity,
                    ageInDays,
                    isReopened: issue.reopen_count > 0,
                    incidentMode: activate
                });
                await pool.query('UPDATE issues SET priority_score = $1 WHERE id = $2', [score, issue.id]);
            }
            console.log(`[AdminService] Successfully recalculated ${issuesRes.rowCount} active queues.`);
        } catch (err) {
            console.error('[AdminService] Fallback priority recalculation failed:', err);
        }
    });

    return resultRow;
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
