const pool = require('../../config/db');
const { validateTransition } = require('../../utils/lifecycle');
const { calculatePriority, getSLADeadline } = require('../../utils/priority');
const { detectDuplicate } = require('../../utils/duplicate');
const { CATEGORIES } = require('../../config/constants');

/**
 * Create a new issue. Handles duplicate detection and auto-routing.
 */
const createIssue = async ({ category, description, lat, lng, severity, reporterId, photoUrls = [] }) => {
    // 1. Check incident mode
    const incidentResult = await pool.query('SELECT active FROM incident_modes ORDER BY id DESC LIMIT 1');
    const incidentMode = incidentResult.rows[0]?.active || false;

    // 2. Find ward by approximate location (simplified: use reporter's ward)
    const reporterResult = await pool.query('SELECT ward_id FROM users WHERE id = $1', [reporterId]);
    const wardId = reporterResult.rows[0]?.ward_id;

    // 3. Duplicate detection
    const duplicate = await detectDuplicate(lat, lng, category, incidentMode);

    if (duplicate) {
        // Attach as issue_report to parent, boost priority
        await pool.query(
            'INSERT INTO issue_reports (issue_id, reporter_id, description) VALUES ($1, $2, $3)',
            [duplicate.id, reporterId, description]
        );

        // Count reports for this issue
        const countResult = await pool.query(
            'SELECT COUNT(*) FROM issue_reports WHERE issue_id = $1',
            [duplicate.id]
        );
        const dupCount = parseInt(countResult.rows[0].count);

        // Get issue age
        const issueResult = await pool.query('SELECT created_at FROM issues WHERE id = $1', [duplicate.id]);
        const ageMs = Date.now() - new Date(issueResult.rows[0].created_at).getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);

        const newScore = calculatePriority({ category, severity, duplicateCount: dupCount, ageInDays: ageDays, incidentMode });
        await pool.query('UPDATE issues SET priority_score = $1, updated_at = NOW() WHERE id = $2', [newScore, duplicate.id]);

        // If photo uploaded, add to parent issue media
        if (photoUrls.length > 0) {
            for (const url of photoUrls) {
                await pool.query(
                    'INSERT INTO issue_media (issue_id, url, media_type, uploaded_by, stage) VALUES ($1, $2, $3, $4, $5)',
                    [duplicate.id, url, 'IMAGE', reporterId, 'REPORT']
                );
            }
        }

        return { isDuplicate: true, parentIssueId: duplicate.id, ticketId: duplicate.ticket_id };
    }

    // 4. Find department by category + ward
    const deptResult = await pool.query(
        `SELECT id FROM departments WHERE $1 = ANY(category_codes) AND (ward_id = $2 OR ward_id IS NULL) LIMIT 1`,
        [category, wardId]
    );
    const departmentId = deptResult.rows[0]?.id || null;

    // 5. Calculate priority
    const priorityScore = calculatePriority({ category, severity, incidentMode });

    // 6. SLA deadline
    const slaDeadline = getSLADeadline(category, incidentMode);

    // 7. Generate ticket_id
    const ticketSeqResult = await pool.query("SELECT nextval('issues_ticket_seq') AS seq");
    const seq = ticketSeqResult.rows[0].seq;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const ticketId = `CVF-${today}-${String(seq).padStart(4, '0')}`;

    // 8. Insert issue
    const issueResult = await pool.query(
        `INSERT INTO issues (ticket_id, category, description, lat, lng, ward_id, severity, priority_score, status, reporter_id, department_id, sla_deadline)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'NEW', $9, $10, $11)
     RETURNING *`,
        [ticketId, category, description, lat, lng, wardId, severity, priorityScore, reporterId, departmentId, slaDeadline]
    );
    const issue = issueResult.rows[0];

    // 9. Status history
    await pool.query(
        `INSERT INTO status_history (issue_id, from_status, to_status, actor_id, actor_role, note) VALUES ($1, NULL, 'NEW', $2, 'CITIZEN', 'Issue reported')`,
        [issue.id, reporterId]
    );

    // 10. Save media
    if (photoUrls.length > 0) {
        for (const url of photoUrls) {
            await pool.query(
                'INSERT INTO issue_media (issue_id, url, media_type, uploaded_by, stage) VALUES ($1, $2, $3, $4, $5)',
                [issue.id, url, 'IMAGE', reporterId, 'REPORT']
            );
        }
    }

    // 11. Auto-assign worker
    await autoAssignWorker(issue.id, departmentId, issue.ward_id);

    const fresh = await getIssueById(issue.id);
    return { isDuplicate: false, issue: fresh };
};

