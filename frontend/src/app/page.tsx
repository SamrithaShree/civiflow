'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('civiflow_user') || 'null') : null;
    if (!user) { router.push('/login'); return; }
    const routes: Record<string, string> = { CITIZEN: '/citizen', WORKER: '/worker', SUPERVISOR: '/supervisor', ADMIN: '/admin' };
    router.push(routes[user.role] || '/login');
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900">
      <div className="text-center text-white">
        <div className="text-4xl font-bold text-indigo-400 mb-2">CiviFlow</div>
        <p className="text-slate-400">Redirecting to your dashboard…</p>
      </div>
    </div>
  );
}
