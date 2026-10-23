import { Label, RadioGroup, RadioGroupItem, cn } from '@orthacms/design-system';

/** Everything (including what is added later), or an enumerated set. */
export type Scope = 'all' | 'some';

type ScopeChoiceProps = {
    /** Prefix for the radios' ids. */
    id: string;
    /** The question, as the group's accessible name. */
    label: string;
    value: Scope;
    onChange: (next: Scope) => void;
    allLabel: string;
    allHint: string;
    someLabel: string;
    someHint: string;
};

/**
 * One filter's "everything, or only these?" as two option cards — the radio
 * and its sentence in one target. "All" is how the server spells "including
 * what does not exist yet", so it is a choice of its own, never an empty
 * picker (decision 2 in the package AGENTS).
 */
export function ScopeChoice({
    id,
    label,
    value,
    onChange,
    allLabel,
    allHint,
    someLabel,
    someHint
}: ScopeChoiceProps) {
    const options: { value: Scope; title: string; hint: string }[] = [
        { value: 'all', title: allLabel, hint: allHint },
        { value: 'some', title: someLabel, hint: someHint }
    ];
    return (
        <RadioGroup
            aria-label={label}
            value={value}
            onValueChange={(next) => onChange(next as Scope)}
            className="grid gap-2.5 sm:grid-cols-2"
        >
            {options.map((option) => (
                <Label
                    key={option.value}
                    htmlFor={`${id}-${option.value}`}
                    className={cn(
                        'flex cursor-pointer items-start gap-2.5 rounded-[10px] border p-3 font-normal transition-colors hover:bg-muted/40',
                        value === option.value &&
                            'border-foreground/40 bg-muted/40'
                    )}
                >
                    <RadioGroupItem
                        id={`${id}-${option.value}`}
                        value={option.value}
                        className="mt-0.5"
                    />
                    <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">
                            {option.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {option.hint}
                        </span>
                    </span>
                </Label>
            ))}
        </RadioGroup>
    );
}
