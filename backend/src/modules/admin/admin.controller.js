const adminService = require('./admin.service');

const toggleIncidentMode = async (req, res) => {
    try {
        const result = await adminService.toggleIncidentMode(req.user.id, req.body.activate, req.body.reason);
        res.json({ message: req.body.activate ? 'Incident mode activated' : 'Incident mode deactivated', data: result });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const getIncidentMode = async (req, res) => {
    try { res.json(await adminService.getIncidentMode()); } catch (err) { res.status(500).json({ error: err.message }); }
};

const getDepartments = async (req, res) => {
    try { res.json(await adminService.getAllDepartments()); } catch (err) { res.status(500).json({ error: err.message }); }
};

const createDepartment = async (req, res) => {
    try { res.status(201).json(await adminService.createDepartment(req.body)); } catch (err) { res.status(400).json({ error: err.message }); }
};

const getUsers = async (req, res) => {
    try { res.json(await adminService.getAllUsers(req.query.role)); } catch (err) { res.status(500).json({ error: err.message }); }
};

module.exports = { toggleIncidentMode, getIncidentMode, getDepartments, createDepartment, getUsers };
