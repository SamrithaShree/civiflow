'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getIssues, getEscalations, getWorkers, reassign, updateStatus } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import SLACountdown from '@/components/SLACountdown';
import FilterBar from '@/components/FilterBar';
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

interface IssueMapProps { issues: any[] }
const IssueMap = dynamic<IssueMapProps>(
    () => import('@/components/IssueMap') as Promise<{ default: ComponentType<IssueMapProps> }>,
    { ssr: false }
);

const FORCE_TRANSITIONS: Record<string, string[]> = {
    NEW: ['IN_PROGRESS', 'CLOSED'],
    ASSIGNED: ['IN_PROGRESS', 'CLOSED'],
    IN_PROGRESS: ['CLOSED'],
    REOPENED: ['ASSIGNED', 'IN_PROGRESS', 'CLOSED'],
    PENDING_VERIFICATION: ['CLOSED', 'IN_PROGRESS'],
};

export default function SupervisorDashboard() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [issues, setIssues] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [escalations, setEscalations] = useState<any[]>([]);
    const [workers, setWorkers] = useState<any[]>([]);
    const [tab, setTab] = useState<'issues' | 'escalations' | 'workers' | 'map'>('issues');
    const [msg, setMsg] = useState('');
    const [reassignModal, setReassignModal] = useState<{ issueId: number } | null>(null);
    const [reassignData, setReassignData] = useState({ workerId: '', reason: '' });
    const [forceStatus, setForceStatus] = useState<Record<number, string>>({});
    const [filters, setFilters] = useState({});

    useEffect(() => {
        const u = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('civiflow_user') || 'null') : null;
        if (!u || u.role !== 'SUPERVISOR') { router.push('/login'); return; }
        setUser(u);
        fetchAll({});
    }, []);

    const fetchAll = useCallback(async (params: any) => {
        const [issRes, escRes, wrkRes] = await Promise.all([
            getIssues(params),
            getEscalations(),
            getWorkers(),
        ]);
        setIssues(issRes.data.issues || []);
        setTotal(issRes.data.total || 0);
        setEscalations(escRes.data || []);
        setWorkers(wrkRes.data.workers || []);
    }, []);

    const handleFilter = (params: any) => {
        setFilters(params);
        fetchAll(params);
    };

    const handleReassign = async () => {
        if (!reassignModal || !reassignData.workerId) return;
        try {
            await reassign(reassignModal.issueId, parseInt(reassignData.workerId), reassignData.reason);
            setMsg('✅ Worker reassigned successfully');
            setReassignModal(null);
            fetchAll(filters);
        } catch (err: any) { setMsg(err.response?.data?.error || 'Error'); }
    };

    const handleForceStatus = async (issueId: number, status: string) => {
        if (!status) return;
        try {
            await updateStatus(issueId, status, '[Supervisor override]');
            setMsg(`✅ Issue force-updated to ${status}`);
            setForceStatus(prev => ({ ...prev, [issueId]: '' }));
            fetchAll(filters);
        } catch (err: any) { setMsg(err.response?.data?.error || 'Error'); }
    };

    const logout = () => { localStorage.clear(); router.push('/login'); };
    const breached = issues.filter(i => i.sla_breached);

    return (
        <div className="min-h-screen bg-slate-50">
            <nav className="bg-teal-700 text-white px-6 py-3 flex items-center justify-between shadow">
                <div className="flex items-center gap-3">
                    <span className="text-xl font-bold">🏛 CiviFlow</span>
                    <span className="bg-teal-500 text-xs rounded-full px-2 py-0.5">Supervisor</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm opacity-80">👔 {user?.name}</span>
                    <button onClick={logout} className="text-xs bg-teal-800 hover:bg-teal-900 px-3 py-1.5 rounded-lg transition">Logout</button>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    {[
                        { label: 'Total Issues', value: total, color: 'bg-indigo-600' },
                        { label: 'SLA Breached', value: breached.length, color: 'bg-red-600' },
                        { label: 'Escalations', value: escalations.length, color: 'bg-orange-500' },
                        { label: 'Workers', value: workers.length, color: 'bg-teal-600' },
                    ].map(s => (
                        <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center gap-4">
                            <div className={`${s.color} text-white rounded-lg px-3 py-2 text-xl font-bold min-w-[56px] text-center`}>{s.value}</div>
                            <span className="text-sm font-medium text-slate-600">{s.label}</span>
                        </div>
                    ))}
                </div>

                {msg && <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl px-4 py-3 mb-4 text-sm">{msg}</div>}

                {/* Tabs */}
                <div className="flex gap-2 mb-5">
                    {(['issues', 'escalations', 'workers', 'map'] as const).map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${tab === t ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-teal-300'}`}>
                            {t === 'map' ? '🗺️ Map' : t} {t === 'issues' ? `(${total})` : t === 'escalations' ? `(${escalations.length})` : t === 'workers' ? `(${workers.length})` : ''}
                        </button>
                    ))}
                </div>

                {/* Issues Tab */}
                {tab === 'issues' && (
                    <>
                        <FilterBar onFilter={handleFilter} />
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                                    <tr>{['Ticket', 'Category', 'Ward', 'Status', 'Priority', 'SLA', 'Worker', 'Override', 'Action'].map(h => <th key={h} className="px-3 py-3 text-left font-semibold">{h}</th>)}</tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {issues.map(issue => (
                                        <tr key={issue.id} className={issue.sla_breached ? 'bg-red-50' : ''}>
                                            <td className="px-3 py-2.5 font-mono text-xs text-indigo-600 font-bold">{issue.ticket_id}</td>
                                            <td className="px-3 py-2.5 text-xs">{issue.category}</td>
                                            <td className="px-3 py-2.5 text-xs text-slate-500">{issue.ward_name || '-'}</td>
                                            <td className="px-3 py-2.5"><StatusBadge status={issue.status} /></td>
                                            <td className="px-3 py-2.5 font-medium">{issue.priority_score}</td>
                                            <td className="px-3 py-2.5">{issue.sla_deadline ? <SLACountdown deadline={issue.sla_deadline} /> : '-'}</td>
                                            <td className="px-3 py-2.5 text-xs">{issue.worker_name || <span className="text-orange-500">Unassigned</span>}</td>
                                            {/* Force Status Override */}
                                            <td className="px-3 py-2.5">
                                                {FORCE_TRANSITIONS[issue.status] && (
                                                    <div className="flex items-center gap-1">
                                                        <select
                                                            value={forceStatus[issue.id] || ''}
                                                            onChange={e => setForceStatus(prev => ({ ...prev, [issue.id]: e.target.value }))}
                                                            className="border border-slate-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-teal-500">
                                                            <option value="">Force…</option>
                                                            {FORCE_TRANSITIONS[issue.status].map(s => <option key={s} value={s}>{s}</option>)}
                                                        </select>
                                                        {forceStatus[issue.id] && (
                                                            <button onClick={() => handleForceStatus(issue.id, forceStatus[issue.id])}
                                                                className="text-xs bg-orange-500 hover:bg-orange-400 text-white px-1.5 py-1 rounded font-medium transition">
                                                                Apply
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <button onClick={() => { setReassignModal({ issueId: issue.id }); setReassignData({ workerId: '', reason: '' }); }}
                                                    className="text-xs bg-teal-100 text-teal-700 hover:bg-teal-200 px-2.5 py-1 rounded-lg font-medium transition">Reassign</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {issues.length === 0 && (
                                        <tr><td colSpan={9} className="text-center py-10 text-slate-400">No issues match filters</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* Escalations Tab */}
                {tab === 'escalations' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                                <tr>{['Ticket', 'Category', 'Escalated To', 'Level', 'Hours Overdue', 'Reason', 'Date'].map(h => <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {escalations.map((e: any) => (
                                    <tr key={e.id}>
                                        <td className="px-4 py-3 font-mono text-xs text-indigo-600 font-bold">{e.ticket_id}</td>
                                        <td className="px-4 py-3">{e.category}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${e.escalated_to === 'ADMIN' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                                {e.escalated_to}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center font-semibold">{e.level}</td>
                                        <td className="px-4 py-3 text-red-600 font-medium">{Number(e.hours_overdue).toFixed(1)}h</td>
                                        <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">{e.reason}</td>
                                        <td className="px-4 py-3 text-xs text-slate-400">{new Date(e.created_at).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                                {escalations.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate-400">No escalations 🎉</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Workers Tab */}
                {tab === 'workers' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                                <tr>{['Name', 'Email', 'Ward', 'Active Assignments'].map(h => <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {workers.map((w: any) => (
                                    <tr key={w.id}>
                                        <td className="px-4 py-3 font-medium">{w.name}</td>
                                        <td className="px-4 py-3 text-slate-500 text-xs">{w.email}</td>
                                        <td className="px-4 py-3 text-xs">{w.ward_name || '-'}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${parseInt(w.active_assignments) > 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                {w.active_assignments} issues
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Map Tab */}
                {tab === 'map' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100">
                            <h3 className="font-semibold text-slate-700 text-sm">Issue Heatmap – Your Department</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Circle size = priority score. Red = SLA breached.</p>
                        </div>
                        <div style={{ height: 480 }} key={`map-${issues.length}`}>
                            <IssueMap key={`map-${issues.length}`} issues={issues} />
                        </div>
                    </div>
                )}
            </div>

            {/* Reassign Modal */}
            {reassignModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
                        <h3 className="font-semibold text-slate-800 mb-4">Reassign Worker</h3>
                        <div className="mb-3">
                            <label className="block text-sm text-slate-600 mb-1">Select Worker</label>
                            <select value={reassignData.workerId} onChange={e => setReassignData(d => ({ ...d, workerId: e.target.value }))}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                                <option value="">-- Select --</option>
                                {workers.map((w: any) => <option key={w.id} value={w.id}>{w.name} ({w.active_assignments} active)</option>)}
                            </select>
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm text-slate-600 mb-1">Reason</label>
                            <input value={reassignData.reason} onChange={e => setReassignData(d => ({ ...d, reason: e.target.value }))}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="Reason for reassignment" />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={handleReassign} className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">Reassign</button>
                            <button onClick={() => setReassignModal(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
