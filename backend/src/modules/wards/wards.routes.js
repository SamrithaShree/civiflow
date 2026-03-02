const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const authenticate = require('../../middleware/auth');
const { getWardByLocation } = require('../../utils/wardRouter');

// GET /api/wards/nearest?lat=&lng= — NO auth needed (used during issue form)
router.get('/nearest', async (req, res) => {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
    try {
        const ward = await getWardByLocation(parseFloat(lat), parseFloat(lng));
        if (!ward) return res.status(404).json({ error: 'No ward found' });
        res.json({ ward });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/wards — list all wards — PUBLIC (needed on registration page)
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, city FROM wards ORDER BY name');
        res.json({ wards: result.rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// All routes below require auth
router.use(authenticate);

// GET /api/wards/departments — list departments with ward info
router.get('/departments', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT d.*, w.name as ward_name 
            FROM departments d LEFT JOIN wards w ON w.id = d.ward_id 
            ORDER BY d.name
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

