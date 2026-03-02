'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    getIssues, getOverview, getWardStats, getSLAMetrics, getDeptPerformance,
    getIncidentMode, toggleIncidentMode, getAllUsers,
    getPendingApprovals, approveUser, rejectUser, getWards
} from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import FilterBar from '@/components/FilterBar';
import dynamic from 'next/dynamic';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const IssueMap = dynamic(() => import('@/components/IssueMap'), { ssr: false });

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];

export default function AdminDashboard() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [overview, setOverview] = useState<any>(null);
    const [wardStats, setWardStats] = useState<any[]>([]);
    const [slaMetrics, setSlaMetrics] = useState<any[]>([]);
    const [deptPerf, setDeptPerf] = useState<any[]>([]);
    const [issues, setIssues] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [incident, setIncident] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [approvals, setApprovals] = useState<any[]>([]);
    const [rejectingId, setRejectingId] = useState<number | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [tab, setTab] = useState<'overview' | 'issues' | 'users' | 'analytics' | 'map' | 'approvals'>('overview');
    const [msg, setMsg] = useState('');
    const [filters, setFilters] = useState({});
    const [wards, setWards] = useState<any[]>([]);
    const [wardName, setWardName] = useState<string>('');

    useEffect(() => {
        const u = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('civiflow_user') || 'null') : null;
        if (!u || u.role !== 'ADMIN') { router.push('/login'); return; }
        setUser(u);
        // Load ward list to resolve names
        getWards().then(res => {
            const wardList = res.data?.wards || res.data || [];
            setWards(wardList);
            if (u.ward_id) {
                const found = wardList.find((w: any) => w.id === u.ward_id);
                if (found) setWardName(found.name);
            }
        }).catch(() => { });
        fetchAll({});
    }, []);

    const fetchAll = useCallback(async (params: any) => {
        try {
            const [ovRes, wdRes, slRes, dpRes, isRes, inRes, urRes, appRes] = await Promise.all([
                getOverview(), getWardStats(), getSLAMetrics(), getDeptPerformance(),
                getIssues(params), getIncidentMode(), getAllUsers(), getPendingApprovals()
            ]);
            setOverview(ovRes.data);
            setWardStats(wdRes.data || []);
            setSlaMetrics(slRes.data || []);
            setDeptPerf(dpRes.data || []);
            setIssues(isRes.data?.issues || []);
            setTotal(isRes.data?.total || 0);
            setIncident(inRes.data);
            setUsers(urRes.data || []);
            setApprovals(appRes.data?.approvals || []);
        } catch (err: any) {
            setMsg('Failed to load data: ' + (err.response?.data?.error || err.message));
        }
    }, []);

    const handleFilter = (params: any) => {
        setFilters(params);
        getIssues(params).then(res => {
            setIssues(res.data?.issues || []);
            setTotal(res.data?.total || 0);
        }).catch(() => { });
    };

    const handleIncidentToggle = async () => {
        const activate = !incident?.active;
        try {
            await toggleIncidentMode(activate, activate ? 'Emergency mode activated by admin' : 'Emergency mode deactivated');
            setMsg(activate ? '🚨 Incident Mode ACTIVATED' : '✅ Incident Mode deactivated.');
            fetchAll(filters);
        } catch (err: any) { setMsg(err.response?.data?.error || 'Error'); }
    };

    const logout = () => { localStorage.clear(); router.push('/login'); };

    const pieData = overview ? [
        { name: 'New', value: parseInt(overview.new_count) || 0 },
        { name: 'In Progress', value: parseInt(overview.in_progress_count) || 0 },
        { name: 'Resolved', value: parseInt(overview.resolved_count) || 0 },
        { name: 'Closed', value: parseInt(overview.closed_count) || 0 },
        { name: 'Reopened', value: parseInt(overview.reopened_count) || 0 },
    ].filter(d => d.value > 0) : [];

    return (
        <div className="min-h-screen bg-slate-50">
            <nav className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between shadow">
                <div className="flex items-center gap-3">
                    <span className="text-xl font-bold">🏛 CiviFlow</span>
                    <span className="bg-slate-700 text-xs rounded-full px-2 py-0.5">Admin</span>
                    {wardName && <span className="bg-indigo-700 text-xs rounded-full px-2 py-0.5">📍 {wardName}</span>}
                    {incident?.active && <span className="bg-red-600 text-xs rounded-full px-2 py-0.5 animate-pulse">🚨 WARD INCIDENT MODE</span>}
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm opacity-70">⚙️ {user?.name}</span>
                    <button onClick={logout} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition">Logout</button>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 py-8">
                {msg && <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl px-4 py-3 mb-4 text-sm">{msg}</div>}

                {/* Incident Mode Banner */}
                <div className={`rounded-xl p-4 mb-6 flex items-center justify-between ${incident?.active ? 'bg-red-50 border border-red-300' : 'bg-slate-100 border border-slate-200'}`}>
                    <div>
                        <span className="font-semibold text-sm">{incident?.active ? `🚨 Incident Mode ACTIVE — ${wardName || 'Your Ward'}` : '🔵 Incident Mode: Inactive'}</span>
                        {incident?.active && <p className="text-xs text-red-600 mt-0.5">Priority weights ×1.5 • Expanded duplicate radius • Emergency queue active — scoped to this ward only</p>}
                        {!incident?.active && <p className="text-xs text-slate-500 mt-0.5">Activate to increase response urgency for <strong>{wardName || 'your ward'}</strong> only</p>}
                    </div>
                    <button onClick={handleIncidentToggle}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${incident?.active ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>
                        {incident?.active ? 'Deactivate' : '🚨 Activate Incident Mode'}
                    </button>
                </div>

                {/* KPI Cards */}
                {overview && (
                    <div className="grid grid-cols-4 gap-4 mb-6">
                        {[
                            { label: 'Total Issues', value: overview.total, color: 'text-indigo-600' },
                            { label: 'Open Issues', value: parseInt(overview.total) - parseInt(overview.closed_count || 0), color: 'text-yellow-600' },
                            { label: 'Closed', value: overview.closed_count, color: 'text-green-600' },
                            { label: 'SLA Breached', value: overview.sla_breached, color: 'text-red-600' },
                        ].map(k => (
                            <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm text-center">
                                <div className={`text-3xl font-bold mb-1 ${k.color}`}>{k.value}</div>
                                <div className="text-xs text-slate-500">{k.label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-2 mb-5 flex-wrap">
                    {(['overview', 'issues', 'analytics', 'map', 'users', 'approvals'] as const).map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition relative ${tab === t ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-400'}`}>
                            {t === 'map' ? '🗺️ Map' : t === 'approvals' ? '✅ Approvals' : t}
                            {t === 'issues' ? ` (${total})` : ''}
                            {t === 'approvals' && approvals.length > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{approvals.length}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Overview Tab */}
                {tab === 'overview' && (
                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                            <h3 className="font-semibold text-slate-700 mb-4 text-sm">Issue Status Distribution</h3>
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Pie>
                                    <Legend /><Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                            <h3 className="font-semibold text-slate-700 mb-4 text-sm">Issues by Ward</h3>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={wardStats} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                                    <XAxis dataKey="ward_name" tick={{ fontSize: 10 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip />
                                    <Bar dataKey="total_issues" fill="#6366f1" radius={4} name="Total" />
                                    <Bar dataKey="sla_breached" fill="#ef4444" radius={4} name="Breached" />
                                    <Legend />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100"><h3 className="font-semibold text-slate-700 text-sm">Department Performance</h3></div>
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                                    <tr>{['Department', 'Total', 'Closed', 'SLA Breached', 'Avg Closure (h)'].map(h => <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>)}</tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {deptPerf.map((d: any) => (
                                        <tr key={d.id}>
                                            <td className="px-4 py-3 font-medium">{d.department_name}</td>
                                            <td className="px-4 py-3">{d.total_issues}</td>
                                            <td className="px-4 py-3 text-green-600">{d.closed}</td>
                                            <td className="px-4 py-3 text-red-600">{d.sla_breached}</td>
                                            <td className="px-4 py-3">{d.avg_closure_hours ?? '-'}</td>
                                        </tr>
                                    ))}
                                    {deptPerf.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-slate-400 text-sm">No data</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Issues Tab */}
                {tab === 'issues' && (
                    <>
                        <FilterBar onFilter={handleFilter} showWardFilter={true} />
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                                    <tr>{['Ticket', 'Category', 'Ward', 'Severity', 'Status', 'Priority', 'Reporter', 'Worker', 'Created'].map(h => <th key={h} className="px-3 py-3 text-left font-semibold">{h}</th>)}</tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {issues.map(issue => (
                                        <tr key={issue.id} className={issue.sla_breached ? 'bg-red-50' : ''}>
                                            <td className="px-3 py-2.5 font-mono text-xs text-indigo-600 font-bold whitespace-nowrap">{issue.ticket_id}</td>
                                            <td className="px-3 py-2.5 text-xs">{issue.category}</td>
                                            <td className="px-3 py-2.5 text-xs text-slate-500">{issue.ward_name || '-'}</td>
                                            <td className="px-3 py-2.5 text-xs">{issue.severity}</td>
                                            <td className="px-3 py-2.5"><StatusBadge status={issue.status} /></td>
                                            <td className="px-3 py-2.5 font-medium text-xs">{issue.priority_score}</td>
                                            <td className="px-3 py-2.5 text-xs">{issue.reporter_name || '-'}</td>
                                            <td className="px-3 py-2.5 text-xs">{issue.worker_name || <span className="text-orange-500">—</span>}</td>
                                            <td className="px-3 py-2.5 text-xs text-slate-400 whitespace-nowrap">{new Date(issue.created_at).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                    {issues.length === 0 && <tr><td colSpan={9} className="text-center py-10 text-slate-400">No issues match filters</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* Analytics Tab */}
                {tab === 'analytics' && (
                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                            <h3 className="font-semibold text-slate-700 mb-4 text-sm">{wardName ? `${wardName} – SLA Metrics by Category` : 'SLA Metrics by Category'}</h3>
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={slaMetrics} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                                    <XAxis dataKey="category" tick={{ fontSize: 9 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip />
                                    <Bar dataKey="total" fill="#6366f1" radius={4} name="Total" />
                                    <Bar dataKey="breached" fill="#ef4444" radius={4} name="Breached" />
                                    <Legend />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                            <h3 className="font-semibold text-slate-700 mb-4 text-sm">SLA Compliance by Category</h3>
                            <table className="w-full text-sm">
                                <thead className="text-xs text-slate-500 uppercase"><tr>{['Category', 'Total', 'Breached', 'Within SLA', 'Avg Hrs'].map(h => <th key={h} className="py-2 text-left font-semibold">{h}</th>)}</tr></thead>
                                <tbody className="divide-y divide-slate-100">
                                    {slaMetrics.map((m: any) => (
                                        <tr key={m.category}>
                                            <td className="py-2 font-medium">{m.category}</td>
                                            <td className="py-2">{m.total}</td>
                                            <td className="py-2 text-red-600">{m.breached}</td>
                                            <td className="py-2 text-green-600">{m.resolved_within_sla}</td>
                                            <td className="py-2">{m.avg_resolution_hours ?? '-'}</td>
                                        </tr>
                                    ))}
                                    {slaMetrics.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-slate-400">No data</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Map Tab */}
                {tab === 'map' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-slate-700 text-sm">{wardName ? `${wardName} Issue Map` : 'City-wide Issue Heatmap'}</h3>
                                <p className="text-xs text-slate-400 mt-0.5">🟢 Low priority &nbsp; 🟡 Medium &nbsp; 🟠 High &nbsp; 🔴 SLA Breached</p>
                            </div>
                            <span className="text-xs text-slate-500">{issues.length} issues plotted</span>
                        </div>
                        <div style={{ height: 520 }} key={`map-${issues.length}`}>
                            <IssueMap key={`map-${issues.length}`} issues={issues} />
                        </div>
                    </div>
                )}

                {/* Users Tab */}
                {tab === 'users' && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        {wardName && <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 text-xs text-indigo-700 font-medium">Showing users for: <strong>{wardName}</strong></div>}
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                                <tr>{['Name', 'Email', 'Role', 'Ward', 'Status', 'Joined'].map(h => <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {users.map((u: any) => (
                                    <tr key={u.id}>
                                        <td className="px-4 py-3 font-medium">{u.name}</td>
                                        <td className="px-4 py-3 text-xs text-slate-500">{u.email}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.role === 'ADMIN' ? 'bg-slate-800 text-white' : u.role === 'SUPERVISOR' ? 'bg-teal-100 text-teal-700' : u.role === 'WORKER' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{u.role}</span>
                                        </td>
                                        <td className="px-4 py-3 text-xs">{u.ward_name || (u.ward_id ? `Ward ${u.ward_id}` : '—')}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.verification_status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                u.verification_status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>{u.verification_status || 'APPROVED'}</span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-400">{new Date(u.created_at).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Approvals Tab */}
                {tab === 'approvals' && (
                    <div className="space-y-4">
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-800">
                            <strong>📋 Pending Registration Approvals</strong> — Review and approve or reject Worker/Supervisor registrations for your ward.
                        </div>
                        {approvals.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
                                <div className="text-4xl mb-3">✅</div>
                                <div className="text-slate-500 font-medium">No pending approvals</div>
                                <div className="text-slate-400 text-sm mt-1">All registrations have been processed.</div>
                            </div>
                        ) : approvals.map((u: any) => (
                            <div key={u.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-slate-800">{u.name}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${u.role === 'WORKER' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'
                                                }`}>{u.role}</span>
                                            <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">⏳ Pending</span>
                                        </div>
                                        <div className="text-sm text-slate-500 space-y-1">
                                            <div>📧 {u.email} {u.phone ? `· 📞 ${u.phone}` : ''}</div>
                                            <div>🏘️ Ward: <strong>{u.ward_name || u.ward_id || '—'}</strong></div>
                                            {u.worker_id_number && <div>🪪 Worker ID: <strong className="font-mono">{u.worker_id_number}</strong></div>}
                                            {u.supervisor_id_number && <div>🪪 Supervisor ID: <strong className="font-mono">{u.supervisor_id_number}</strong></div>}
                                            <div className="text-xs text-slate-400">Registered: {new Date(u.created_at).toLocaleString()}</div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 min-w-[120px]">
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await approveUser(u.id);
                                                    setMsg(`✅ ${u.name} approved successfully.`);
                                                    fetchAll(filters);
                                                } catch (err: any) {
                                                    setMsg('Error: ' + (err.response?.data?.error || err.message));
                                                }
                                            }}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition"
                                        >✓ Approve</button>
                                        <button
                                            onClick={() => setRejectingId(rejectingId === u.id ? null : u.id)}
                                            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-sm font-semibold rounded-lg transition"
                                        >✕ Reject</button>
                                    </div>
                                </div>
                                {rejectingId === u.id && (
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        <label className="block text-sm text-slate-500 mb-1">Rejection Reason</label>
                                        <div className="flex gap-2">
                                            <input
                                                value={rejectReason}
                                                onChange={e => setRejectReason(e.target.value)}
                                                placeholder="e.g. Invalid Worker ID provided"
                                                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                                            />
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await rejectUser(u.id, rejectReason);
                                                        setMsg(`❌ ${u.name}'s registration rejected.`);
                                                        setRejectingId(null);
                                                        setRejectReason('');
                                                        fetchAll(filters);
                                                    } catch (err: any) {
                                                        setMsg('Error: ' + (err.response?.data?.error || err.message));
                                                    }
                                                }}
                                                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition"
                                            >Confirm</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
