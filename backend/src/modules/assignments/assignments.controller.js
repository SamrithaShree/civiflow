const assignmentsService = require('./assignments.service');

const reassign = async (req, res) => {
    try {
        const result = await assignmentsService.reassign({
            issueId: parseInt(req.params.issueId),
            workerId: parseInt(req.body.workerId),
            assignedBy: req.user.id,
            reason: req.body.reason || 'Reassigned by supervisor',
        });
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

const getMyAssignments = async (req, res) => {
    try {
        const assignments = await assignmentsService.getWorkerAssignments(req.user.id);
        res.json({ assignments });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getWorkers = async (req, res) => {
    try {
        const { wardId } = req.query;
        const workers = await assignmentsService.getWorkersWithLoad(wardId ? parseInt(wardId) : null);
        res.json({ workers });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { reassign, getMyAssignments, getWorkers };
