/**
 * A colour role in the Insights palette. Roles, not colours — a widget asks for
 * "the second series" or "the fourth step of the ramp", and the theme decides
 * what that looks like on the surface it lands on.
 *
 * Two families, and they are not interchangeable:
 *
 * - `series-1` / `series-2` are **categorical**: two things that differ in kind
 *   (published vs draft, input vs output tokens). There are exactly two,
 *   because two is how many hues clear colourblind separation against both the
 *   light and the dark card. A widget that needs a third category needs a
 *   different chart, not a third colour.
 * - `q0`…`q5` are a **sequential ramp**: one thing that differs in amount
 *   (older, busier, fuller). Never use a ramp step to distinguish categories —
 *   readers will infer an ordering that isn't there.
 */
export type ChartTone =
    | 'series-1'
    | 'series-2'
    | 'q0'
    | 'q1'
    | 'q2'
    | 'q3'
    | 'q4'
    | 'q5';

/**
 * Background utility per tone.
 *
 * Written out as whole literal class names rather than composed
 * (`` `bg-chart-${tone}` ``) because Tailwind scans source text: an interpolated
 * class name is never emitted, and the bars would silently render transparent.
 */
const TONE_BACKGROUND: Record<ChartTone, string> = {
    'series-1': 'bg-chart-1',
    'series-2': 'bg-chart-2',
    q0: 'bg-chart-q0',
    q1: 'bg-chart-q1',
    q2: 'bg-chart-q2',
    q3: 'bg-chart-q3',
    q4: 'bg-chart-q4',
    q5: 'bg-chart-q5'
};

/** The Tailwind background utility for a tone. */
export function toneBackground(tone: ChartTone): string {
    return TONE_BACKGROUND[tone];
}

/** The sequential ramp, low → high, for iterating a legend or a scale. */
export const SEQUENTIAL_TONES: readonly ChartTone[] = [
    'q0',
    'q1',
    'q2',
    'q3',
    'q4',
    'q5'
];

/**
 * Maps a 0–1 intensity onto a ramp step.
 *
 * Zero is pinned to `q0` — the step that sits nearest the card surface — so
 * "none" recedes instead of reading as a small amount of something. The
 * remaining steps split the range evenly.
 */
export function toneForIntensity(intensity: number): ChartTone {
    if (!Number.isFinite(intensity) || intensity <= 0) return 'q0';
    if (intensity < 0.2) return 'q1';
    if (intensity < 0.45) return 'q2';
    if (intensity < 0.7) return 'q3';
    if (intensity < 0.9) return 'q4';
    return 'q5';
}

/**
 * Text colour for a label sitting **on** a ramp step.
 *
 * The deep end of the ramp swaps lightness between themes — dark blue on the
 * light card, bright blue on the dark one — so a fixed ink would be unreadable
 * in one of them. `chart-on-deep` is the token that flips with it.
 */
export function toneInk(tone: ChartTone): string {
    return tone === 'q4' || tone === 'q5'
        ? 'text-chart-on-deep'
        : 'text-foreground';
}
