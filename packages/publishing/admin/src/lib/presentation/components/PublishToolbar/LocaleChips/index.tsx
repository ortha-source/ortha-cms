import { defineMessages, useIntl } from 'react-intl';
import { Checkbox, cn } from '@orthacms/design-system';
import {
    axisState,
    checkedOf,
    isOption,
    PICK_STATE,
    type Picks
} from '../../../../domain/publishPicks';
import type { PublishAxis, PublishRecord } from '../../../../domain/types';

const messages = defineMessages({
    group: { id: 'publishing.locales.group', defaultMessage: 'Locales' },
    toggle: {
        id: 'publishing.axis.toggle',
        defaultMessage: 'Publish {axis} for every record'
    }
});

/**
 * One chip per locale that has **something to publish** in the set — never
 * the whole configured list: a locale with nothing pending is not a decision,
 * and twenty idle chips were the noise this replaced. A chip picks or clears
 * that locale for every record at once and says how many records it covers.
 */
export function LocaleChips({
    axes,
    records,
    picks,
    disabled,
    onToggle
}: {
    axes: readonly PublishAxis[];
    records: readonly PublishRecord[];
    picks: Picks;
    disabled: boolean;
    onToggle: (axis: string, on: boolean) => void;
}) {
    const intl = useIntl();
    const live = axes
        .map((axis) => ({
            axis,
            count: records.filter((record) => isOption(record, axis.key)).length
        }))
        .filter(({ count }) => count > 0);
    if (live.length === 0) return null;
    return (
        <div
            role="group"
            aria-label={intl.formatMessage(messages.group)}
            className="flex flex-wrap items-center gap-1.5"
        >
            {live.map(({ axis, count }) => {
                const state = axisState(picks, records, axis.key);
                return (
                    <label
                        key={axis.key}
                        title={axis.label}
                        className={cn(
                            'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-xs',
                            state === PICK_STATE.None && 'text-muted-foreground'
                        )}
                    >
                        <Checkbox
                            checked={checkedOf(state)}
                            disabled={disabled}
                            onCheckedChange={() =>
                                onToggle(axis.key, state !== PICK_STATE.All)
                            }
                            aria-label={intl.formatMessage(messages.toggle, {
                                axis: axis.label
                            })}
                        />
                        <span className="font-mono uppercase">
                            {axis.code ?? axis.label}
                        </span>
                        <span className="text-muted-foreground" aria-hidden>
                            {count}
                        </span>
                    </label>
                );
            })}
        </div>
    );
}
