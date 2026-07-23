/**
 * Formats a duration in seconds as `m:ss` (or `h:mm:ss` past an hour), for the
 * playback length shown on audio/video assets. Presentation-only.
 */
export function formatDuration(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return hrs > 0
        ? `${hrs}:${pad(mins)}:${pad(secs)}`
        : `${mins}:${pad(secs)}`;
}
