'use client';

import StatusBadge from './StatusBadge';

interface TimelineEntry {
    id: number;
    from_status: string | null;
    to_status: string;
    actor_name: string;
    actor_role: string;
    note: string;
    created_at: string;
}

export default function Timeline({ history }: { history: TimelineEntry[] }) {
    if (!history || history.length === 0) {
        return <p className="text-gray-400 text-sm">No history yet.</p>;
    }

    return (
        <div className="flow-root">
            <ul className="-mb-8">
                {history.map((entry, idx) => (
                    <li key={entry.id}>
                        <div className="relative pb-8">
                            {idx < history.length - 1 && (
                                <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                            )}
                            <div className="relative flex space-x-3">
                                <div>
                                    <span className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center ring-8 ring-white text-white text-xs font-bold">
                                        {entry.to_status[0]}
                                    </span>
                                </div>
                                <div className="min-w-0 flex-1 pt-1.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {entry.from_status && (
                                            <>
                                                <StatusBadge status={entry.from_status} />
                                                <span className="text-gray-400 text-xs">→</span>
                                            </>
                                        )}
                                        <StatusBadge status={entry.to_status} />
                                    </div>
                                    <p className="text-sm text-gray-600 mt-0.5">
                                        {entry.note || '—'} &middot;{' '}
                                        <span className="font-medium">{entry.actor_name || entry.actor_role}</span>
                                    </p>
                                    <p className="text-xs text-gray-400">{new Date(entry.created_at).toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
