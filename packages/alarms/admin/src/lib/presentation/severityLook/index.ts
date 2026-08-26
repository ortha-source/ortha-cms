import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import type { ComponentType } from 'react';
import { defineMessages, type MessageDescriptor } from 'react-intl';
import type { AlarmSeverity } from '../../types/alarm';

/**
 * How one severity looks and reads, in one place.
 *
 * Three surfaces render severity — the badge, the records column, and the
 * copilot's result strip — and they have to agree. More importantly they have
 * to agree about the **glyph**, for a reason that is measured rather than
 * aesthetic (see {@link SEVERITY_LOOK}).
 */
export interface SeverityLook {
    /** Tailwind classes for a tinted chip: border, background, ink. */
    chip: string;
    /** Ink-only class, for a glyph sitting on the page's own surface. */
    ink: string;
    /** The glyph. Distinct **shapes**, not three copies of one circle. */
    Icon: ComponentType<{ className?: string }>;
    /** The severity's name, for the label and the accessible text. */
    label: MessageDescriptor;
}

const labels = defineMessages({
    error: { id: 'alarms.severity.error', defaultMessage: 'Error' },
    warn: { id: 'alarms.severity.warn', defaultMessage: 'Warning' },
    info: { id: 'alarms.severity.info', defaultMessage: 'Info' }
});

/**
 * The look of each severity.
 *
 * **The glyphs differ because the colours cannot be relied on.** The design
 * system's status palette is the right source for these — they are statuses,
 * not a categorical series — but running the palette validator over the three
 * actually shipped values says:
 *
 * ```
 * destructive #d40c1a  warning #a06108  info #0267c7
 * CVD separation: worst adjacent #a06108↔#d40c1a ΔE 0.9 (deutan)
 * Normal-vision floor: ΔE 14.8 — below the 15 floor
 * ```
 *
 * Error and warning are a red and an orange at the same lightness: effectively
 * one colour to a red-green colourblind reader, and hard to separate even with
 * full colour vision. That is fine for a status *token* used one at a time —
 * which is what the design system sized it for — and not fine here, where all
 * three appear in one list and the reader is meant to tell them apart.
 *
 * So severity is carried by **shape first**: a filled circle-alert, a triangle,
 * and an `i`. Colour agrees with the shape rather than doing the work, and the
 * word is always present too (visibly on the chip, `sr-only` on a bare glyph).
 * Three redundant encodings, which is what WCAG 1.4.1 asks for and what makes
 * the strip readable at a glance rather than only on inspection.
 */
export const SEVERITY_LOOK: Record<AlarmSeverity, SeverityLook> = {
    error: {
        chip: 'border-destructive/30 bg-destructive-soft text-destructive-soft-foreground',
        ink: 'text-destructive-soft-foreground',
        Icon: CircleAlert,
        label: labels.error
    },
    warn: {
        chip: 'border-warning/30 bg-warning-soft text-warning-soft-foreground',
        ink: 'text-warning-soft-foreground',
        Icon: TriangleAlert,
        label: labels.warn
    },
    info: {
        chip: 'border-info/30 bg-info-soft text-info-soft-foreground',
        ink: 'text-info-soft-foreground',
        Icon: Info,
        label: labels.info
    }
};

/**
 * The look for a severity, falling back to `warn` for a value this build does
 * not know.
 *
 * Reachable: the column is text server-side so that adding a severity is not a
 * migration, and an admin running an older bundle can be handed a newer one.
 * Rendering the middle severity keeps the row visible and honest-ish; throwing
 * would take a whole list down for one row.
 */
export function severityLook(severity: string): SeverityLook {
    return SEVERITY_LOOK[severity as AlarmSeverity] ?? SEVERITY_LOOK.warn;
}
