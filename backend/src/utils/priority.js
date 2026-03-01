const { CATEGORIES, PRIORITY } = require('../config/constants');

/**
 * Calculates priority score for an issue.
 * Higher score = higher urgency.
 */
const calculatePriority = ({
    category,
    severity,
    duplicateCount = 0,
    ageInDays = 0,
    isReopened = false,
    incidentMode = false,
}) => {
    const categoryWeight = CATEGORIES[category]?.weight || CATEGORIES.OTHER.weight;
    const severityWeight = PRIORITY.SEVERITY_WEIGHTS[severity] || 1;
    const duplicateBonus = duplicateCount * PRIORITY.DUPLICATE_BONUS;
    const ageScore = ageInDays * PRIORITY.AGE_PER_DAY;
    const reopenBonus = isReopened ? PRIORITY.REOPEN_BONUS : 0;

    let score = categoryWeight + severityWeight + duplicateBonus + ageScore + reopenBonus;

    if (incidentMode) {
        score = score * PRIORITY.INCIDENT_MODE_MULTIPLIER;
    }

    return Math.round(score * 100) / 100;
};

/**
 * Returns SLA deadline timestamp for a given category.
 */
const getSLADeadline = (category, incidentMode = false) => {
    let hours = CATEGORIES[category]?.slaHours || 72;
    if (incidentMode) hours = Math.max(hours * 0.5, 6); // tighten SLA in incident mode
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + hours);
    return deadline;
};

module.exports = { calculatePriority, getSLADeadline };
