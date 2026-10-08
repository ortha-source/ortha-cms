import type { ReactNode } from 'react';
import { Checkbox, Label } from '@orthacms/design-system';

type Props = {
    id: string;
    label: ReactNode;
    /** Id of the hint under the control. */
    describedBy: string;
    value: readonly string[];
    options: readonly string[];
    onChange: (value: string[] | undefined) => void;
};

/** A multiselect's default: the options ticked in a new entry. None ticked is no default. */
export function ManyDefault({
    id,
    label,
    describedBy,
    value,
    options,
    onChange
}: Props) {
    const toggle = (option: string, on: boolean) => {
        // Kept in the options' order, so the generated code does not depend on click order.
        const next = options.filter((candidate) =>
            candidate === option ? on : value.includes(candidate)
        );
        onChange(next.length ? next : undefined);
    };
    return (
        <fieldset
            className="flex flex-col gap-2"
            aria-describedby={describedBy}
        >
            <legend className="text-sm font-medium">{label}</legend>
            <div className="flex flex-wrap gap-4">
                {options.map((option, index) => (
                    <div key={option} className="flex items-center gap-2">
                        <Checkbox
                            id={`${id}-${index}`}
                            checked={value.includes(option)}
                            onCheckedChange={(on) =>
                                toggle(option, on === true)
                            }
                        />
                        <Label htmlFor={`${id}-${index}`} className="font-mono">
                            {option}
                        </Label>
                    </div>
                ))}
            </div>
        </fieldset>
    );
}
