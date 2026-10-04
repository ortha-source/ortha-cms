import type { ReactNode } from 'react';
import { Label, Switch } from '@orthacms/design-system';

type Props = {
    id: string;
    label: ReactNode;
    description?: ReactNode;
    checked: boolean;
    disabled?: boolean;
    onChange: (checked: boolean) => void;
};

/** A labelled switch with an optional line under it — the sheet's one boolean control. */
export function SwitchField({
    id,
    label,
    description,
    checked,
    disabled,
    onChange
}: Props) {
    return (
        <div className="flex items-start gap-3">
            <Switch
                id={id}
                checked={checked}
                disabled={disabled}
                onCheckedChange={onChange}
                aria-describedby={description ? `${id}-hint` : undefined}
            />
            <div className="flex flex-col gap-0.5">
                <Label htmlFor={id}>{label}</Label>
                {description && (
                    <p
                        id={`${id}-hint`}
                        className="text-xs text-muted-foreground"
                    >
                        {description}
                    </p>
                )}
            </div>
        </div>
    );
}
