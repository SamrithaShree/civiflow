const pool = require('../config/db');
const { DUPLICATE_DETECTION } = require('../config/constants');

/**
 * Detect duplicate issues using geo radius + category + time window.
 * Returns the parent issue if duplicate found, else null.
 */
const detectDuplicate = async (lat, lng, category, incidentMode = false) => {
    const radius = incidentMode
        ? DUPLICATE_DETECTION.INCIDENT_MODE_RADIUS_METERS
        : DUPLICATE_DETECTION.GEO_RADIUS_METERS;
    const timeWindowHours = DUPLICATE_DETECTION.TIME_WINDOW_HOURS;

    // Using Haversine formula approximation in SQL (PostgreSQL)
    // 111320 meters per degree latitude
    const query = `
    SELECT id, ticket_id, status, priority_score,
      (
        6371000 * acos(
          cos(radians($1)) * cos(radians(lat)) *
          cos(radians(lng) - radians($2)) +
          sin(radians($1)) * sin(radians(lat))
        )
      ) AS distance_m
    FROM issues
    WHERE
      category = $3
      AND status NOT IN ('CLOSED')
      AND created_at > NOW() - INTERVAL '${timeWindowHours} hours'
      AND parent_issue_id IS NULL
    HAVING (
        6371000 * acos(
          cos(radians($1)) * cos(radians(lat)) *
          cos(radians(lng) - radians($2)) +
          sin(radians($1)) * sin(radians(lat))
        )
      ) <= $4
    ORDER BY distance_m ASC
    LIMIT 1;
  `;

    try {
        const result = await pool.query(query, [lat, lng, category, radius]);
        if (result.rows.length > 0) {
            return result.rows[0];
        }
        return null;
    } catch (err) {
        console.error('[DuplicateDetection] Error:', err.message);
        return null;
    }
};

module.exports = { detectDuplicate };
