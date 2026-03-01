const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const authMiddleware = require('../../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM wards ORDER BY name');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/departments', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT d.*, w.name as ward_name FROM departments d LEFT JOIN wards w ON w.id = d.ward_id ORDER BY d.name
    `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
