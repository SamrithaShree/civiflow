const issuesService = require('./issues.service');
const path = require('path');

const create = async (req, res) => {
    try {
        const photoUrls = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];
        const result = await issuesService.createIssue({
            ...req.body,
            reporterId: req.user.id,
            photoUrls,
        });
        if (result.isDuplicate) {
            return res.status(200).json({
                message: 'Duplicate detected. Your report has been attached to existing issue.',
                isDuplicate: true,
                parentIssueId: result.parentIssueId,
                ticketId: result.ticketId,
            });
        }
        res.status(201).json({ message: 'Issue created successfully', issue: result.issue });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

const list = async (req, res) => {
    try {
        const { status, category, page, limit } = req.query;
        const result = await issuesService.getIssues({
            role: req.user.role,
            userId: req.user.id,
            wardId: req.user.ward_id,
            status,
            category,
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 20,
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getById = async (req, res) => {
    try {
        const issue = await issuesService.getIssueById(parseInt(req.params.id));
        if (!issue) return res.status(404).json({ error: 'Issue not found' });
        res.json({ issue });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updateStatus = async (req, res) => {
    try {
        const { status, note } = req.body;
        const issue = await issuesService.transitionStatus(
            parseInt(req.params.id),
            status,
            req.user.id,
            req.user.role,
            note
        );
        res.json({ message: 'Status updated', issue });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

const verify = async (req, res) => {
    try {
        const { accepted, reason } = req.body;
        const issue = await issuesService.verifyResolution(
            parseInt(req.params.id),
            req.user.id,
            accepted,
            reason
        );
        res.json({ message: accepted ? 'Issue closed' : 'Issue reopened', issue });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

const uploadMedia = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        const urls = req.files.map(f => `/uploads/${f.filename}`);
        const { stage } = req.body;
        const issue = await issuesService.addMedia(parseInt(req.params.id), req.user.id, urls, stage || 'RESOLUTION');
        res.json({ message: 'Media uploaded', issue });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

module.exports = { create, list, getById, updateStatus, verify, uploadMedia };
