const { LIFECYCLE_TRANSITIONS, TRANSITION_PERMISSIONS } = require('../config/constants');

// Transitions a SUPERVISOR can force regardless of normal state machine rules
const SUPERVISOR_FORCE_TRANSITIONS = {
    CLOSED: ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'REOPENED'],
    IN_PROGRESS: ['NEW', 'ASSIGNED', 'REOPENED'],
    ASSIGNED: ['REOPENED'],
};

// ADMIN can force any → these statuses
const ADMIN_FORCE_TO = ['CLOSED', 'ASSIGNED', 'IN_PROGRESS', 'REOPENED', 'NEW'];

/**
 * Validates a status transition and checks role permission.
 * SUPERVISORs and ADMINs have override capability for stuck issues.
 * @param {string} fromStatus
 * @param {string} toStatus
 * @param {string} actorRole
 * @returns {{ valid: boolean, error?: string }}
 */
const validateTransition = (fromStatus, toStatus, actorRole) => {
    // ADMIN force override — can force any → any valid status
    if (actorRole === 'ADMIN' && ADMIN_FORCE_TO.includes(toStatus)) {
        return { valid: true };
    }

    // SUPERVISOR force override — can close/reassign stuck issues
    if (actorRole === 'SUPERVISOR') {
        const allowedFrom = SUPERVISOR_FORCE_TRANSITIONS[toStatus];
        if (allowedFrom && allowedFrom.includes(fromStatus)) {
            return { valid: true };
        }
    }

    // Normal lifecycle rules
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
