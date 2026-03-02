const pool = require('../../config/db');
const { PRIORITY } = require('../../config/constants');
const { calculatePriority } = require('../../utils/priority');

/**
 * Toggle incident mode on or off.
 */
const toggleIncidentMode = async (userId, activate, reason, wardId) => {
    let resultRow;
    if (activate) {
        // Deactivate any existing active incident mode for this ward
        await pool.query(`UPDATE incident_modes SET active = FALSE, ended_at = NOW() WHERE active = TRUE AND ward_id IS NOT DISTINCT FROM $1`, [wardId || null]);
        const result = await pool.query(
            `INSERT INTO incident_modes (active, triggered_by, reason, started_at, ward_id) VALUES (TRUE, $1, $2, NOW(), $3) RETURNING *`,
            [userId, reason || 'Incident mode activated by admin', wardId || null]
        );
        console.log(`[AdminService] Incident mode ACTIVATED${wardId ? ` for ward ${wardId}` : ' (global)'}`);
        resultRow = result.rows[0];
    } else {
        await pool.query(`UPDATE incident_modes SET active = FALSE, ended_at = NOW() WHERE active = TRUE AND ward_id IS NOT DISTINCT FROM $1`, [wardId || null]);
        console.log(`[AdminService] Incident mode DEACTIVATED${wardId ? ` for ward ${wardId}` : ' (global)'}`);
        resultRow = { active: false, ended_at: new Date() };
    }

    // Background job: recalculate priority for issues in this ward only
    setImmediate(async () => {
        try {
            console.log(`[AdminService] Recalculating priorities${wardId ? ` for ward ${wardId}` : ''}. Incident mode: ${activate}`);
            const wardFilter = wardId ? `AND ward_id = ${wardId}` : '';
            const issuesRes = await pool.query(`SELECT id, category, severity, status, created_at, reopen_count FROM issues WHERE status NOT IN ('CLOSED') ${wardFilter}`);
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
            console.log(`[AdminService] Recalculated ${issuesRes.rowCount} issues.`);
        } catch (err) {
            console.error('[AdminService] Fallback priority recalculation failed:', err);
        }
    });

    return resultRow;
};

const getIncidentMode = async (wardId) => {
    const params = wardId ? [wardId] : [];
    const wardFilter = wardId ? `WHERE ward_id = $1` : `WHERE ward_id IS NULL`;
    const result = await pool.query(`SELECT * FROM incident_modes ${wardFilter} ORDER BY id DESC LIMIT 1`, params);
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

const getAllUsers = async (role, wardId) => {
    const conditions = [];
    const params = [];

    if (wardId) {
        conditions.push(`u.ward_id = $${params.push(wardId)}`);
    }
    if (role) {
        conditions.push(`u.role = $${params.push(role)}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.ward_id, u.phone,
                u.is_active, u.verification_status, u.rejection_reason, u.created_at,
                w.name as ward_name
         FROM users u
         LEFT JOIN wards w ON w.id = u.ward_id
         ${whereClause}
         ORDER BY u.created_at DESC`,
        params
    );
    return result.rows;
};

// ─── New: Approval Workflow ──────────────────────────────────────────────────

/**
 * Get all pending registration approvals for admin's ward.
 * Admins see WORKER and SUPERVISOR pending in their ward.
 */
const getPendingApprovals = async (adminWardId) => {
    const params = ['PENDING'];
    let wardFilter = '';
    if (adminWardId) {
        wardFilter = 'AND u.ward_id = $2';
        params.push(adminWardId);
    }
    const result = await pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.phone, u.ward_id,
                u.worker_id_number, u.supervisor_id_number,
                u.verification_status, u.created_at,
                w.name as ward_name
         FROM users u
         LEFT JOIN wards w ON w.id = u.ward_id
         WHERE u.verification_status = $1
           AND u.role IN ('WORKER', 'SUPERVISOR')
           ${wardFilter}
         ORDER BY u.created_at ASC`,
        params
    );
    return result.rows;
};

/**
 * Approve a pending user registration.
 */
const approveUser = async (userId, adminUserId) => {
    // Verify admin is from same ward as the user (or is a super-admin with no ward restriction)
    const adminRes = await pool.query('SELECT id, ward_id, role FROM users WHERE id = $1', [adminUserId]);
    const admin = adminRes.rows[0];
    if (!admin) throw new Error('Admin not found.');

    const userRes = await pool.query(
        'SELECT id, name, email, role, ward_id, verification_status FROM users WHERE id = $1',
        [userId]
    );
    const user = userRes.rows[0];
    if (!user) throw new Error('User not found.');
    if (user.verification_status === 'APPROVED') throw new Error('User is already approved.');

    // Ward restriction: admin can only approve users in their ward
    if (admin.ward_id && user.ward_id && admin.ward_id !== user.ward_id) {
        throw new Error('You can only approve users assigned to your ward.');
    }

    const result = await pool.query(
        `UPDATE users SET is_active = TRUE, verification_status = 'APPROVED', rejection_reason = NULL, updated_at = NOW()
         WHERE id = $1
         RETURNING id, name, email, role, ward_id, is_active, verification_status`,
        [userId]
    );
    return result.rows[0];
};

/**
 * Reject a pending user registration.
 */
const rejectUser = async (userId, adminUserId, reason) => {
    const adminRes = await pool.query('SELECT id, ward_id FROM users WHERE id = $1', [adminUserId]);
    const admin = adminRes.rows[0];
    if (!admin) throw new Error('Admin not found.');

    const userRes = await pool.query('SELECT id, ward_id, verification_status FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];
    if (!user) throw new Error('User not found.');

    if (admin.ward_id && user.ward_id && admin.ward_id !== user.ward_id) {
        throw new Error('You can only reject users assigned to your ward.');
    }

    const result = await pool.query(
        `UPDATE users SET is_active = FALSE, verification_status = 'REJECTED', rejection_reason = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING id, name, email, role, verification_status, rejection_reason`,
        [userId, reason || 'Registration rejected by administrator.']
    );
    return result.rows[0];
};

module.exports = {
    toggleIncidentMode, getIncidentMode,
    getAllDepartments, createDepartment,
    getAllUsers,
    getPendingApprovals, approveUser, rejectUser
};
