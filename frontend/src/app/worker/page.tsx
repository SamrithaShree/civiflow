'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getMyAssignments, updateStatus, uploadMedia, getIssues, getIssue } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import SLACountdown from '@/components/SLACountdown';
import Timeline from '@/components/Timeline';
import dynamic from 'next/dynamic';

const IssueMap = dynamic(() => import('@/components/IssueMap'), { ssr: false });

export default function WorkerDashboard() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [issues, setIssues] = useState<any[]>([]);
    const [selected, setSelected] = useState<any>(null);
    const [resolveNote, setResolveNote] = useState('');
    const [photo, setPhoto] = useState<File | null>(null);
    const [msg, setMsg] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const u = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('civiflow_user') || 'null') : null;
        if (!u || u.role !== 'WORKER') { router.push('/login'); return; }
        setUser(u);
        fetchIssues();
    }, []);

    const fetchIssues = async () => {
        const res = await getIssues();
        setIssues(res.data.issues || []);
    };

    const fetchIssue = async (id: number) => {
        const res = await getIssue(id);
        setSelected(res.data.issue);
    };

    const handleStatusUpdate = async (id: number, status: string, note?: string) => {
        setLoading(true); setMsg('');
        try {
            await updateStatus(id, status, note);
            setMsg(`✅ Status updated to ${status}`);
            await fetchIssues();
            if (selected?.id === id) await fetchIssue(id);
        } catch (err: any) {
            setMsg(err.response?.data?.error || 'Error');
        } finally { setLoading(false); }
    };

    const handleResolutionUpload = async (id: number) => {
        if (!photo) { setMsg('Please select a photo'); return; }
        setLoading(true);
        try {
            const fd = new FormData();
            fd.append('photos', photo);
            fd.append('stage', 'RESOLUTION');
            await uploadMedia(id, fd);
            await handleStatusUpdate(id, 'RESOLVED', resolveNote);
            setPhoto(null); setResolveNote('');
        } catch (err: any) {
            setMsg(err.response?.data?.error || 'Upload failed');
        } finally { setLoading(false); }
    };

    const logout = () => { localStorage.clear(); router.push('/login'); };

    return (
        <div className="min-h-screen bg-slate-50">
            <nav className="bg-slate-800 text-white px-6 py-3 flex items-center justify-between shadow">
                <div className="flex items-center gap-3">
                    <span className="text-xl font-bold">🏛 CiviFlow</span>
                    <span className="bg-slate-600 text-xs rounded-full px-2 py-0.5">Worker Portal</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm opacity-80">👷 {user?.name}</span>
                    <button onClick={logout} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition">Logout</button>
                </div>
            </nav>

            <div className="max-w-6xl mx-auto px-4 py-8">
                {msg && <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl px-4 py-3 mb-4 text-sm">{msg}</div>}

                <div className="grid grid-cols-3 gap-6">
                    {/* Issue list */}
                    <div className="col-span-1 space-y-2">
                        <h2 className="font-semibold text-slate-700 mb-3">Assigned Issues ({issues.length})</h2>
                        {issues.length === 0 && <p className="text-slate-400 text-sm">No issues assigned.</p>}
                        {issues.map(issue => (
                            <button key={issue.id} onClick={() => fetchIssue(issue.id)}
                                className={`w-full text-left rounded-xl border p-3 transition ${selected?.id === issue.id ? 'border-indigo-500 bg-indigo-50' : 'bg-white border-slate-200 hover:border-indigo-300'}`}>
                                <div className="flex justify-between mb-1">
                                    <span className="font-mono text-xs text-indigo-600 font-bold">{issue.ticket_id}</span>
                                    <StatusBadge status={issue.status} />
                                </div>
                                <p className="text-xs text-slate-600 truncate">{issue.description}</p>
                                <div className="mt-1.5">
                                    {issue.sla_deadline && <SLACountdown deadline={issue.sla_deadline} />}
                                </div>
                                <div className="flex gap-2 mt-1 text-xs text-slate-400">
                                    <span>🏷 {issue.category}</span>
                                    <span>🔥 {issue.priority_score}</span>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Issue detail */}
                    <div className="col-span-2">
                        {!selected && (
                            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 shadow-sm">
                                <div className="text-4xl mb-3">📋</div>
                                <p>Select an issue to view details and update status</p>
                            </div>
                        )}
                        {selected && (
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="font-mono text-indigo-600 font-bold text-lg">{selected.ticket_id}</span>
                                    <StatusBadge status={selected.status} />
                                </div>
                                <p className="text-slate-700">{selected.description}</p>
                                <div className="grid grid-cols-3 gap-3 text-sm">
                                    <div className="bg-slate-50 rounded-lg p-3"><span className="text-xs text-slate-400 block">Category</span><strong>{selected.category}</strong></div>
                                    <div className="bg-slate-50 rounded-lg p-3"><span className="text-xs text-slate-400 block">Severity</span><strong>{selected.severity}</strong></div>
                                    <div className="bg-slate-50 rounded-lg p-3"><span className="text-xs text-slate-400 block">Ward</span><strong>{selected.ward_name || '-'}</strong></div>
                                </div>
                                {selected.sla_deadline && (
                                    <div className="bg-slate-50 rounded-lg p-3">
                                        <span className="text-xs text-slate-400 block mb-1">SLA Deadline</span>
                                        <SLACountdown deadline={selected.sla_deadline} />
                                    </div>
                                )}

                                <div>
                                    <h3 className="font-semibold text-slate-700 mb-2 text-sm">Location</h3>
                                    <div className="h-48 border border-slate-200 rounded-lg overflow-hidden relative z-0" key={`map-${selected.id}`}>
                                        <IssueMap key={selected.id} issues={[selected]} />
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="border-t border-slate-100 pt-4 space-y-3">
                                    {selected.status === 'ASSIGNED' && (
                                        <button onClick={() => handleStatusUpdate(selected.id, 'IN_PROGRESS')} disabled={loading}
                                            className="w-full bg-yellow-500 hover:bg-yellow-400 text-white py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50">
                                            🚧 Start Work (Mark In Progress)
                                        </button>
                                    )}
                                    {selected.status === 'IN_PROGRESS' && (
                                        <div className="space-y-3 bg-green-50 border border-green-200 rounded-xl p-4">
                                            <p className="font-semibold text-green-800 text-sm">Upload Resolution Evidence</p>
                                            <textarea value={resolveNote} onChange={e => setResolveNote(e.target.value)} placeholder="Resolution note…" rows={2}
                                                className="w-full border border-green-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none" />
                                            <input type="file" accept="image/*" onChange={e => setPhoto(e.target.files?.[0] || null)}
                                                className="w-full text-sm border border-green-300 rounded-lg px-3 py-2" />
                                            <button onClick={() => handleResolutionUpload(selected.id)} disabled={loading}
                                                className="w-full bg-green-600 hover:bg-green-500 text-white py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50">
                                                {loading ? 'Uploading…' : '✅ Mark Resolved & Upload Photo'}
                                            </button>
                                        </div>
                                    )}
                                    {['PENDING_VERIFICATION', 'CLOSED', 'REOPENED'].includes(selected.status) && (
                                        <div className="text-sm text-slate-500 text-center py-2">
                                            {selected.status === 'PENDING_VERIFICATION' ? '⏳ Awaiting citizen verification…' : selected.status === 'CLOSED' ? '✅ Issue closed.' : '🔄 Issue reopened – awaiting reassignment.'}
                                        </div>
                                    )}
                                </div>

                                {/* Timeline */}
                                <div className="border-t border-slate-100 pt-4">
                                    <h3 className="font-semibold text-slate-700 mb-3 text-sm">Status History</h3>
                                    <Timeline history={selected.statusHistory} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
