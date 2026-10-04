import { Label, RadioGroupItem } from '@orthacms/design-system';

type Props = { value: string; label: string; description: string };

/**
 * One answer to "how many on each side", said as a sentence — a card with
 * room around it, clickable as a whole (it is the radio's label), and marked
 * when chosen.
 */
export function CardinalityOption({ value, label, description }: Props) {
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
                // The card is the click target; the name is the title alone.
                aria-labelledby={`${id}-label`}
                aria-describedby={`${id}-hint`}
            />
            <span className="flex flex-col gap-1">
                <span
                    id={`${id}-label`}
                    className="text-sm font-medium leading-snug"
                >
                    {label}
                </span>
                <span
                    id={`${id}-hint`}
                    className="text-sm leading-snug text-muted-foreground"
                >
                    {description}
                </span>
            </span>
        </Label>
    );
}
