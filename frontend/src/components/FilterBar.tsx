'use client';
import { useState } from 'react';
import { getWards } from '@/lib/api';

const CATEGORIES = ['', 'ROAD', 'WATER', 'SANITATION', 'ELECTRICITY', 'DRAINAGE', 'PARK', 'STREETLIGHT', 'NOISE', 'OTHER'];
const STATUSES = ['', 'NEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'PENDING_VERIFICATION', 'CLOSED', 'REOPENED'];

interface FilterBarProps {
    onFilter: (params: Record<string, string>) => void;
    showWardFilter?: boolean;
}

export default function FilterBar({ onFilter, showWardFilter = false }: FilterBarProps) {
    const [filters, setFilters] = useState({
        search: '', status: '', category: '', sla_breached: '', ward_id: '',
    });

    const handleChange = (field: string, value: string) => {
        const next = { ...filters, [field]: value };
        setFilters(next);
        // Strip empty strings before sending
        const clean: Record<string, string> = {};
        Object.entries(next).forEach(([k, v]) => { if (v) clean[k] = v; });
        onFilter(clean);
    };

    const handleReset = () => {
        setFilters({ search: '', status: '', category: '', sla_breached: '', ward_id: '' });
        onFilter({});
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2 shadow-sm">
            {/* Search */}
            <div className="flex-1 min-w-[180px]">
                <input
                    value={filters.search}
                    onChange={e => handleChange('search', e.target.value)}
                    placeholder="🔍 Search by description or ticket ID…"
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                />
            </div>

            {/* Category */}
            <select value={filters.category} onChange={e => handleChange('category', e.target.value)}
                className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-indigo-500">
                <option value="">All Categories</option>
                {CATEGORIES.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Status */}
            <select value={filters.status} onChange={e => handleChange('status', e.target.value)}
                className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-indigo-500">
                <option value="">All Statuses</option>
                {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>

            {/* SLA Breached toggle */}
            <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer select-none">
                <input type="checkbox" checked={filters.sla_breached === 'true'}
                    onChange={e => handleChange('sla_breached', e.target.checked ? 'true' : '')}
                    className="rounded accent-red-600" />
                SLA Breached
            </label>

            {/* Ward filter (admin only) */}
            {showWardFilter && (
                <input
                    type="number"
                    value={filters.ward_id}
                    onChange={e => handleChange('ward_id', e.target.value)}
                    placeholder="Ward ID"
                    className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                />
            )}

            {/* Reset */}
            {Object.values(filters).some(Boolean) && (
                <button onClick={handleReset} className="text-xs text-slate-500 hover:text-slate-800 underline ml-1">
                    Clear
                </button>
            )}
        </div>
    );
}
