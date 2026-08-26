import { defineMessages, useIntl } from 'react-intl';
import {
    MultiSelect,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@orthacms/design-system';
import type {
    Condition,
    ConditionMode
} from '../../../../domain/types/accessRule';
import type { SegmentType } from '../../../../domain/types/segmentType';
import { useSegments } from '../../../../application/useSegments';

const messages = defineMessages({
    mode: {
        id: 'segments.condition.mode',
        defaultMessage: 'How {type} is read'
    },
    all: { id: 'segments.condition.all', defaultMessage: 'Any' },
    only: { id: 'segments.condition.only', defaultMessage: 'Only' },
    allExcept: {
        id: 'segments.condition.allExcept',
        defaultMessage: 'All except'
    },
    inherit: { id: 'segments.condition.inherit', defaultMessage: 'Inherit' },
    pick: { id: 'segments.condition.pick', defaultMessage: 'Choose {type}…' },
    search: {
        id: 'segments.condition.search',
        defaultMessage: 'Search segments'
    },
    none: {
        id: 'segments.condition.none',
        defaultMessage: 'No segment matches.'
    },
    emptyOnly: {
        id: 'segments.condition.emptyOnly',
        defaultMessage: 'An “Only” with nothing chosen admits nobody.'
    }
});

/** Props for {@link ConditionRow}. */
type ConditionRowProps = {
    /** The segment type this row constrains. */
    type: SegmentType;
    /** The current condition, or `undefined` when the group says nothing. */
    condition: Condition | undefined;
    /** Whether `inherit` is offered — it is authored-only, and not on exclusions. */
    allowInherit: boolean;
    /** Replaces the condition. */
    onChange: (condition: Condition) => void;
    /** Whether the editor is read-only. */
    disabled: boolean;
    /**
     * The dialog's content node, so the picker's popover portals **inside** the
     * scroll lock. `react-remove-scroll` allow-lists only that subtree, and a
     * popover on `document.body` sits outside it — the option list would then
     * scroll by dragging its scrollbar but not by mouse wheel.
     */
    container: HTMLElement | null;
};

/** The modes a row offers, in the order they read. */
const MODES: ConditionMode[] = ['all', 'only', 'all-except'];

/**
 * One segment type's condition inside one group: a mode, and the segments it
 * refers to.
 *
 * The segment list is fetched **only when the mode names segments** — an `all`
 * row needs no picker, and the editor mounts one row per segment type, so
 * fetching unconditionally would be up to eight lists to render a rule that
 * constrains one axis. `MultiSelect` filters the loaded list in its own popover,
 * which matches what the endpoint does: it returns a type's segments whole, so
 * there is no second page to go and ask for.
 *
 * An `only` with nothing chosen is left possible and *named* rather than
 * prevented. It is a real, reachable state — it is what a rule reads like the
 * moment its last segment is removed — and a control that silently refuses to
 * enter it just leaves the administrator wondering why the last chip won't come
 * off.
 */
export function ConditionRow({
    type,
    condition,
    allowInherit,
    onChange,
    disabled,
    container
}: ConditionRowProps) {
    const intl = useIntl();
    const mode = condition?.mode ?? 'all';
    const segmentIds = condition?.segmentIds ?? [];
    const needsSegments = mode === 'only' || mode === 'all-except';

    const { data: segments = [] } = useSegments(type.key, {}, needsSegments);
    const options = segments.map((segment) => ({
        value: segment.id,
        label: segment.label
    }));

    const modeLabel = (value: ConditionMode) =>
        value === 'all'
            ? intl.formatMessage(messages.all)
            : value === 'only'
              ? intl.formatMessage(messages.only)
              : value === 'all-except'
                ? intl.formatMessage(messages.allExcept)
                : intl.formatMessage(messages.inherit);

    return (
        <div className="grid grid-cols-[10rem_minmax(0,1fr)] items-start gap-3">
            <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">{type.label}</span>
                <Select
                    value={mode}
                    disabled={disabled}
                    onValueChange={(value) =>
                        onChange({
                            mode: value as ConditionMode,
                            // Kept rather than cleared on the way to `all`: a
                            // mis-click on the mode should not lose a selection
                            // of forty segments. The mode is what decides
                            // whether the ids mean anything.
                            segmentIds
                        })
                    }
                >
                    <SelectTrigger
                        aria-label={intl.formatMessage(messages.mode, {
                            type: type.label
                        })}
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {(allowInherit
                            ? [...MODES, 'inherit' as ConditionMode]
                            : MODES
                        ).map((value) => (
                            <SelectItem key={value} value={value}>
                                {modeLabel(value)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {needsSegments ? (
                <div className="flex flex-col gap-1 pt-6">
                    <MultiSelect
                        options={options}
                        value={segmentIds}
                        disabled={disabled}
                        container={container}
                        onChange={(next) =>
                            onChange({ mode, segmentIds: next })
                        }
                        placeholder={intl.formatMessage(messages.pick, {
                            type: type.label
                        })}
                        searchPlaceholder={intl.formatMessage(messages.search)}
                        emptyText={intl.formatMessage(messages.none)}
                    />
                    {mode === 'only' && segmentIds.length === 0 ? (
                        <p className="text-xs text-warning-soft-foreground">
                            {intl.formatMessage(messages.emptyOnly)}
                        </p>
                    ) : null}
                </div>
            ) : (
                <div />
            )}
        </div>
    );
}