/**
 * Auto-assign a worker based on ward + lowest workload.
 */
const autoAssignWorker = async (issueId, departmentId, wardId) => {
    if (!wardId) return;
    // Find worker in same ward with least active assignments
    const result = await pool.query(
        `SELECT u.id, COUNT(a.id) as active_count
     FROM users u
     LEFT JOIN assignments a ON a.worker_id = u.id AND a.is_active = TRUE
     WHERE u.role = 'WORKER' AND u.ward_id = $1 AND u.is_active = TRUE
     GROUP BY u.id
     ORDER BY active_count ASC
     LIMIT 1`,
        [wardId]
    );

    if (result.rows.length === 0) return;
    const worker = result.rows[0];

    // Assign worker to issue
    await pool.query('UPDATE issues SET assigned_worker_id = $1, status = $2, updated_at = NOW() WHERE id = $3', [
        worker.id, 'ASSIGNED', issueId
    ]);
    await pool.query(
        'INSERT INTO assignments (issue_id, worker_id, assigned_by, reason) VALUES ($1, $2, $3, $4)',
        [issueId, worker.id, worker.id, 'Auto-assigned by system']
    );

    // Update status history
    const issue = await pool.query('SELECT reporter_id FROM issues WHERE id = $1', [issueId]);
    await pool.query(
        `INSERT INTO status_history (issue_id, from_status, to_status, actor_id, actor_role, note) VALUES ($1, 'NEW', 'ASSIGNED', $2, 'SYSTEM', 'Auto-assigned by routing engine')`,
        [issueId, worker.id]
    );
};

/**
 * Get all issues, filtered by role.
 */
