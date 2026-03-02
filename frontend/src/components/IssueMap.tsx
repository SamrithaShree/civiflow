'use client';
import { useEffect, useRef, useState } from 'react';

interface Issue {
    id: number;
    ticket_id: string;
    lat: number;
    lng: number;
    category: string;
    status: string;
    priority_score: number;
    sla_breached: boolean;
    description: string;
    ward_name?: string;
}

interface IssueMapProps {
    issues: Issue[];
}

// Priority score → radius and color
const getStyle = (issue: Issue) => {
    const score = Number(issue.priority_score) || 5;
    const radius = Math.max(8, Math.min(30, score * 1.2));
    if (issue.sla_breached) return { color: '#dc2626', fill: '#ef4444', radius }; // red
    if (score > 30) return { color: '#ea580c', fill: '#f97316', radius };         // orange
    if (score > 15) return { color: '#ca8a04', fill: '#eab308', radius };         // yellow
    return { color: '#16a34a', fill: '#22c55e', radius };                          // green
};

export default function IssueMap({ issues }: IssueMapProps) {
    const mapRef = useRef<any>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const [viewMode, setViewMode] = useState<'markers' | 'heatmap'>('markers');
    const [heatmapPluginReady, setHeatmapPluginReady] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const loadScripts = async () => {
            // Inject Leaflet CSS if not already present
            if (!document.getElementById('leaflet-css')) {
                const link = document.createElement('link');
                link.id = 'leaflet-css';
                link.rel = 'stylesheet';
                link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                document.head.appendChild(link);
            }

            // Inject Leaflet Heat plugin
            if (!document.getElementById('leaflet-heat-js')) {
                const script = document.createElement('script');
                script.id = 'leaflet-heat-js';
                // Using a more reliable CDN
                script.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
                script.async = true;
                script.onload = () => {
                    console.log('✅ Leaflet Heat plugin script loaded');
                    setHeatmapPluginReady(true);
                };
                document.head.appendChild(script);
            } else {
                setHeatmapPluginReady(true);
            }
        };

        loadScripts();
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const initMap = async () => {
            const L = (await import('leaflet') as any).default;
            (window as any).L = L; // Important for some Leaflet plugins

            if (!mapContainerRef.current) return;

            // Destroy previous map instance if re-rendering
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }

            // Default center: Bangalore
            const center: [number, number] = issues.length > 0
                ? [
                    issues.reduce((s, i) => s + Number(i.lat), 0) / issues.length,
                    issues.reduce((s, i) => s + Number(i.lng), 0) / issues.length,
                ]
                : [12.9716, 77.5946];

            const map = L.map(mapContainerRef.current).setView(center, 13);
            mapRef.current = map;

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
            }).addTo(map);

            if (viewMode === 'markers') {
                for (const issue of issues) {
                    if (!issue.lat || !issue.lng) continue;
                    const style = getStyle(issue);

                    const marker = L.circleMarker([Number(issue.lat), Number(issue.lng)], {
                        radius: style.radius,
                        fillColor: style.fill,
                        color: style.color,
                        weight: 2,
                        opacity: 0.9,
                        fillOpacity: 0.7,
                    }).addTo(map);

                    marker.bindPopup(`
              <div style="min-width:180px;font-family:sans-serif">
                <div style="font-weight:700;color:#4338ca;font-size:13px">${issue.ticket_id}</div>
                <div style="font-size:12px;margin:4px 0">${issue.description.slice(0, 80)}${issue.description.length > 80 ? '…' : ''}</div>
                <div style="font-size:11px;color:#6b7280">
                  🏷️ ${issue.category} &nbsp;|&nbsp; ⚡ ${issue.status.replace('_', ' ')}<br/>
                  🔥 Priority: ${issue.priority_score}
                  ${issue.sla_breached ? '<br/><span style="color:#dc2626;font-weight:700">⚠️ SLA Breached</span>' : ''}
                  ${issue.ward_name ? `<br/>📍 ${issue.ward_name}` : ''}
                </div>
              </div>
            `);
                }
            } else {
                // Wait for plugin if not ready
                if (!heatmapPluginReady && !(L as any).heatLayer) {
                    console.warn('Heatmap plugin not yet available, retrying...');
                    return;
                }

                const heatPoints = issues
                    .filter(i => i.lat && i.lng)
                    .map(i => [Number(i.lat), Number(i.lng), 1.0]); // Max intensity for each point

                console.log(`Plotting ${heatPoints.length} heatmap points`);

                if ((L as any).heatLayer) {
                    (L as any).heatLayer(heatPoints, {
                        radius: 40,      // Significantly larger radius for overlapping "glow"
                        blur: 15,        // Less blur for more core color saturation
                        maxZoom: 17,
                        max: 0.6,        // Lower max means points reach 'hot' colors faster with less overlap
                        minOpacity: 0.4, // Ensure even single points are visible
                        gradient: {
                            0.2: '#3b82f6', // blue (low)
                            0.4: '#10b981', // green
                            0.6: '#eab308', // yellow
                            0.8: '#f97316', // orange
                            1.0: '#ef4444'  // dark red (high density)
                        }
                    }).addTo(map);
                } else {
                    console.error('L.heatLayer function not found even after plugin load!');
                }
            }
        };

        const timeoutId = setTimeout(initMap, 100); // Small delay to ensure script execution if needed

        return () => {
            clearTimeout(timeoutId);
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [issues, viewMode, heatmapPluginReady]);

    return (
        <div style={{ position: 'relative', height: '100%', width: '100%' }}>
            <div
                ref={mapContainerRef}
                style={{ height: '100%', width: '100%', minHeight: 400 }}
                className="z-0"
            />
            {/* View Mode Toggle */}
            <div className="absolute top-4 right-4 z-[1000] flex bg-white/95 backdrop-blur-md p-1.5 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.15)] border border-indigo-100 items-center gap-1 transition-all duration-300">
                <button
                    onClick={() => setViewMode('markers')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-300 flex items-center gap-2 ${viewMode === 'markers'
                            ? 'bg-indigo-600 text-white shadow-md transform scale-105'
                            : 'text-indigo-600 hover:bg-indigo-50'
                        }`}
                >
                    <span className="text-sm">📍</span> Markers
                </button>
                <button
                    onClick={() => setViewMode('heatmap')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-300 flex items-center gap-2 ${viewMode === 'heatmap'
                            ? 'bg-indigo-600 text-white shadow-md transform scale-105'
                            : 'text-indigo-600 hover:bg-indigo-50'
                        }`}
                >
                    <span className="text-sm">🔥</span> Heatmap
                </button>
            </div>

            {/* Legend for Heatmap */}
            {viewMode === 'heatmap' && (
                <div className="absolute bottom-6 right-4 z-[1000] bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-xl border border-indigo-100 min-w-[160px]">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 pb-1 border-b border-slate-100">Regional Intensity</div>
                    <div className="flex flex-col gap-2.5">
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-md bg-gradient-to-br from-[#ef4444] to-[#f97316] shadow-sm"></div>
                            <span className="text-xs text-slate-700 font-bold">Critical Cluster</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-md bg-[#eab308] shadow-sm"></div>
                            <span className="text-xs text-slate-700 font-semibold">High Activity</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-md bg-[#10b981] shadow-sm"></div>
                            <span className="text-xs text-slate-700 font-medium">Moderate</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-md bg-[#3b82f6] shadow-sm"></div>
                            <span className="text-xs text-slate-700 font-medium">Low / Isolated</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
