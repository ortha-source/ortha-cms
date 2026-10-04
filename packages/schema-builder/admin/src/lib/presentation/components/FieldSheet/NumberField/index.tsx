import type { ReactNode } from 'react';
import { InputField } from '@orthacms/design-system';

type Props = {
    id: string;
    label: ReactNode;
    value: number | undefined;
    onChange: (value: number | undefined) => void;
    step?: number;
};

/** A number input whose empty state means "not set", so clearing it drops the rule. */
export function NumberField({ id, label, value, onChange, step }: Props) {
    return (
        <InputField
            id={id}
            type="number"
            inputMode="decimal"
            step={step}
            label={label}
            value={value ?? ''}
            onChange={(event) =>
                onChange(
                    event.target.value === ''
                        ? undefined
                        : Number(event.target.value)
                )
            }
        />
    );
}
