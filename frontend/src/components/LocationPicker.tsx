'use client';
import { useEffect, useRef, useState } from 'react';

interface LocationPickerProps {
    lat: number | string;
    lng: number | string;
    onChange: (lat: string, lng: string) => void;
}

export default function LocationPicker({ lat, lng, onChange }: LocationPickerProps) {
    const mapRef = useRef<any>(null);
    const markerRef = useRef<any>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const initMap = async () => {
            const L = (await import('leaflet')).default;

            if (!document.getElementById('leaflet-css')) {
                const link = document.createElement('link');
                link.id = 'leaflet-css';
                link.rel = 'stylesheet';
                link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                document.head.appendChild(link);
            }

            if (!mapContainerRef.current) return;
            if (mapRef.current) return;

            const initialLat = Number(lat) || 12.9716;
            const initialLng = Number(lng) || 77.5946;

            const map = L.map(mapContainerRef.current).setView([initialLat, initialLng], 14);
            mapRef.current = map;

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
            }).addTo(map);

            // Custom icon because default Leaflet icon paths sometimes break in Next.js
            const icon = L.icon({
                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });

            markerRef.current = L.marker([initialLat, initialLng], { draggable: true, icon }).addTo(map);

            markerRef.current.on('dragend', (e: any) => {
                const position = markerRef.current.getLatLng();
                onChange(position.lat.toFixed(6), position.lng.toFixed(6));
            });

            map.on('click', (e: any) => {
                markerRef.current.setLatLng(e.latlng);
                onChange(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6));
            });
        };

        initMap();

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    // Sync external lat/lng changes to marker
    useEffect(() => {
        if (markerRef.current && mapRef.current) {
            const newLat = Number(lat);
            const newLng = Number(lng);
            if (!isNaN(newLat) && !isNaN(newLng)) {
                markerRef.current.setLatLng([newLat, newLng]);
                mapRef.current.setView([newLat, newLng]);
            }
        }
    }, [lat, lng]);

    return (
        <div className="w-full h-64 border border-slate-300 rounded-lg overflow-hidden relative z-0">
            <div ref={mapContainerRef} className="w-full h-full" />
            <div className="absolute top-2 left-2 z-[400] bg-white px-2 py-1 rounded shadow text-xs font-semibold text-slate-700 pointer-events-none">
                Drag pin or click map to set location
            </div>
        </div>
    );
}
