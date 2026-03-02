const pool = require('../config/db');

/**
 * Find the nearest Chennai ward to a given lat/lng using Haversine distance
 * on stored centroid coordinates. No external API required.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{id, name, distance_m}|null>}
 */
const getWardByLocation = async (lat, lng) => {
    if (!lat || !lng) return null;
    try {
        const result = await pool.query(`
      SELECT id, name,
        (
          6371000 * acos(
            least(1.0, greatest(-1.0,
              cos(radians($1)) * cos(radians(centroid_lat)) *
              cos(radians(centroid_lng) - radians($2)) +
              sin(radians($1)) * sin(radians(centroid_lat))
            ))
          )
        ) AS distance_m
      FROM wards
      WHERE centroid_lat IS NOT NULL AND centroid_lng IS NOT NULL
      ORDER BY distance_m ASC
      LIMIT 1
    `, [lat, lng]);

        if (result.rows.length > 0) {
            return result.rows[0];
        }
        return null;
    } catch (err) {
        console.error('[WardRouter] Error:', err.message);
        return null;
    }
};

module.exports = { getWardByLocation };
