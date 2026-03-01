const cron = require('node-cron');
const pool = require('../config/db');
const { ESCALATION_LEVELS } = require('../config/constants');
const { calculatePriority } = require('../utils/priority');

/**
 * SLA Worker - runs every 15 minutes.
 * Finds issues that have breached SLA and creates escalations.
 */
const startSLAWorker = () => {
    cron.schedule('*/15 * * * *', async () => {
        console.log('[SLAWorker] Running SLA check at', new Date().toISOString());
        await runSLACheck();
    });
    console.log('✅ SLA Worker scheduled (every 15 minutes)');
};

const runSLACheck = async () => {
    try {
        // Find issues past SLA deadline not yet closed/escalated at level 1
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
            if (issue.l1_count === '0' || parseInt(issue.l1_count) === 0) {
                await pool.query(
                    `INSERT INTO escalations (issue_id, escalated_to, level, reason, hours_overdue) VALUES ($1, 'SUPERVISOR', 1, $2, $3)`,
                    [issue.id, `SLA breached by ${hoursOverdue.toFixed(1)} hours. Issue: ${issue.ticket_id}`, hoursOverdue]
                );
                console.log(`[SLAWorker] L1 Escalation: Issue ${issue.ticket_id} → SUPERVISOR (${hoursOverdue.toFixed(1)}h overdue)`);
            }

            // Level 2: If 24h+ past SLA, escalate to Admin
            if (hoursOverdue >= ESCALATION_LEVELS.LEVEL_2.hoursOverSLA + 24) {
                if (issue.l2_count === '0' || parseInt(issue.l2_count) === 0) {
                    await pool.query(
                        `INSERT INTO escalations (issue_id, escalated_to, level, reason, hours_overdue) VALUES ($1, 'ADMIN', 2, $2, $3)`,
                        [issue.id, `Critical SLA breach: ${hoursOverdue.toFixed(1)} hours overdue. Escalated to Admin.`, hoursOverdue]
                    );
                    console.log(`[SLAWorker] L2 Escalation: Issue ${issue.ticket_id} → ADMIN (${hoursOverdue.toFixed(1)}h overdue)`);
                }
            }

            // Boost priority for overdue issues
            const ageDays = hoursOverdue / 24;
            const incidentResult = await pool.query('SELECT active FROM incident_modes ORDER BY id DESC LIMIT 1');
            const incidentMode = incidentResult.rows[0]?.active || false;
            const newScore = calculatePriority({
                category: issue.category, severity: issue.severity,
                ageInDays: ageDays, incidentMode
            });
            await pool.query('UPDATE issues SET priority_score = $1, updated_at = NOW() WHERE id = $2', [newScore, issue.id]);
        }

        if (result.rows.length > 0) {
            console.log(`[SLAWorker] Processed ${result.rows.length} SLA-breached issues`);
        }
    } catch (err) {
        console.error('[SLAWorker] Error:', err.message);
    }
};

module.exports = { startSLAWorker, runSLACheck };
