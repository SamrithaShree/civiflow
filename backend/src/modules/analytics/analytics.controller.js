const analyticsService = require('./analytics.service');

const overview = async (req, res) => {
    try { res.json(await analyticsService.getOverview()); } catch (err) { res.status(500).json({ error: err.message }); }
};
const ward = async (req, res) => {
    try { res.json(await analyticsService.getWardStats()); } catch (err) { res.status(500).json({ error: err.message }); }
};
const sla = async (req, res) => {
    try { res.json(await analyticsService.getSLAMetrics()); } catch (err) { res.status(500).json({ error: err.message }); }
};
const heatmap = async (req, res) => {
    try { res.json(await analyticsService.getHeatmap()); } catch (err) { res.status(500).json({ error: err.message }); }
};
const departments = async (req, res) => {
    try { res.json(await analyticsService.getDepartmentPerformance()); } catch (err) { res.status(500).json({ error: err.message }); }
};
const escalations = async (req, res) => {
    try { res.json(await analyticsService.getEscalations()); } catch (err) { res.status(500).json({ error: err.message }); }
};

module.exports = { overview, ward, sla, heatmap, departments, escalations };
