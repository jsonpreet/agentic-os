import React, { useEffect, useState } from 'react';

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export const MenuBarClock: React.FC = () => {
  const [time, setTime] = useState(() => formatTime(new Date()));

  useEffect(() => {
    const tick = () => setTime(formatTime(new Date()));
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="text-[13px] font-medium menubar-text tabular-nums px-1">
      {time}
    </span>
  );
};
