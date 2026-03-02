'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { register, getWards } from '@/lib/api';
import Link from 'next/link';

type Role = 'CITIZEN' | 'WORKER' | 'SUPERVISOR';

const ROLES = [
    {
        id: 'CITIZEN' as Role,
        icon: '🏠',
        title: 'Citizen',
        desc: 'Report civic issues in your area. Instant access.',
        color: 'border-emerald-500 bg-emerald-500/10',
        badge: 'bg-emerald-500',
    },
    {
        id: 'WORKER' as Role,
        icon: '🔧',
        title: 'Field Worker',
        desc: 'Assigned to resolve issues on the ground. Requires Ward + Worker ID.',
        color: 'border-blue-500 bg-blue-500/10',
        badge: 'bg-blue-500',
    },
    {
        id: 'SUPERVISOR' as Role,
        icon: '📋',
        title: 'Supervisor',
        desc: 'Manage workers and oversee department issues. Requires Supervisor ID.',
        color: 'border-violet-500 bg-violet-500/10',
        badge: 'bg-violet-500',
    },
];

export default function RegisterPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [role, setRole] = useState<Role | null>(null);
    const [wards, setWards] = useState<any[]>([]);
    const [aadhaarVerified, setAadhaarVerified] = useState(false);
    const [aadhaarVerifying, setAadhaarVerifying] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [form, setForm] = useState({
        name: '', email: '', password: '', confirmPassword: '', phone: '',
        aadhaar_number: '',
        ward_id: '',
        worker_id_number: '',
        supervisor_id_number: '',
    });

    useEffect(() => {
        getWards().then(r => setWards(r.data?.wards || [])).catch(() => { });
    }, []);

    const set = (key: string, value: string) =>
        setForm(p => ({ ...p, [key]: value }));

    // ── Step navigation guards ────────────────────────────────────────────────
    const canProceedStep1 = !!role;
    const canProceedStep2 =
        form.name.trim().length >= 2 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
        form.password.length >= 8 &&
        form.password === form.confirmPassword;
    const canProceedStep3 = aadhaarVerified;
    const canProceedStep4 =
        role === 'CITIZEN' ? true :
            role === 'WORKER' ? (!!form.ward_id && /^WRK-[A-Z0-9]{4,10}$/i.test(form.worker_id_number)) :
                role === 'SUPERVISOR' ? (!!form.ward_id && /^SUP-[A-Z0-9]{4,10}$/i.test(form.supervisor_id_number)) :
                    false;

    // ── Mock Aadhaar verification ────────────────────────────────────────────
    const handleAadhaarVerify = () => {
        setError('');
        const clean = form.aadhaar_number.replace(/\s/g, '');
        if (!/^\d{12}$/.test(clean)) {
            setError('Aadhaar number must be exactly 12 digits.');
            return;
        }
        setAadhaarVerifying(true);
        setTimeout(() => {
            setAadhaarVerifying(false);
            setAadhaarVerified(true);
        }, 1500);
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        setLoading(true); setError('');
        try {
            await register({
                name: form.name.trim(),
                email: form.email.trim().toLowerCase(),
                password: form.password,
                role,
                phone: form.phone || undefined,
                ward_id: form.ward_id ? parseInt(form.ward_id) : undefined,
                aadhaar_number: form.aadhaar_number.replace(/\s/g, ''),
                worker_id_number: role === 'WORKER' ? form.worker_id_number.toUpperCase() : undefined,
                supervisor_id_number: role === 'SUPERVISOR' ? form.supervisor_id_number.toUpperCase() : undefined,
            });
            setStep(6); // success page
        } catch (err: any) {
            setError(err.response?.data?.error || 'Registration failed. Please try again.');
            setLoading(false);
        }
    };

    const totalSteps = role === 'CITIZEN' ? 4 : 5;

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4 py-12">
            <div className="max-w-lg w-full">

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="text-4xl font-bold text-indigo-400 mb-1">🏛 CiviFlow</div>
                    <p className="text-slate-400 text-sm">Create Your Account</p>
                </div>

                {/* Progress bar */}
                {step < 6 && (
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-slate-500">Step {step} of {totalSteps}</span>
                            <span className="text-xs text-slate-500 font-medium capitalize">{['', 'Choose Role', 'Basic Info', 'Aadhaar Verify', 'Credentials', 'Review'][step]}</span>
                        </div>
                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                                style={{ width: `${(step / totalSteps) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                <div className="bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-700">

                    {/* ── STEP 1: Choose Role ── */}
                    {step === 1 && (
                        <>
                            <h2 className="text-xl font-semibold text-white mb-2">Who are you?</h2>
                            <p className="text-slate-400 text-sm mb-6">Select your role to get started.</p>
                            <div className="grid gap-3">
                                {ROLES.map(r => (
                                    <button
                                        key={r.id}
                                        onClick={() => setRole(r.id)}
                                        className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left ${role === r.id ? r.color : 'border-slate-600 hover:border-slate-500'}`}
                                    >
                                        <span className="text-2xl mt-0.5">{r.icon}</span>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="font-semibold text-white text-sm">{r.title}</span>
                                                {(r.id === 'WORKER' || r.id === 'SUPERVISOR') && (
                                                    <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-semibold">Requires Admin Approval</span>
                                                )}
                                            </div>
                                            <p className="text-slate-400 text-xs">{r.desc}</p>
                                        </div>
                                        {role === r.id && <span className="text-xl mt-0.5">✓</span>}
                                    </button>
                                ))}
                            </div>
                            <div className="mt-6 flex flex-col gap-3">
                                <button
                                    onClick={() => { setStep(2); setError(''); }}
                                    disabled={!canProceedStep1}
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl py-3 font-semibold text-sm transition"
                                >Continue →</button>
                                <p className="text-center text-sm text-slate-400">
                                    Already have an account? <Link href="/login" className="text-indigo-400 hover:underline">Sign in</Link>
                                </p>
                            </div>
                        </>
                    )}

                    {/* ── STEP 2: Basic Info ── */}
                    {step === 2 && (
                        <>
                            <h2 className="text-xl font-semibold text-white mb-6">
                                {ROLES.find(r => r.id === role)?.icon} Basic Information
                            </h2>
                            {error && <div className="bg-red-900/50 border border-red-700 text-red-300 rounded-lg p-3 mb-4 text-sm">{error}</div>}
                            <div className="space-y-4">
                                {[
                                    { key: 'name', label: 'Full Name', type: 'text', placeholder: 'As per official records' },
                                    { key: 'email', label: 'Email Address', type: 'email', placeholder: 'you@example.com' },
                                    { key: 'phone', label: 'Phone (optional)', type: 'tel', placeholder: '9XXXXXXXXX' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="block text-sm text-slate-400 mb-1">{f.label}</label>
                                        <input type={f.type} value={(form as any)[f.key]}
                                            onChange={e => set(f.key, e.target.value)}
                                            placeholder={f.placeholder}
                                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm" />
                                    </div>
                                ))}
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Password</label>
                                    <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
                                        placeholder="Min 8 characters"
                                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Confirm Password</label>
                                    <input type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)}
                                        placeholder="Re-enter password"
                                        className={`w-full bg-slate-700 border rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none text-sm ${form.confirmPassword && form.password !== form.confirmPassword ? 'border-red-500 focus:border-red-500' : 'border-slate-600 focus:border-indigo-500'}`} />
                                    {form.confirmPassword && form.password !== form.confirmPassword && (
                                        <p className="text-red-400 text-xs mt-1">Passwords do not match.</p>
                                    )}
                                </div>
                            </div>
                            <div className="mt-6 flex gap-3">
                                <button onClick={() => setStep(1)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded-xl py-3 font-semibold text-sm transition">← Back</button>
                                <button onClick={() => { setError(''); setStep(3); }} disabled={!canProceedStep2}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl py-3 font-semibold text-sm transition">Continue →</button>
                            </div>
                        </>
                    )}

                    {/* ── STEP 3: Aadhaar Verification ── */}
                    {step === 3 && (
                        <>
                            <h2 className="text-xl font-semibold text-white mb-2">🪪 Aadhaar Verification</h2>
                            <p className="text-slate-400 text-sm mb-6">Your Aadhaar number is used to verify your identity. It is stored securely as a one-way hash and never shared.</p>
                            {error && <div className="bg-red-900/50 border border-red-700 text-red-300 rounded-lg p-3 mb-4 text-sm">{error}</div>}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Aadhaar Number</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            maxLength={12}
                                            value={form.aadhaar_number}
                                            onChange={e => {
                                                set('aadhaar_number', e.target.value.replace(/\D/g, ''));
                                                setAadhaarVerified(false);
                                            }}
                                            placeholder="12-digit Aadhaar number"
                                            disabled={aadhaarVerified}
                                            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm font-mono tracking-widest disabled:opacity-60"
                                        />
                                        <button
                                            onClick={handleAadhaarVerify}
                                            disabled={aadhaarVerified || aadhaarVerifying || form.aadhaar_number.length !== 12}
                                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-sm font-semibold transition whitespace-nowrap"
                                        >
                                            {aadhaarVerifying ? '...' : aadhaarVerified ? '✓ Verified' : 'Verify'}
                                        </button>
                                    </div>
                                </div>

                                {aadhaarVerified && (
                                    <div className="bg-emerald-900/40 border border-emerald-600 text-emerald-300 rounded-lg p-3 text-sm flex items-center gap-2">
                                        <span className="text-xl">✅</span>
                                        <div>
                                            <div className="font-semibold">Aadhaar Verified Successfully</div>
                                            <div className="text-xs opacity-70">Identity confirmed. You may proceed.</div>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-slate-700/50 rounded-lg p-3 text-xs text-slate-400">
                                    🔒 <strong className="text-slate-300">Privacy Notice:</strong> Your Aadhaar number is hashed using SHA-256 before storage. We only verify uniqueness — the actual number is never stored or accessible.
                                </div>
                            </div>
                            <div className="mt-6 flex gap-3">
                                <button onClick={() => setStep(2)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded-xl py-3 font-semibold text-sm transition">← Back</button>
                                <button
                                    onClick={() => { setError(''); role === 'CITIZEN' ? setStep(5) : setStep(4); }}
                                    disabled={!canProceedStep3}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl py-3 font-semibold text-sm transition">Continue →</button>
                            </div>
                        </>
                    )}

                    {/* ── STEP 4: Role-specific Credentials ── */}
                    {step === 4 && (
                        <>
                            <h2 className="text-xl font-semibold text-white mb-2">
                                {role === 'WORKER' ? '🔧 Worker Credentials' : '📋 Supervisor Credentials'}
                            </h2>
                            <p className="text-slate-400 text-sm mb-6">
                                {role === 'WORKER'
                                    ? 'Enter your official Worker ID and select your assigned ward.'
                                    : 'Enter your Supervisor Legal ID and select your assigned ward.'}
                            </p>
                            {error && <div className="bg-red-900/50 border border-red-700 text-red-300 rounded-lg p-3 mb-4 text-sm">{error}</div>}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">
                                        {role === 'WORKER' ? 'Worker ID Number' : 'Supervisor Legal ID'}
                                    </label>
                                    <input
                                        type="text"
                                        value={role === 'WORKER' ? form.worker_id_number : form.supervisor_id_number}
                                        onChange={e => set(role === 'WORKER' ? 'worker_id_number' : 'supervisor_id_number', e.target.value.toUpperCase())}
                                        placeholder={role === 'WORKER' ? 'e.g. WRK-A1234' : 'e.g. SUP-B5678'}
                                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm font-mono"
                                    />
                                    <p className="text-slate-500 text-xs mt-1">
                                        Format: {role === 'WORKER' ? 'WRK-XXXXX' : 'SUP-XXXXX'} (issued by your department)
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Assigned Ward</label>
                                    <select
                                        value={form.ward_id}
                                        onChange={e => set('ward_id', e.target.value)}
                                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm"
                                    >
                                        <option value="">— Select your ward —</option>
                                        {wards.map((w: any) => (
                                            <option key={w.id} value={w.id}>{w.name} ({w.city})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="bg-amber-900/30 border border-amber-600/50 rounded-lg p-3 text-xs text-amber-300">
                                    ⚠️ After submission, your account will be <strong>pending approval</strong> by the Admin of your ward. You will not be able to sign in until approved.
                                </div>
                            </div>
                            <div className="mt-6 flex gap-3">
                                <button onClick={() => setStep(3)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded-xl py-3 font-semibold text-sm transition">← Back</button>
                                <button onClick={() => { setError(''); setStep(5); }} disabled={!canProceedStep4}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl py-3 font-semibold text-sm transition">Review →</button>
                            </div>
                        </>
                    )}

                    {/* ── STEP 5: Review & Submit ── */}
                    {step === 5 && (
                        <>
                            <h2 className="text-xl font-semibold text-white mb-6">📝 Review & Submit</h2>
                            {error && <div className="bg-red-900/50 border border-red-700 text-red-300 rounded-lg p-3 mb-4 text-sm">{error}</div>}
                            <div className="bg-slate-700/50 rounded-xl p-4 space-y-3 text-sm mb-6">
                                {[
                                    { label: 'Role', value: ROLES.find(r => r.id === role)?.title + ' ' + ROLES.find(r => r.id === role)?.icon },
                                    { label: 'Full Name', value: form.name },
                                    { label: 'Email', value: form.email },
                                    { label: 'Phone', value: form.phone || '—' },
                                    { label: 'Aadhaar', value: '●●●● ●●●● ' + form.aadhaar_number.slice(-4) },
                                    ...(role === 'WORKER' ? [{ label: 'Worker ID', value: form.worker_id_number }] : []),
                                    ...(role === 'SUPERVISOR' ? [{ label: 'Supervisor ID', value: form.supervisor_id_number }] : []),
                                    ...(form.ward_id ? [{ label: 'Ward', value: wards.find(w => String(w.id) === form.ward_id)?.name || form.ward_id }] : []),
                                ].map(item => (
                                    <div key={item.label} className="flex justify-between gap-4">
                                        <span className="text-slate-400">{item.label}</span>
                                        <span className="text-white font-medium text-right">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setStep(role === 'CITIZEN' ? 3 : 4)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded-xl py-3 font-semibold text-sm transition">← Back</button>
                                <button onClick={handleSubmit} disabled={loading}
                                    className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white rounded-xl py-3 font-semibold text-sm transition">
                                    {loading ? 'Submitting…' : '🚀 Submit Registration'}
                                </button>
                            </div>
                        </>
                    )}

                    {/* ── STEP 6: Success ── */}
                    {step === 6 && (
                        <div className="text-center py-4">
                            <div className="text-5xl mb-4">{role === 'CITIZEN' ? '🎉' : '⏳'}</div>
                            <h2 className="text-xl font-semibold text-white mb-3">
                                {role === 'CITIZEN' ? 'Account Created!' : 'Registration Submitted!'}
                            </h2>
                            <p className="text-slate-400 text-sm mb-6">
                                {role === 'CITIZEN'
                                    ? 'Your account is ready. You can sign in now and start reporting issues.'
                                    : `Your ${role === 'WORKER' ? 'Worker' : 'Supervisor'} registration is pending approval from your ward Admin. You will be able to sign in once approved.`
                                }
                            </p>
                            {role !== 'CITIZEN' && (
                                <div className="bg-amber-900/30 border border-amber-600/50 rounded-lg p-3 text-xs text-amber-300 mb-6 text-left">
                                    📬 <strong>What happens next?</strong><br />
                                    Your ward Admin will review your credentials and approve or reject your registration. Check back or contact your supervisor to follow up.
                                </div>
                            )}
                            <Link href="/login"
                                className="inline-block w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 font-semibold text-sm transition text-center">
                                Go to Sign In →
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
