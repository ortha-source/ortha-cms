/**
 * Formats a byte count as a short human-readable size (e.g. `1.4 MB`). Uses
 * binary units and trims a trailing `.0`. Presentation-only — safe for labels.
 */
export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    const rounded =
        value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
    return `${rounded} ${units[unit]}`;
}
