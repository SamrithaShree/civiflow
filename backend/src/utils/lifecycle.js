const { LIFECYCLE_TRANSITIONS, TRANSITION_PERMISSIONS } = require('../config/constants');

/**
 * Validates a status transition and checks role permission.
 * @param {string} fromStatus
 * @param {string} toStatus
 * @param {string} actorRole
 * @returns {{ valid: boolean, error?: string }}
 */
const validateTransition = (fromStatus, toStatus, actorRole) => {
    const allowed = LIFECYCLE_TRANSITIONS[fromStatus];
    if (!allowed) {
        return { valid: false, error: `Unknown status: ${fromStatus}` };
    }
    if (!allowed.includes(toStatus)) {
        return {
            valid: false,
            error: `Invalid transition: ${fromStatus} → ${toStatus}. Allowed: ${allowed.join(', ') || 'none'}`,
        };
    }

    const permKey = `${fromStatus}_to_${toStatus}`;
    const permittedRoles = TRANSITION_PERMISSIONS[permKey];
    if (permittedRoles && !permittedRoles.includes(actorRole)) {
        return {
            valid: false,
            error: `Role ${actorRole} cannot perform transition ${fromStatus} → ${toStatus}`,
        };
    }

    return { valid: true };
};

module.exports = { validateTransition };
