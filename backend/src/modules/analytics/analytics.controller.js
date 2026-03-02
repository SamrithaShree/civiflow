const analyticsService = require('./analytics.service');

const overview = async (req, res) => {
    try { res.json(await analyticsService.getOverview(req.user.ward_id)); } catch (err) { res.status(500).json({ error: err.message }); }
};
const ward = async (req, res) => {
    try { res.json(await analyticsService.getWardStats(req.user.ward_id)); } catch (err) { res.status(500).json({ error: err.message }); }
};
const sla = async (req, res) => {
    try { res.json(await analyticsService.getSLAMetrics(req.user.ward_id)); } catch (err) { res.status(500).json({ error: err.message }); }
};
const heatmap = async (req, res) => {
    try { res.json(await analyticsService.getHeatmap(req.user.ward_id)); } catch (err) { res.status(500).json({ error: err.message }); }
};
const departments = async (req, res) => {
    try { res.json(await analyticsService.getDepartmentPerformance(req.user.ward_id)); } catch (err) { res.status(500).json({ error: err.message }); }
};
const escalations = async (req, res) => {
    try { res.json(await analyticsService.getEscalations(req.user.ward_id)); } catch (err) { res.status(500).json({ error: err.message }); }
};

module.exports = { overview, ward, sla, heatmap, departments, escalations };
