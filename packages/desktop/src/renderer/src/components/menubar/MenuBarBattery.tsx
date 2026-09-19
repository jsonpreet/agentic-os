import React, { useEffect, useState } from 'react';
import { Battery, BatteryCharging } from 'lucide-react';

interface BatteryState {
  level: number;
  charging: boolean;
}

export const MenuBarBattery: React.FC = () => {
  const [battery, setBattery] = useState<BatteryState | null>(null);

  useEffect(() => {
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<{
        level: number;
        charging: boolean;
        addEventListener: (type: string, listener: () => void) => void;
        removeEventListener: (type: string, listener: () => void) => void;
      }>;
    };

    if (!nav.getBattery) return;

    let manager: Awaited<ReturnType<NonNullable<typeof nav.getBattery>>> | null = null;

    const sync = () => {
      if (!manager) return;
      setBattery({ level: manager.level, charging: manager.charging });
    };

    nav.getBattery().then((bat) => {
      manager = bat;
      sync();
      bat.addEventListener('levelchange', sync);
      bat.addEventListener('chargingchange', sync);
    });

    return () => {
      manager?.removeEventListener('levelchange', sync);
      manager?.removeEventListener('chargingchange', sync);
    };
  }, []);

  if (!battery) return null;

  const pct = Math.round(battery.level * 100);
  const Icon = battery.charging ? BatteryCharging : Battery;

  return (
    <span
      className="flex items-center gap-0.5 menubar-text px-1"
      title={`Battery ${pct}%${battery.charging ? ' (charging)' : ''}`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="text-[10px] tabular-nums">{pct}%</span>
    </span>
  );
};
