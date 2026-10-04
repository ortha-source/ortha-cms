import { Label, RadioGroupItem } from '@orthacms/design-system';

type Props = { value: string; label: string; description: string };

/** One answer to "how many on each side", said as a sentence. */
export function CardinalityOption({ value, label, description }: Props) {
    const id = `cardinality-${value}`;
    return (
        <div className="flex items-start gap-2">
            <RadioGroupItem
                id={id}
                value={value}
                className="mt-0.5"
                aria-describedby={`${id}-hint`}
            />
            <div className="flex flex-col">
                <Label htmlFor={id}>{label}</Label>
                <span
                    id={`${id}-hint`}
                    className="text-xs text-muted-foreground"
                >
                    {description}
                </span>
            </div>
        </div>
    );
}
