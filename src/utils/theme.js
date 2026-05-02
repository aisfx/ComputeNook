export const THEMES = [
    { value: 'light', label: '浅色', icon: '☀️' },
    { value: 'dark', label: '深色', icon: '🌙' },
    { value: 'ocean', label: '深海', icon: '🌊' },
];
export function getStoredTheme() {
    const saved = localStorage.getItem('theme');
    if (saved && ['light', 'dark', 'ocean'].includes(saved))
        return saved;
    return 'dark';
}
export function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}
export function cycleTheme(current) {
    const idx = THEMES.findIndex(t => t.value === current);
    return THEMES[(idx + 1) % THEMES.length].value;
}
