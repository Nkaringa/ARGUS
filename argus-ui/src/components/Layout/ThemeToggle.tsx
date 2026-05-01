import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'argus-theme';

// Initial theme from localStorage; default dark when nothing's saved.
// Read synchronously at module load so the first render matches the saved state
// (avoids a dark→light flash for users on light theme).
function getInitial(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    root.removeAttribute('data-theme');
  }
}

// Apply once at module evaluation to avoid the dark→light flash. The component
// re-applies on toggle and keeps localStorage in sync.
applyTheme(getInitial());

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitial);

  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* storage unavailable */ }
  }, [theme]);

  const flip = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      onClick={flip}
      aria-label="Toggle light / dark theme"
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '12px 18px',
        fontSize: 11,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'var(--ink-dim)',
        cursor: 'pointer',
        borderBottom: '1px solid var(--rule)',
        transition: 'color 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-dim)')}
    >
      <span style={{ color: 'var(--ink-dimmer)', marginRight: 6 }}>
        {isLight ? '☀' : '☾'}
      </span>
      {isLight ? 'light' : 'dark'} theme
    </button>
  );
}
