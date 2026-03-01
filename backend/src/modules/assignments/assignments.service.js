const pool = require('../../config/db');
const { autoAssignWorker } = require('../issues/issues.service');

/**
 * Reassign a worker (supervisor/admin only).
 */
const reassign = async ({ issueId, workerId, assignedBy, reason }) => {
    // Deactivate current assignment
    await pool.query('UPDATE assignments SET is_active = FALSE WHERE issue_id = $1 AND is_active = TRUE', [issueId]);

    // Assign new worker
    await pool.query(
        'INSERT INTO assignments (issue_id, worker_id, assigned_by, reason) VALUES ($1, $2, $3, $4)',
        [issueId, workerId, assignedBy, reason]
    );

    // Update issue
    await pool.query('UPDATE issues SET assigned_worker_id = $1, updated_at = NOW() WHERE id = $2', [workerId, issueId]);

    // Log in status history
    await pool.query(
        `INSERT INTO status_history (issue_id, from_status, to_status, actor_id, actor_role, note) VALUES ($1, 'ASSIGNED', 'ASSIGNED', $2, 'SUPERVISOR', $3)`,
        [issueId, assignedBy, `Reassigned to worker ${workerId}. Reason: ${reason}`]
    );

    return { success: true, message: 'Worker reassigned successfully' };
};

/**
 * Get assignments for a specific worker.
 */
const getWorkerAssignments = async (workerId) => {
    const result = await pool.query(
        `SELECT a.*, i.ticket_id, i.category, i.status, i.priority_score, i.sla_deadline, i.description, i.severity,
       w.name as ward_name, d.name as department_name
     FROM assignments a
     JOIN issues i ON i.id = a.issue_id
     LEFT JOIN wards w ON w.id = i.ward_id
     LEFT JOIN departments d ON d.id = i.department_id
     WHERE a.worker_id = $1 AND a.is_active = TRUE
     ORDER BY i.priority_score DESC`,
        [workerId]
    );
    return result.rows;
};

/**
 * List all workers with workload.
 */
const getWorkersWithLoad = async (wardId) => {
    let query = `
    SELECT u.id, u.name, u.email, u.ward_id, w.name as ward_name,
      COUNT(a.id) FILTER (WHERE a.is_active = TRUE) as active_assignments
    FROM users u
    LEFT JOIN assignments a ON a.worker_id = u.id
    LEFT JOIN wards w ON w.id = u.ward_id
    WHERE u.role = 'WORKER' AND u.is_active = TRUE
  `;
    const params = [];
    if (wardId) { query += ` AND u.ward_id = $1`; params.push(wardId); }
    query += ' GROUP BY u.id, w.name ORDER BY active_assignments ASC';
    const result = await pool.query(query, params);
    return result.rows;
};

module.exports = { reassign, getWorkerAssignments, getWorkersWithLoad };
