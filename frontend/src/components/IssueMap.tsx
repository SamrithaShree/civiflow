'use client';
import { useEffect, useRef } from 'react';

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

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const initMap = async () => {
            const L = (await import('leaflet')).default;

            // Inject Leaflet CSS if not already present
            if (!document.getElementById('leaflet-css')) {
                const link = document.createElement('link');
                link.id = 'leaflet-css';
                link.rel = 'stylesheet';
                link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                document.head.appendChild(link);
            }

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
        };

        initMap();

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [issues]);

    return (
        <div ref={mapContainerRef} style={{ height: '100%', width: '100%', minHeight: 400 }} />
    );
}
