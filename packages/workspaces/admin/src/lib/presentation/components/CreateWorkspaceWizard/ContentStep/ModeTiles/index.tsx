import { defineMessages, useIntl } from 'react-intl';
import { cn, RadioGroup, RadioGroupItem } from '@orthacms/design-system';
import type { ContentMode } from '../../../../../domain/types/wizard';

const messages = defineMessages({
    groupLabel: {
        id: 'workspaces.create.content.modeLabel',
        defaultMessage: 'What can people write here?'
    },
    allTitle: {
        id: 'workspaces.create.content.everythingTitle',
        defaultMessage: 'Everything'
    },
    allDescription: {
        id: 'workspaces.create.content.everythingDescription',
        defaultMessage:
            '{count, plural, one {The # content type} other {All # content types}} this site defines.'
    },
    specificTitle: {
        id: 'workspaces.create.content.pickTitle',
        defaultMessage: 'Pick content types'
    },
    specificDescription: {
        id: 'workspaces.create.content.pickDescription',
        defaultMessage: 'Only what this team writes.'
    }
});

/** Props for {@link ModeTiles}. */
export type ModeTilesProps = {
    /** Current content mode. */
    value: ContentMode;
    /** Called when a tile is chosen. */
    onChange: (mode: ContentMode) => void;
    /** How many content types "Everything" grants. */
    total: number;
};

/**
 * The two answers first: "Everything" (the quick path — every content type
 * the site defines, as this workspace's own) or "Pick content types", which
 * opens the one list below.
 */
export function ModeTiles({ value, onChange, total }: ModeTilesProps) {
    const intl = useIntl();
    const tiles: {
        value: ContentMode;
        title: string;
        description: string;
    }[] = [
        {
            value: 'all',
            title: intl.formatMessage(messages.allTitle),
            description: intl.formatMessage(messages.allDescription, {
                count: total
            })
        },
        {
            value: 'specific',
            title: intl.formatMessage(messages.specificTitle),
            description: intl.formatMessage(messages.specificDescription)
        }
    ];

    return (
        <RadioGroup
            value={value}
            onValueChange={(next) => onChange(next as ContentMode)}
            aria-label={intl.formatMessage(messages.groupLabel)}
            className="grid gap-2.5 sm:grid-cols-2"
        >
            {tiles.map((tile) => {
                const selected = value === tile.value;
                return (
                    <label
                        key={tile.value}
                        className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors',
                            selected
                                ? 'border-foreground ring-1 ring-foreground'
                                : 'hover:bg-accent'
                        )}
                    >
                        <RadioGroupItem
                            value={tile.value}
                            className="mt-0.5"
                            aria-label={tile.title}
                        />
                        <span className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium">
                                {tile.title}
                            </span>
                            <span className="text-[13px] text-muted-foreground">
                                {tile.description}
                            </span>
                        </span>
                    </label>
                );
            })}
        </RadioGroup>
    );
}
