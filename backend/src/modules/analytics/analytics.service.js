const pool = require('../../config/db');

const getOverview = async (wardId) => {
  const params = [];
  const wardFilter = wardId ? `WHERE ward_id = $${params.push(wardId)}` : '';
  const result = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'NEW') as new_count,
      COUNT(*) FILTER (WHERE status = 'ASSIGNED') as assigned_count,
      COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as in_progress_count,
      COUNT(*) FILTER (WHERE status = 'RESOLVED') as resolved_count,
      COUNT(*) FILTER (WHERE status = 'PENDING_VERIFICATION') as pending_verification_count,
      COUNT(*) FILTER (WHERE status = 'CLOSED') as closed_count,
      COUNT(*) FILTER (WHERE status = 'REOPENED') as reopened_count,
      COUNT(*) FILTER (WHERE sla_deadline < NOW() AND status NOT IN ('CLOSED')) as sla_breached
    FROM issues
    ${wardFilter}
  `, params);
  return result.rows[0];
};

const getWardStats = async (wardId) => {
  const params = [];
  const wardFilter = wardId ? `AND w.id = $${params.push(wardId)}` : '';
  const result = await pool.query(`
    SELECT 
      w.id, w.name as ward_name,
      COUNT(i.id) as total_issues,
      COUNT(i.id) FILTER (WHERE i.status = 'CLOSED') as closed,
      COUNT(i.id) FILTER (WHERE i.status NOT IN ('CLOSED') AND i.sla_deadline < NOW()) as sla_breached,
      ROUND(AVG(i.priority_score)::numeric, 2) as avg_priority
    FROM wards w
    LEFT JOIN issues i ON i.ward_id = w.id
    WHERE 1=1 ${wardFilter}
    GROUP BY w.id, w.name
    ORDER BY total_issues DESC
  `, params);
  return result.rows;
};

const getSLAMetrics = async (wardId) => {
  const params = [];
  const wardFilter = wardId ? `WHERE i.ward_id = $${params.push(wardId)}` : '';
  const result = await pool.query(`
    SELECT 
      i.category,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE sla_deadline < NOW() AND status NOT IN ('CLOSED')) as breached,
      COUNT(*) FILTER (WHERE status = 'CLOSED' AND sla_deadline > updated_at) as resolved_within_sla,
      ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600)::numeric, 2) as avg_resolution_hours
    FROM issues i
    ${wardFilter}
    GROUP BY i.category
    ORDER BY breached DESC
  `, params);
  return result.rows;
};

const getHeatmap = async (wardId) => {
  const params = [];
  const wardFilter = wardId ? `AND ward_id = $${params.push(wardId)}` : '';
  const result = await pool.query(`
    SELECT 
      ROUND(lat::numeric, 3) as lat,
      ROUND(lng::numeric, 3) as lng,
      category,
      COUNT(*) as count,
      MAX(priority_score) as max_priority
    FROM issues
    WHERE status NOT IN ('CLOSED') ${wardFilter}
    GROUP BY ROUND(lat::numeric, 3), ROUND(lng::numeric, 3), category
    ORDER BY count DESC
    LIMIT 500
  `, params);
  return result.rows;
};

const getDepartmentPerformance = async (wardId) => {
  const params = [];
  const wardFilter = wardId ? `WHERE d.ward_id = $${params.push(wardId)}` : '';
  const result = await pool.query(`
    SELECT 
      d.id, d.name as department_name,
      COUNT(i.id) as total_issues,
      COUNT(i.id) FILTER (WHERE i.status = 'CLOSED') as closed,
      COUNT(i.id) FILTER (WHERE i.sla_deadline < NOW() AND i.status NOT IN ('CLOSED')) as sla_breached,
      ROUND(AVG(CASE WHEN i.status = 'CLOSED' THEN EXTRACT(EPOCH FROM (i.updated_at - i.created_at))/3600 END)::numeric, 2) as avg_closure_hours
    FROM departments d
    LEFT JOIN issues i ON i.department_id = d.id
    ${wardFilter}
    GROUP BY d.id, d.name
    ORDER BY sla_breached DESC
  `, params);
  return result.rows;
};

const getEscalations = async (wardId) => {
  const params = [];
  const wardFilter = wardId ? `AND i.ward_id = $${params.push(wardId)}` : '';
  const result = await pool.query(`
    SELECT e.*, i.ticket_id, i.category, i.status, i.priority_score, w.name as ward_name
    FROM escalations e
    JOIN issues i ON i.id = e.issue_id
    LEFT JOIN wards w ON w.id = i.ward_id
    WHERE 1=1 ${wardFilter}
    ORDER BY e.created_at DESC
    LIMIT 100
  `, params);
  return result.rows;
};

module.exports = { getOverview, getWardStats, getSLAMetrics, getHeatmap, getDepartmentPerformance, getEscalations };
