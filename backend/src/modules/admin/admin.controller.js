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

const getPendingApprovals = async (req, res) => {
    try {
        const data = await adminService.getPendingApprovals(req.user.ward_id);
        res.json({ approvals: data, total: data.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const approveUser = async (req, res) => {
    try {
        const user = await adminService.approveUser(parseInt(req.params.id), req.user.id);
        res.json({ message: 'User approved successfully.', user });
    } catch (err) { res.status(400).json({ error: err.message }); }
};

const rejectUser = async (req, res) => {
    try {
        const user = await adminService.rejectUser(parseInt(req.params.id), req.user.id, req.body.reason);
        res.json({ message: 'User registration rejected.', user });
    } catch (err) { res.status(400).json({ error: err.message }); }
};

module.exports = { toggleIncidentMode, getIncidentMode, getDepartments, createDepartment, getUsers, getPendingApprovals, approveUser, rejectUser };
