import { Label, RadioGroupItem } from '@orthacms/design-system';

type Props = {
    value: string;
    /** The usual name: "Many-to-one". */
    label: string;
    /** The shorthand, this side first: "N → 1". */
    notation: string;
    /** What it means, said with both types' names. */
    description: string;
    /** A familiar case, and how it is stored. */
    example: string;
};

/**
 * One cardinality as a card: its usual name and shorthand, then what it
 * means between these two types, then a familiar case and how it is stored.
 * Clickable as a whole (it is the radio's label) and marked when chosen; the
 * radio's name stays the cardinality's name.
 */
export function CardinalityOption({
    value,
    label,
    notation,
    description,
    example
}: Props) {
    const id = `cardinality-${value}`;
    return (
        <Label
            htmlFor={id}
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 font-normal transition-colors hover:bg-accent/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
        >
            <RadioGroupItem
                id={id}
                value={value}
                className="mt-0.5"
                aria-labelledby={`${id}-label`}
                aria-describedby={`${id}-hint`}
            />
            <span className="flex min-w-0 flex-col gap-1.5">
                <span className="flex flex-wrap items-center gap-2">
                    <span
                        id={`${id}-label`}
                        className="text-sm font-medium leading-snug"
                    >
                        {label}
                    </span>
                    <span
                        aria-hidden
                        className="rounded border bg-muted/60 px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                    >
                        {notation}
                    </span>
                </span>
                <span id={`${id}-hint`} className="flex flex-col gap-1">
                    <span className="text-sm leading-snug">{description}</span>
                    <span className="text-xs leading-snug text-muted-foreground">
                        {example}
                    </span>
                </span>
            </span>
        </Label>
    );
}
