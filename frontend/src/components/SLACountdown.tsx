'use client';

import { useEffect, useState } from 'react';

interface SLACountdownProps {
    deadline: string;
}

export default function SLACountdown({ deadline }: SLACountdownProps) {
    const [timeLeft, setTimeLeft] = useState('');
    const [breached, setBreached] = useState(false);

    useEffect(() => {
        const update = () => {
            const now = Date.now();
            const end = new Date(deadline).getTime();
            const diff = end - now;

            if (diff <= 0) {
                setBreached(true);
                const overby = Math.abs(diff);
                const h = Math.floor(overby / 3600000);
                const m = Math.floor((overby % 3600000) / 60000);
                setTimeLeft(`Overdue by ${h}h ${m}m`);
            } else {
                setBreached(false);
                const h = Math.floor(diff / 3600000);
                const m = Math.floor((diff % 3600000) / 60000);
                setTimeLeft(`${h}h ${m}m remaining`);
            }
        };
        update();
        const id = setInterval(update, 60000);
        return () => clearInterval(id);
    }, [deadline]);

    return (
        <span className={`inline-flex items-center gap-1 text-sm font-medium ${breached ? 'text-red-600' : 'text-green-600'}`}>
            <span className={`w-2 h-2 rounded-full ${breached ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
            {timeLeft}
        </span>
    );
}
