import type { ReactNode } from 'react';
import {
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@orthacms/design-system';

/** Radix refuses `''` as an item value, so "no default" needs a token of its own. */
const NONE = '__none__';

type Props = {
    id: string;
    label: ReactNode;
    noneLabel: ReactNode;
    /** Id of the hint under the control. */
    describedBy: string;
    value: string | undefined;
    choices: readonly { value: string; label: ReactNode }[];
    onChange: (value: string | undefined) => void;
};

/** A default picked from a closed list, with "no default" first. */
export function OneOfDefault({
    id,
    label,
    noneLabel,
    describedBy,
    value,
    choices,
    onChange
}: Props) {
    return (
        <div className="flex flex-col gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Select
                value={value ?? NONE}
                onValueChange={(next) =>
                    onChange(next === NONE ? undefined : next)
                }
            >
                <SelectTrigger id={id} aria-describedby={describedBy}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={NONE}>{noneLabel}</SelectItem>
                    {choices.map((choice) => (
                        <SelectItem key={choice.value} value={choice.value}>
                            {choice.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
