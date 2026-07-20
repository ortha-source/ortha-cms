import { defineMessages, useIntl } from 'react-intl';
import { Check } from 'lucide-react';
import {
    AVATAR_COLORS,
    avatarColorVar,
    cn,
    type AvatarColor
} from '@ortha-cms/design-system';

const messages = defineMessages({
    label: {
        id: 'workspaces.create.basics.colorLabel',
        defaultMessage: 'Avatar color'
    },
    swatch: {
        id: 'workspaces.create.basics.colorSwatch',
        defaultMessage: 'Use the {color} accent'
    }
});

/** Props for {@link ColorSwatchRow}. */
export type ColorSwatchRowProps = {
    /** Currently selected accent. */
    value: AvatarColor;
    /** Called when a swatch is chosen. */
    onChange: (color: AvatarColor) => void;
};

/**
 * The accent-color picker for the basics step: a single-select row of the
 * shared avatar palette, exposed as a radio group for keyboard + screen-reader
 * users. The selected swatch shows a check.
 */
export function ColorSwatchRow({ value, onChange }: ColorSwatchRowProps) {
    const intl = useIntl();
    const label = intl.formatMessage(messages.label);

    return (
        <div className="flex flex-col gap-2">
            <span className="text-sm font-medium leading-snug">{label}</span>
            <div
                role="radiogroup"
                aria-label={label}
                className="flex flex-wrap gap-2"
            >
                {AVATAR_COLORS.map((color) => {
                    const selected = value === color;
                    return (
                        <button
                            key={color}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-label={intl.formatMessage(messages.swatch, {
                                color
                            })}
                            onClick={() => onChange(color)}
                            className={cn(
                                'flex size-9 items-center justify-center rounded-xl text-white transition-colors',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                selected &&
                                    'ring-2 ring-ring ring-offset-2'
                            )}
                            style={{ backgroundColor: avatarColorVar(color) }}
                        >
                            {selected ? <Check className="size-4" /> : null}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
