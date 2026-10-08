import { defineMessages, useIntl } from 'react-intl';
import { Checkbox, cn } from '@orthacms/design-system';
import {
    axisState,
    checkedOf,
    isOption,
    isPicked,
    PICK_STATE,
    type Picks
} from '../../../../domain/publishPicks';
import type { PublishAxis, PublishRecord } from '../../../../domain/types';

const messages = defineMessages({
    group: {
        id: 'publishing.locales.group',
        defaultMessage: 'Locales for every {type} record'
    },
    toggle: {
        id: 'publishing.axis.toggle',
        defaultMessage: 'Publish {axis} for every {type} record'
    },
    none: {
        id: 'publishing.axis.unavailable',
        defaultMessage: 'Nothing to publish in {axis}'
    }
});

/**
 * A section's locales as a row of **chips** — one tri-state checkbox per
 * locale that picks or clears it for every record of the type that has
 * something to publish in it, with how many of those are picked. A chip row
 * wraps, so twenty locales cost a second line rather than a horizontal scroll;
 * a locale with nothing to publish anywhere is shown disabled, not hidden, so
 * the set of languages reads the same in every section.
 */
export function LocaleBar({
    axes,
    records,
    typeLabel,
    picks,
    disabled,
    onToggle
}: {
    axes: readonly PublishAxis[];
    records: readonly PublishRecord[];
    typeLabel: string;
    picks: Picks;
    disabled: boolean;
    onToggle: (axis: string, on: boolean) => void;
}) {
    const intl = useIntl();
    return (
        <div
            role="group"
            aria-label={intl.formatMessage(messages.group, { type: typeLabel })}
            className="flex flex-wrap gap-2"
        >
            {axes.map((axis) => {
                const state = axisState(picks, records, axis.key);
                const unavailable = state === PICK_STATE.Unavailable;
                const candidates = records.filter((record) =>
                    isOption(record, axis.key)
                );
                const picked = candidates.filter((record) =>
                    isPicked(picks, record.key, axis.key)
                ).length;
                return (
                    <label
                        key={axis.key}
                        title={axis.label}
                        className={cn(
                            'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
                            // Dashed, not faded: an opacity on muted text
                            // drops it below AA contrast, and the chip still
                            // has to be readable to say the locale exists.
                            unavailable &&
                                'cursor-default border-dashed text-muted-foreground',
                            state === PICK_STATE.All && 'border-primary'
                        )}
                    >
                        <Checkbox
                            checked={checkedOf(state)}
                            disabled={unavailable || disabled}
                            // A partly-picked locale completes on click, the
                            // way the records table's select-all does.
                            onCheckedChange={() =>
                                onToggle(axis.key, state !== PICK_STATE.All)
                            }
                            aria-label={intl.formatMessage(
                                unavailable ? messages.none : messages.toggle,
                                { axis: axis.label, type: typeLabel }
                            )}
                        />
                        <span className="font-mono uppercase">
                            {axis.code ?? axis.label}
                        </span>
                        <span className="text-muted-foreground" aria-hidden>
                            {picked}/{candidates.length}
                        </span>
                    </label>
                );
            })}
        </div>
    );
}
