const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

const auditLog = (req, res, next) => {
    if (!MUTATING_METHODS.includes(req.method)) return next();

    const originalSend = res.send.bind(res);
    res.send = (body) => {
        const log = {
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.path,
            user: req.user ? { id: req.user.id, role: req.user.role } : null,
            statusCode: res.statusCode,
            ip: req.ip,
        };
        const logLine = JSON.stringify(log) + '\n';
        fs.appendFile(path.join(logDir, 'audit.log'), logLine, () => { });
        console.log('[AUDIT]', logLine.trim());
        return originalSend(body);
    };
    next();
};

module.exports = auditLog;
