// Issue categories and their properties
const CATEGORIES = {
    ROAD: { weight: 8, slaHours: 48, label: 'Road & Potholes' },
    WATER: { weight: 9, slaHours: 24, label: 'Water Supply' },
    SANITATION: { weight: 9, slaHours: 24, label: 'Sanitation & Garbage' },
    ELECTRICITY: { weight: 10, slaHours: 12, label: 'Electricity' },
    DRAINAGE: { weight: 7, slaHours: 48, label: 'Drainage & Flooding' },
    PARK: { weight: 4, slaHours: 72, label: 'Parks & Public Spaces' },
    STREETLIGHT: { weight: 6, slaHours: 48, label: 'Street Lighting' },
    NOISE: { weight: 5, slaHours: 48, label: 'Noise Pollution' },
    OTHER: { weight: 3, slaHours: 72, label: 'Other' },
};

// Valid lifecycle transitions
const LIFECYCLE_TRANSITIONS = {
    NEW: ['ASSIGNED'],
    ASSIGNED: ['IN_PROGRESS'],
    IN_PROGRESS: ['RESOLVED'],
    RESOLVED: ['PENDING_VERIFICATION'],
    PENDING_VERIFICATION: ['CLOSED', 'REOPENED'],
    CLOSED: [],
    REOPENED: ['ASSIGNED', 'IN_PROGRESS'],
};

// Who can trigger which transitions
const TRANSITION_PERMISSIONS = {
    NEW_to_ASSIGNED: ['ADMIN', 'SUPERVISOR'],
    ASSIGNED_to_IN_PROGRESS: ['WORKER'],
    IN_PROGRESS_to_RESOLVED: ['WORKER'],
    RESOLVED_to_PENDING_VERIFICATION: ['SYSTEM'],
    PENDING_VERIFICATION_to_CLOSED: ['CITIZEN'],
    PENDING_VERIFICATION_to_REOPENED: ['CITIZEN'],
    REOPENED_to_ASSIGNED: ['ADMIN', 'SUPERVISOR'],
    REOPENED_to_IN_PROGRESS: ['WORKER'],
};

// Priority scoring multipliers
const PRIORITY = {
    SEVERITY_WEIGHTS: { LOW: 1, MEDIUM: 3, HIGH: 6, CRITICAL: 10 },
    DUPLICATE_BONUS: 5,
    AGE_PER_DAY: 0.5,
    REOPEN_BONUS: 8,
    INCIDENT_MODE_MULTIPLIER: 1.5,
};

// Duplicate detection
const DUPLICATE_DETECTION = {
    GEO_RADIUS_METERS: 200,
    TIME_WINDOW_HOURS: 72,
    INCIDENT_MODE_RADIUS_METERS: 500,
};

// Escalation levels
const ESCALATION_LEVELS = {
    LEVEL_1: { target: 'SUPERVISOR', hoursOverSLA: 0 },
    LEVEL_2: { target: 'ADMIN', hoursOverSLA: 24 },
};

const USER_ROLES = ['CITIZEN', 'WORKER', 'SUPERVISOR', 'ADMIN'];

const STATUS_LIST = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'PENDING_VERIFICATION', 'CLOSED', 'REOPENED'];

module.exports = {
    CATEGORIES,
    LIFECYCLE_TRANSITIONS,
    TRANSITION_PERMISSIONS,
    PRIORITY,
    DUPLICATE_DETECTION,
    ESCALATION_LEVELS,
    USER_ROLES,
    STATUS_LIST,
};
