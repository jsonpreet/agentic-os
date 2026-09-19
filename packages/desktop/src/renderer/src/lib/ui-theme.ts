export type UiThemePreference = 'system' | 'light' | 'dark';
export type ResolvedUiTheme = 'light' | 'dark';

const STORAGE_KEY = 'agentic-ui-theme';
const DEFAULT_PREFERENCE: UiThemePreference = 'light';

export function getUiThemePreference(): UiThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'system' || stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {
    // ignore
  }
  return DEFAULT_PREFERENCE;
}

export function setUiThemePreference(preference: UiThemePreference): void {
  localStorage.setItem(STORAGE_KEY, preference);
  applyUiTheme(preference);
}

export function resolveUiTheme(preference: UiThemePreference): ResolvedUiTheme {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return preference;
}

export function applyUiTheme(preference: UiThemePreference): void {
  const resolved = resolveUiTheme(preference);
  document.documentElement.dataset.uiTheme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export function watchSystemTheme(onChange: () => void): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => onChange();
  media.addEventListener('change', handler);
  return () => media.removeEventListener('change', handler);
}
