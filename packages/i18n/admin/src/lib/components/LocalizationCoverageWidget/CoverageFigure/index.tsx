import { useIntl } from 'react-intl';

/** Props for {@link CoverageFigure}. */
export type CoverageFigureProps = {
    /** The count. Formatted here so every figure reads the same way. */
    value: number;
    /** What is being counted. */
    label: string;
    /** A short qualifier under the label — what "localized" actually means. */
    hint: string;
};

/**
 * One of the coverage widget's headline counts.
 *
 * The hint is the load-bearing part. "Localized: 38" invites a reader to
 * subtract it from the total and call the rest untranslated, which is wrong —
 * the three figures overlap. Saying "in every language" / "no translations
 * started" / "missing at least one" on the tile is what makes them read as
 * three questions rather than three slices.
 */
export function CoverageFigure({ value, label, hint }: CoverageFigureProps) {
    const intl = useIntl();

    return (
        <div className="min-w-0">
            <div className="text-2xl font-semibold tracking-[-0.02em] tabular-nums">
                {intl.formatNumber(value)}
            </div>
            <div className="truncate text-xs font-medium">{label}</div>
            <div className="truncate text-[11px] text-muted-foreground">
                {hint}
            </div>
        </div>
    );
}
