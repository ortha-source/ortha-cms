/**
 * Derives a stable, pleasant two-stop CSS gradient from an asset id. Used as a
 * self-contained stand-in thumbnail so the mockup needs no real image files or
 * network — the same id always yields the same gradient, so tiles stay stable
 * across renders. Presentation-only.
 */
export function assetGradient(id: string): string {
    // A small FNV-ish hash so the hue is deterministic per id.
    let hash = 0;
    for (let i = 0; i < id.length; i += 1) {
        hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    }
    const hue = hash % 360;
    const hue2 = (hue + 40) % 360;
    return `linear-gradient(135deg, hsl(${hue} 70% 62%), hsl(${hue2} 68% 48%))`;
}
