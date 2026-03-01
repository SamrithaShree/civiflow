'use client';

const STATUS_STYLES: Record<string, string> = {
    NEW: 'bg-blue-100 text-blue-800 border-blue-200',
    ASSIGNED: 'bg-purple-100 text-purple-800 border-purple-200',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    RESOLVED: 'bg-green-100 text-green-800 border-green-200',
    PENDING_VERIFICATION: 'bg-orange-100 text-orange-800 border-orange-200',
    CLOSED: 'bg-gray-100 text-gray-700 border-gray-200',
    REOPENED: 'bg-red-100 text-red-800 border-red-200',
};

const STATUS_LABELS: Record<string, string> = {
    NEW: 'New',
    ASSIGNED: 'Assigned',
    IN_PROGRESS: 'In Progress',
    RESOLVED: 'Resolved',
    PENDING_VERIFICATION: 'Pending Verification',
    CLOSED: 'Closed',
    REOPENED: 'Reopened',
};

export default function StatusBadge({ status }: { status: string }) {
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-70" />
            {STATUS_LABELS[status] || status}
        </span>
    );
}
