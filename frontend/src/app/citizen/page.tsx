'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getIssues, createIssue, getIssue, verifyResolution } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import Timeline from '@/components/Timeline';
import dynamic from 'next/dynamic';

const LocationPicker = dynamic(() => import('@/components/LocationPicker'), { ssr: false });
const IssueMap = dynamic(() => import('@/components/IssueMap'), { ssr: false });

const CATEGORIES = ['ROAD', 'WATER', 'SANITATION', 'ELECTRICITY', 'DRAINAGE', 'PARK', 'STREETLIGHT', 'NOISE', 'OTHER'];
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function CitizenDashboard() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [issues, setIssues] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [view, setView] = useState<'list' | 'new' | 'detail'>('list');
    const [selectedIssue, setSelectedIssue] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');
    const [form, setForm] = useState({ category: 'ROAD', description: '', lat: '12.9716', lng: '77.5946', severity: 'MEDIUM' });
    const [idempotencyKey, setIdempotencyKey] = useState('');
    const [photo, setPhoto] = useState<File | null>(null);
    const [verifyReason, setVerifyReason] = useState('');

    useEffect(() => {
        setIdempotencyKey(crypto.randomUUID());
        const u = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('civiflow_user') || 'null') : null;
        if (!u || u.role !== 'CITIZEN') { router.push('/login'); return; }
        setUser(u);
        fetchIssues();
    }, []);

    const fetchIssues = async () => {
        try {
            const res = await getIssues();
            setIssues(res.data.issues || []);
            setTotal(res.data.total || 0);
        } catch { }
    };

    const fetchIssue = async (id: number) => {
        try {
            const res = await getIssue(id);
            setSelectedIssue(res.data.issue);
            setView('detail');
        } catch { }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setMsg('');
        try {
            const fd = new FormData();
            Object.entries(form).forEach(([k, v]) => fd.append(k, v));
            fd.append('idempotencyKey', idempotencyKey);
            if (photo) fd.append('photos', photo);
            const res = await createIssue(fd);

            if (res.data.isDuplicate) {
                setMsg(`Your report was merged with ticket ${res.data.ticketId}. Your report boosts its priority.`);
            } else if (res.data.message === 'Issue already created') {
                setMsg(`✅ Issue submitted! Ticket ID: ${res.data.issue.ticket_id}`);
            } else {
                setMsg(`✅ Issue submitted! Ticket ID: ${res.data.issue.ticket_id}`);
            }
            // Generate a fresh idempotency key for the next report
            setIdempotencyKey(crypto.randomUUID());
            setForm({ category: 'ROAD', description: '', lat: '12.9716', lng: '77.5946', severity: 'MEDIUM' });
            setPhoto(null);

            await fetchIssues();
            setView('list');
        } catch (err: any) {
            setMsg(err.response?.data?.error || 'Submission failed');
        } finally { setLoading(false); }
    };

    const handleVerify = async (accepted: boolean) => {
        if (!selectedIssue) return;
        try {
            await verifyResolution(selectedIssue.id, accepted, verifyReason || undefined);
            setMsg(accepted ? '✅ Issue closed. Thank you!' : '⚠️ Issue reopened. We apologize for the inconvenience.');
            await fetchIssue(selectedIssue.id);
        } catch (err: any) {
            setMsg(err.response?.data?.error || 'Error');
        }
    };

    const logout = () => { localStorage.clear(); router.push('/login'); };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Navbar */}
            <nav className="bg-indigo-700 text-white px-6 py-3 flex items-center justify-between shadow">
                <div className="flex items-center gap-3">
                    <span className="text-xl font-bold">🏛 CiviFlow</span>
                    <span className="bg-indigo-500 text-xs rounded-full px-2 py-0.5">Citizen Portal</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm opacity-80">{user?.name}</span>
                    <button onClick={logout} className="text-xs bg-indigo-800 hover:bg-indigo-900 px-3 py-1.5 rounded-lg transition">Logout</button>
                </div>
            </nav>

            <div className="max-w-4xl mx-auto px-4 py-8">
                {msg && <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl px-4 py-3 mb-6 text-sm">{msg}</div>}

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    {([['list', `My Issues (${total})`], ['new', '+ Report Issue']] as const).map(([v, label]) => (
                        <button key={v} onClick={() => { setView(v as any); setMsg(''); }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${view === v ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'}`}>
                            {label}
                        </button>
                    ))}
                </div>

                {/* Issue List */}
                {view === 'list' && (
                    <div className="space-y-3">
                        {issues.length === 0 && <div className="text-center py-16 text-slate-400">No issues yet. Report your first!</div>}
                        {issues.map(issue => (
                            <button key={issue.id} onClick={() => fetchIssue(issue.id)} className="w-full text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-indigo-300 hover:shadow-sm transition">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-mono text-xs text-indigo-600 font-bold">{issue.ticket_id}</span>
                                    <StatusBadge status={issue.status} />
                                </div>
                                <p className="text-sm font-medium text-slate-800 mb-1">{issue.description.slice(0, 100)}{issue.description.length > 100 ? '…' : ''}</p>
                                <div className="flex gap-4 text-xs text-slate-400">
                                    <span>📍 {issue.ward_name || 'Unknown Ward'}</span>
                                    <span>🏷 {issue.category}</span>
                                    <span>🔥 Priority: {issue.priority_score}</span>
                                    <span>{new Date(issue.created_at).toLocaleDateString()}</span>
                                </div>
                                {issue.sla_breached && <span className="text-xs text-red-600 font-medium">⚠️ SLA Breached</span>}
                            </button>
                        ))}
                    </div>
                )}

                {/* Report Issue Form */}
                {view === 'new' && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-slate-800 mb-5">Report a New Issue</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
                                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500">
                                        {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Severity *</label>
                                    <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500">
                                        {SEVERITIES.map(s => <option key={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
                                <textarea required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 resize-none"
                                    placeholder="Describe the issue in detail…" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Location Pin *</label>
                                <LocationPicker lat={form.lat} lng={form.lng} onChange={(lat, lng) => setForm(f => ({ ...f, lat, lng }))} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Photo (optional)</label>
                                <input type="file" accept="image/*" onChange={e => setPhoto(e.target.files?.[0] || null)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-600" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="submit" disabled={loading}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50">
                                    {loading ? 'Submitting…' : 'Submit Report'}
                                </button>
                                <button type="button" onClick={() => setView('list')} className="px-6 py-2.5 text-slate-600 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Issue Detail */}
                {view === 'detail' && selectedIssue && (
                    <div className="space-y-4">
                        <button onClick={() => setView('list')} className="text-sm text-indigo-600 hover:underline">← Back to list</button>
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <span className="font-mono text-indigo-600 font-bold text-lg">{selectedIssue.ticket_id}</span>
                                <StatusBadge status={selectedIssue.status} />
                            </div>
                            <h2 className="text-base font-semibold text-slate-800 mb-3">{selectedIssue.description}</h2>
                            <div className="grid grid-cols-3 gap-3 text-sm mb-4">
                                <div className="bg-slate-50 rounded-lg p-3"><span className="text-slate-400 block text-xs">Category</span><strong>{selectedIssue.category}</strong></div>
                                <div className="bg-slate-50 rounded-lg p-3"><span className="text-slate-400 block text-xs">Severity</span><strong>{selectedIssue.severity}</strong></div>
                                <div className="bg-slate-50 rounded-lg p-3"><span className="text-slate-400 block text-xs">Priority Score</span><strong>{selectedIssue.priority_score}</strong></div>
                            </div>
                            {selectedIssue.worker_name && (
                                <p className="text-sm text-slate-600 mb-4">👷 Assigned Worker: <strong>{selectedIssue.worker_name}</strong></p>
                            )}

                            <div className="mb-4">
                                <h3 className="font-semibold text-slate-700 mb-2 text-sm">Issue Location</h3>
                                <div className="h-48 border border-slate-200 rounded-lg overflow-hidden relative z-0" key={`map-${selectedIssue.id}`}>
                                    <IssueMap key={selectedIssue.id} issues={[selectedIssue]} />
                                </div>
                            </div>

                            {/* Verification Controls */}
                            {selectedIssue.status === 'PENDING_VERIFICATION' && (
                                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                                    <p className="font-semibold text-orange-800 text-sm mb-2">🔍 Resolution Review Required</p>
                                    <p className="text-sm text-orange-700 mb-3">The assigned worker has marked this issue as resolved. Please review the resolution photos and confirm.</p>
                                    {selectedIssue.media?.filter((m: any) => m.stage === 'RESOLUTION').map((m: any) => (
                                        <img key={m.id} src={`http://localhost:5000${m.url}`} alt="Resolution" className="rounded-lg mb-2 max-h-48 object-cover" />
                                    ))}
                                    {selectedIssue.resolution_note && <p className="text-sm text-slate-600 mb-3">Note: {selectedIssue.resolution_note}</p>}
                                    <textarea value={verifyReason} onChange={e => setVerifyReason(e.target.value)}
                                        placeholder="Add a note (optional)…" rows={2}
                                        className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none resize-none" />
                                    <div className="flex gap-3">
                                        <button onClick={() => handleVerify(true)} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">✅ Accept & Close</button>
                                        <button onClick={() => handleVerify(false)} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">❌ Reject & Reopen</button>
                                    </div>
                                </div>
                            )}

                            {/* Status Timeline */}
                            <div className="mt-4">
                                <h3 className="font-semibold text-slate-700 mb-3 text-sm">Status History</h3>
                                <Timeline history={selectedIssue.statusHistory} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
