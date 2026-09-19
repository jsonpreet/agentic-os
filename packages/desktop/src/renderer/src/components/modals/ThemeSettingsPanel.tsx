import React from 'react';
import { UiThemePreference } from '../../lib/ui-theme.js';

interface ThemeSettingsPanelProps {
  preference: UiThemePreference;
  onChange: (preference: UiThemePreference) => void;
}

const OPTIONS: Array<{
  id: UiThemePreference;
  label: string;
}> = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' }
];

const ThemePreview: React.FC<{ id: UiThemePreference; selected: boolean }> = ({
  id,
  selected
}) => {
  const light = id === 'light' || id === 'system';
  const split = id === 'system';

  return (
    <div
      className={`relative h-[72px] w-full overflow-hidden rounded-lg border ${
        selected ? 'border-primary' : 'border-[var(--glass-border)]'
      }`}
    >
      <div className="absolute inset-0 flex">
        <div
          className="h-full"
          style={{
            width: split ? '50%' : '100%',
            background: light ? '#f4f4f6' : '#1c1c1e'
          }}
        >
          <div
            className="h-3 mx-1.5 mt-1.5 rounded-sm"
            style={{ background: light ? '#ffffff' : '#2c2c2e' }}
          />
          <div
            className="h-8 mx-1.5 mt-1 rounded-sm"
            style={{ background: light ? '#ffffff' : '#2c2c2e' }}
          />
        </div>
        {split && (
          <div className="h-full w-1/2" style={{ background: '#1c1c1e' }}>
            <div className="h-3 mx-1.5 mt-1.5 rounded-sm" style={{ background: '#2c2c2e' }} />
            <div className="h-8 mx-1.5 mt-1 rounded-sm" style={{ background: '#2c2c2e' }} />
          </div>
        )}
      </div>
    </div>
  );
};

export const ThemeSettingsPanel: React.FC<ThemeSettingsPanelProps> = ({
  preference,
  onChange
}) => (
  <div className="grid grid-cols-3 gap-3">
    {OPTIONS.map(({ id, label }) => {
      const selected = preference === id;
      return (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className="flex flex-col gap-2 text-left group"
        >
          <ThemePreview id={id} selected={selected} />
          <span
            className={`text-[11px] font-medium ${
              selected ? 'text-primary' : 'text-[var(--glass-text-muted)] group-hover:text-[var(--glass-text)]'
            }`}
          >
            {label}
          </span>
        </button>
      );
    })}
  </div>
);
