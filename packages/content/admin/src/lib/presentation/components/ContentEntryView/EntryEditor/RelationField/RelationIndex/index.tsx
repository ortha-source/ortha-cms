/**
 * The leading position chip for an ordered many-relation row — a zero-padded,
 * 1-based index (`01`, `02`, …) rendered in a muted mono numeral, mirroring the
 * Relations mockup. Purely decorative (`aria-hidden`): the row's reorder
 * controls carry the accessible ordering affordance.
 */
export function RelationIndex({ position }: { position: number }) {
    return (
        <span
            aria-hidden
            className="w-6 shrink-0 text-center font-mono text-xs tabular-nums text-muted-foreground"
        >
            {String(position + 1).padStart(2, '0')}
        </span>
    );
}
