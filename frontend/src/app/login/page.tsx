'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';
import Link from 'next/link';

export default function LoginPage() {
    const router = useRouter();
    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            const res = await login(form);
            localStorage.setItem('civiflow_token', res.data.token);
            localStorage.setItem('civiflow_user', JSON.stringify(res.data.user));
            const routes: Record<string, string> = { CITIZEN: '/citizen', WORKER: '/worker', SUPERVISOR: '/supervisor', ADMIN: '/admin' };
            router.push(routes[res.data.user.role] || '/');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Login failed');
        } finally { setLoading(false); }
    };

    const DEMO = [
        { email: 'admin@civiflow.gov', role: 'Admin' },
        { email: 'supervisor@civiflow.gov', role: 'Supervisor' },
        { email: 'worker@civiflow.gov', role: 'Worker' },
        { email: 'citizen@civiflow.gov', role: 'Citizen' },
    ];

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="text-4xl font-bold text-indigo-400 mb-1">🏛 CiviFlow</div>
                    <p className="text-slate-400 text-sm">Municipal Civic Issue Management Platform</p>
                </div>
                <div className="bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-700">
                    <h2 className="text-xl font-semibold text-white mb-6">Sign In</h2>
                    {error && <div className="bg-red-900/50 border border-red-700 text-red-300 rounded-lg p-3 mb-4 text-sm">{error}</div>}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Email</label>
                            <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 text-sm" placeholder="Enter your email" />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Password</label>
                            <input type="password" required value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 text-sm" placeholder="Enter password" />
                        </div>
                        <button type="submit" disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2.5 font-semibold text-sm transition disabled:opacity-50">
                            {loading ? 'Signing in…' : 'Sign In'}
                        </button>
                    </form>
                    <p className="text-center text-sm text-slate-400 mt-4">
                        No account? <Link href="/register" className="text-indigo-400 hover:underline">Register</Link>
                    </p>
                    <div className="mt-6 border-t border-slate-700 pt-4">
                        <p className="text-xs text-slate-500 mb-2">Demo accounts (password: <code className="text-slate-300">Admin@123</code>)</p>
                        <div className="grid grid-cols-2 gap-2">
                            {DEMO.map(d => (
                                <button key={d.email} onClick={() => setForm({ email: d.email, password: 'Admin@123' })}
                                    className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg px-2 py-1.5 transition text-left">
                                    <span className="font-semibold text-indigo-400">{d.role}</span><br />
                                    <span className="text-slate-400">{d.email}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
