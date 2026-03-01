/**
 * Role authorization middleware factory
 * Usage: authorize('ADMIN', 'SUPERVISOR')
 */
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
            });
        }
        next();
    };
};

module.exports = authorize;
