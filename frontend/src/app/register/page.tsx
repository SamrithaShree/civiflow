'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { register } from '@/lib/api';
import Link from 'next/link';

export default function RegisterPage() {
    const router = useRouter();
    const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            await register({ ...form, role: 'CITIZEN' });
            router.push('/login');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Registration failed');
        } finally { setLoading(false); }
    };

    const fields = [
        { key: 'name', label: 'Full Name', type: 'text', placeholder: 'Your full name' },
        { key: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
        { key: 'password', label: 'Password', type: 'password', placeholder: 'Min 8 characters' },
        { key: 'phone', label: 'Phone (optional)', type: 'tel', placeholder: '9XXXXXXXXX' },
    ];

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="text-4xl font-bold text-indigo-400 mb-1">🏛 CiviFlow</div>
                    <p className="text-slate-400 text-sm">Register as a Citizen</p>
                </div>
                <div className="bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-700">
                    <h2 className="text-xl font-semibold text-white mb-6">Create Account</h2>
                    {error && <div className="bg-red-900/50 border border-red-700 text-red-300 rounded-lg p-3 mb-4 text-sm">{error}</div>}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {fields.map(f => (
                            <div key={f.key}>
                                <label className="block text-sm text-slate-400 mb-1">{f.label}</label>
                                <input type={f.type} required={f.key !== 'phone'}
                                    value={(form as any)[f.key]} onChange={e => setForm(pf => ({ ...pf, [f.key]: e.target.value }))}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 text-sm"
                                    placeholder={f.placeholder} />
                            </div>
                        ))}
                        <button type="submit" disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2.5 font-semibold text-sm transition disabled:opacity-50">
                            {loading ? 'Registering…' : 'Register'}
                        </button>
                    </form>
                    <p className="text-center text-sm text-slate-400 mt-4">
                        Have an account? <Link href="/login" className="text-indigo-400 hover:underline">Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
