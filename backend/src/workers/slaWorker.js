const cron = require('node-cron');
const pool = require('../config/db');
const { ESCALATION_LEVELS } = require('../config/constants');
const { calculatePriority } = require('../utils/priority');

/**
 * SLA Worker: three scheduled jobs.
 * - Every 15 min: check SLA breaches, escalate, boost priority
 * - Daily at midnight: auto-close PENDING_VERIFICATION after 7 days
 * - Every hour: auto-reassign REOPENED issues after 48h
 */
const startSLAWorker = () => {
    cron.schedule('*/15 * * * *', async () => {
        console.log('[SLAWorker] Running SLA check at', new Date().toISOString());
        await runSLACheck();
    });

    cron.schedule('0 0 * * *', async () => {
        console.log('[SLAWorker] Running stale-issue auto-close');
        await autoCloseStale();
    });

    cron.schedule('0 * * * *', async () => {
        console.log('[SLAWorker] Running reopened-issue re-route');
        await rerouteReopened();
    });

    console.log('✅ SLA Worker scheduled (SLA: 15min | AutoClose: daily | ReRoute: hourly)');
};

const runSLACheck = async () => {
    try {
        const result = await pool.query(`
      SELECT i.*, 
        EXTRACT(EPOCH FROM (NOW() - i.sla_deadline)) / 3600 as hours_overdue,
        (SELECT COUNT(*) FROM escalations e WHERE e.issue_id = i.id AND e.escalated_to = 'SUPERVISOR') as l1_count,
        (SELECT COUNT(*) FROM escalations e WHERE e.issue_id = i.id AND e.escalated_to = 'ADMIN') as l2_count
      FROM issues i
      WHERE i.sla_deadline < NOW()
        AND i.status NOT IN ('CLOSED')
      ORDER BY hours_overdue DESC
      LIMIT 100
    `);

        for (const issue of result.rows) {
            const hoursOverdue = parseFloat(issue.hours_overdue);

            // Level 1: Escalate to Supervisor
            if (parseInt(issue.l1_count) === 0) {
                const reason = `SLA breached by ${hoursOverdue.toFixed(1)} hours. Issue: ${issue.ticket_id}`;
                await pool.query(
                    `INSERT INTO escalations (issue_id, escalated_to, level, reason, hours_overdue) VALUES ($1, 'SUPERVISOR', 1, $2, $3)`,
                    [issue.id, reason, hoursOverdue]
                );
                await pool.query(
                    `INSERT INTO status_history (issue_id, from_status, to_status, actor_id, actor_role, note) VALUES ($1, $2, $3, $4, $5, $6)`,
                    [issue.id, issue.status, issue.status, null, 'SYSTEM', `L1 Escalation: ${reason}`]
                );
                console.log(`[SLAWorker] L1 Escalation: ${issue.ticket_id} → SUPERVISOR (${hoursOverdue.toFixed(1)}h)`);
            }

            // Level 2: 24h+ past SLA → escalate to Admin
            if (hoursOverdue >= ESCALATION_LEVELS.LEVEL_2.hoursOverSLA + 24 && parseInt(issue.l2_count) === 0) {
                const reason = `Critical SLA breach: ${hoursOverdue.toFixed(1)}h overdue. Escalated to Admin.`;
                await pool.query(
                    `INSERT INTO escalations (issue_id, escalated_to, level, reason, hours_overdue) VALUES ($1, 'ADMIN', 2, $2, $3)`,
                    [issue.id, reason, hoursOverdue]
                );
                await pool.query(
                    `INSERT INTO status_history (issue_id, from_status, to_status, actor_id, actor_role, note) VALUES ($1, $2, $3, $4, $5, $6)`,
                    [issue.id, issue.status, issue.status, null, 'SYSTEM', `L2 Escalation: ${reason}`]
                );
                console.log(`[SLAWorker] L2 Escalation: ${issue.ticket_id} → ADMIN (${hoursOverdue.toFixed(1)}h)`);
            }

            // Boost priority — check incident mode for *this issue's ward*
            const incidentResult = await pool.query(
                `SELECT active FROM incident_modes WHERE ward_id IS NOT DISTINCT FROM $1 ORDER BY id DESC LIMIT 1`,
                [issue.ward_id || null]
            );
            const incidentMode = incidentResult.rows[0]?.active || false;
            const newScore = calculatePriority({
                category: issue.category, severity: issue.severity,
                ageInDays: hoursOverdue / 24, incidentMode
            });
            await pool.query('UPDATE issues SET priority_score = $1, updated_at = NOW() WHERE id = $2', [newScore, issue.id]);
        }

        if (result.rows.length > 0) {
            console.log(`[SLAWorker] Processed ${result.rows.length} SLA-breached issues`);
        }
    } catch (err) {
        console.error('[SLAWorker] SLA check error:', err.message);
    }
};

