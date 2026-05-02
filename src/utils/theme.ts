export type Theme = 'light' | 'dark' | 'ocean'

export const THEMES: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: '浅色', icon: '☀️' },
  { value: 'dark',  label: '深色', icon: '🌙' },
  { value: 'ocean', label: '深海', icon: '🌊' },
]

export function getStoredTheme(): Theme {
  const saved = localStorage.getItem('theme') as Theme | null
  if (saved && ['light', 'dark', 'ocean'].includes(saved)) return saved
  return 'dark'
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme)
}

export function cycleTheme(current: Theme): Theme {
  const idx = THEMES.findIndex(t => t.value === current)
  return THEMES[(idx + 1) % THEMES.length].value
}