const getIssues = async ({ role, userId, wardId, status, category, page = 1, limit = 20 }) => {
    const offset = (page - 1) * limit;
    let whereConditions = [];
    let params = [];
    let paramIdx = 1;

    if (role === 'CITIZEN') {
        whereConditions.push(`i.reporter_id = $${paramIdx++}`);
        params.push(userId);
    } else if (role === 'WORKER') {
        whereConditions.push(`i.assigned_worker_id = $${paramIdx++}`);
        params.push(userId);
    } else if (role === 'SUPERVISOR') {
        whereConditions.push(`d.supervisor_id = $${paramIdx++}`);
        params.push(userId);
    }
    // ADMIN gets all

    if (status) { whereConditions.push(`i.status = $${paramIdx++}`); params.push(status); }
    if (category) { whereConditions.push(`i.category = $${paramIdx++}`); params.push(category); }

    const where = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const query = `
    SELECT i.*, 
      u.name as reporter_name, u.email as reporter_email,
      w.name as ward_name,
      wu.name as worker_name,
      d.name as department_name,
      (SELECT COUNT(*) FROM issue_reports ir WHERE ir.issue_id = i.id) as duplicate_count,
      CASE WHEN i.sla_deadline < NOW() AND i.status NOT IN ('CLOSED') THEN TRUE ELSE FALSE END as sla_breached
    FROM issues i
    LEFT JOIN users u ON u.id = i.reporter_id
    LEFT JOIN users wu ON wu.id = i.assigned_worker_id
    LEFT JOIN wards w ON w.id = i.ward_id
    LEFT JOIN departments d ON d.id = i.department_id
    ${where}
    ORDER BY i.priority_score DESC, i.created_at DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query(
        `SELECT COUNT(*) FROM issues i LEFT JOIN departments d ON d.id = i.department_id ${where}`,
        params.slice(0, params.length - 2)
    );

    return { issues: result.rows, total: parseInt(countResult.rows[0].count), page, limit };
};

/**
 * Get single issue with full details.
 */
const getIssueById = async (id) => {
    const issueResult = await pool.query(
        `SELECT i.*, u.name as reporter_name, u.email as reporter_email, 
      w.name as ward_name, wu.name as worker_name, d.name as department_name,
      CASE WHEN i.sla_deadline < NOW() AND i.status NOT IN ('CLOSED') THEN TRUE ELSE FALSE END as sla_breached
     FROM issues i
     LEFT JOIN users u ON u.id = i.reporter_id
     LEFT JOIN users wu ON wu.id = i.assigned_worker_id
     LEFT JOIN wards w ON w.id = i.ward_id
     LEFT JOIN departments d ON d.id = i.department_id
     WHERE i.id = $1`,
        [id]
    );
    if (issueResult.rows.length === 0) return null;
    const issue = issueResult.rows[0];

    // Status history
    const historyResult = await pool.query(
        `SELECT sh.*, u.name as actor_name FROM status_history sh LEFT JOIN users u ON u.id = sh.actor_id WHERE sh.issue_id = $1 ORDER BY sh.created_at ASC`,
        [id]
    );

    // Media
    const mediaResult = await pool.query('SELECT * FROM issue_media WHERE issue_id = $1 ORDER BY created_at ASC', [id]);

    // Duplicate reports
    const reportsResult = await pool.query(
        `SELECT ir.*, u.name as reporter_name FROM issue_reports ir LEFT JOIN users u ON u.id = ir.reporter_id WHERE ir.issue_id = $1`,
        [id]
    );

    // Escalations
    const escalationsResult = await pool.query('SELECT * FROM escalations WHERE issue_id = $1 ORDER BY created_at DESC', [id]);

    return {
        ...issue,
        statusHistory: historyResult.rows,
        media: mediaResult.rows,
        additionalReports: reportsResult.rows,
        escalations: escalationsResult.rows,
    };
};

/**
 * Transition issue status (backend enforced).
 */
const transitionStatus = async (issueId, toStatus, actorId, actorRole, note = '') => {
    const issueResult = await pool.query('SELECT * FROM issues WHERE id = $1', [issueId]);
    if (issueResult.rows.length === 0) throw new Error('Issue not found');
    const issue = issueResult.rows[0];

    const { valid, error } = validateTransition(issue.status, toStatus, actorRole);
    if (!valid) throw new Error(error);

    const fromStatus = issue.status;
    let updates = { status: toStatus };

    // Auto-trigger pending verification
    if (toStatus === 'RESOLVED') {
        updates.status = 'PENDING_VERIFICATION';
    }

    const finalStatus = updates.status;

    await pool.query(
        'UPDATE issues SET status = $1, updated_at = NOW() WHERE id = $2',
        [finalStatus, issueId]
    );

    await pool.query(
        'INSERT INTO status_history (issue_id, from_status, to_status, actor_id, actor_role, note) VALUES ($1, $2, $3, $4, $5, $6)',
        [issueId, fromStatus, finalStatus, actorId, actorRole, note]
    );

    return getIssueById(issueId);
};

/**
 * Citizen verifies resolution: accept (CLOSED) or reject (REOPENED).
 */
const verifyResolution = async (issueId, citizenId, accepted, reason) => {
    const issueResult = await pool.query('SELECT * FROM issues WHERE id = $1', [issueId]);
    if (issueResult.rows.length === 0) throw new Error('Issue not found');
    const issue = issueResult.rows[0];

    if (issue.reporter_id !== citizenId) throw new Error('Only the reporter can verify this issue');
    if (issue.status !== 'PENDING_VERIFICATION') {
        throw new Error(`Issue is not pending verification (current: ${issue.status})`);
    }

    const toStatus = accepted ? 'CLOSED' : 'REOPENED';
    const fromStatus = issue.status;

    let extraUpdates = '';
    let extraParams = [];
    if (!accepted) {
        extraUpdates = ', reopen_count = reopen_count + 1';
    }

    await pool.query(
        `UPDATE issues SET status = $1${extraUpdates}, updated_at = NOW() WHERE id = $2`,
        [toStatus, issueId, ...extraParams]
    );

    await pool.query(
        'INSERT INTO status_history (issue_id, from_status, to_status, actor_id, actor_role, note) VALUES ($1, $2, $3, $4, $5, $6)',
        [issueId, fromStatus, toStatus, citizenId, 'CITIZEN', reason || (accepted ? 'Citizen accepted resolution' : 'Citizen rejected resolution')]
    );

    // If reopened: boost priority, notify supervisor
    if (!accepted) {
        const incidentResult = await pool.query('SELECT active FROM incident_modes ORDER BY id DESC LIMIT 1');
        const incidentMode = incidentResult.rows[0]?.active || false;
        const newScore = calculatePriority({ category: issue.category, severity: issue.severity, isReopened: true, incidentMode });
        await pool.query('UPDATE issues SET priority_score = $1 WHERE id = $2', [newScore, issueId]);
    }

    return getIssueById(issueId);
};

/**
 * Upload resolution media for a resolved issue.
 */
const addMedia = async (issueId, uploadedBy, urls, stage) => {
    for (const url of urls) {
        await pool.query(
            'INSERT INTO issue_media (issue_id, url, media_type, uploaded_by, stage) VALUES ($1, $2, $3, $4, $5)',
            [issueId, url, 'IMAGE', uploadedBy, stage]
        );
    }
    return getIssueById(issueId);
};

module.exports = { createIssue, getIssues, getIssueById, transitionStatus, verifyResolution, addMedia, autoAssignWorker };