/**
 * Auto-close PENDING_VERIFICATION issues older than 7 days.
 * Citizen didn't respond — assume resolved and close.
 */
const autoCloseStale = async () => {
    try {
        const result = await pool.query(`
      SELECT id, ticket_id FROM issues
      WHERE status = 'PENDING_VERIFICATION'
        AND updated_at < NOW() - INTERVAL '7 days'
      LIMIT 50
    `);

        for (const issue of result.rows) {
            await pool.query(`UPDATE issues SET status = 'CLOSED', updated_at = NOW() WHERE id = $1`, [issue.id]);
            await pool.query(
                `INSERT INTO status_history (issue_id, from_status, to_status, actor_id, actor_role, note)
         VALUES ($1, 'PENDING_VERIFICATION', 'CLOSED', NULL, 'SYSTEM',
                 'Auto-closed: no citizen verification after 7 days')`,
                [issue.id]
            );
            console.log(`[SLAWorker] Auto-closed stale issue: ${issue.ticket_id}`);
        }

        if (result.rows.length > 0) {
            console.log(`[SLAWorker] Auto-closed ${result.rows.length} stale issues`);
        }
    } catch (err) {
        console.error('[SLAWorker] AutoClose error:', err.message);
    }
};

/**
 * Re-route REOPENED issues waiting 48h with no worker action.
 */
const rerouteReopened = async () => {
    try {
        const result = await pool.query(`
      SELECT id, ticket_id, ward_id, department_id FROM issues
      WHERE status = 'REOPENED'
        AND updated_at < NOW() - INTERVAL '48 hours'
      LIMIT 20
    `);

        for (const issue of result.rows) {
            // Find least-loaded worker in that ward
            const workerResult = await pool.query(
                `SELECT u.id FROM users u
         LEFT JOIN assignments a ON a.worker_id = u.id AND a.is_active = TRUE
         WHERE u.role = 'WORKER' AND u.ward_id = $1 AND u.is_active = TRUE
         GROUP BY u.id ORDER BY COUNT(a.id) ASC LIMIT 1`,
                [issue.ward_id]
            );

            if (workerResult.rows.length === 0) continue;
            const workerId = workerResult.rows[0].id;

            await pool.query(
                `UPDATE issues SET assigned_worker_id = $1, status = 'ASSIGNED', updated_at = NOW() WHERE id = $2`,
                [workerId, issue.id]
            );
            await pool.query(
                `INSERT INTO assignments (issue_id, worker_id, assigned_by, reason) VALUES ($1, $2, NULL, 'Auto-reassigned: reopened for 48h')`,
                [issue.id, workerId]
            );
            await pool.query(
                `INSERT INTO status_history (issue_id, from_status, to_status, actor_id, actor_role, note)
         VALUES ($1, 'REOPENED', 'ASSIGNED', $2, 'SYSTEM',
                 'Auto-reassigned: issue reopened for 48h without action')`,
                [issue.id, workerId]
            );
            console.log(`[SLAWorker] Auto-reassigned reopened issue: ${issue.ticket_id} → worker ${workerId}`);
        }

        if (result.rows.length > 0) {
            console.log(`[SLAWorker] Re-routed ${result.rows.length} reopened issues`);
        }
    } catch (err) {
        console.error('[SLAWorker] ReRoute error:', err.message);
    }
};

module.exports = { startSLAWorker, runSLACheck, autoCloseStale, rerouteReopened };
