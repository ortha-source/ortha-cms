import { defineMessages, useIntl } from 'react-intl';
import { Trash2 } from 'lucide-react';
import { Button, Separator } from '@orthacms/design-system';
import type {
    Condition,
    ConditionGroup
} from '../../../../domain/types/accessRule';
import type { SegmentType } from '../../../../domain/types/segmentType';
import { ConditionRow } from '../ConditionRow';

const messages = defineMessages({
    heading: {
        id: 'segments.group.heading',
        defaultMessage: 'Group {index}'
    },
    remove: {
        id: 'segments.group.remove',
        defaultMessage: 'Remove group {index}'
    },
    and: { id: 'segments.group.and', defaultMessage: 'and' },
    admits: {
        id: 'segments.group.admits',
        defaultMessage: 'A reader gets in when every line here holds.'
    }
});

/** Props for {@link ConditionGroupCard}. */
type ConditionGroupCardProps = {
    /** 1-based position, as the explain panel numbers it. */
    index: number;
    /** The group being edited. */
    group: ConditionGroup;
    /** Every active segment type — one row each. */
    types: readonly SegmentType[];
    /** Replaces the group. */
    onChange: (group: ConditionGroup) => void;
    /** Removes the group; absent when it is the only one. */
    onRemove?: () => void;
    /** Whether the editor is read-only. */
    disabled: boolean;
    /** The dialog's content node, for the pickers' popovers. */
    container: HTMLElement | null;
};

/**
 * One AND-group: every segment type, one row each.
 *
 * Every active type gets a row whether or not the group constrains it, and the
 * `all` mode is what says "this axis is open here". Rendering only the
 * constrained types would hide the axes an administrator has to think about —
 * the ones a rule is silent on are exactly where content leaks — and would make
 * "add a condition" a second, separate act on top of choosing what it says.
 *
 * The group numbering matches the explain panel's (`group 1`, `group 2`), which
 * is what lets someone read "let in by group 2" and come straight here.
 */
export function ConditionGroupCard({
    index,
    group,
    types,
    onChange,
    onRemove,
    disabled,
    container
}: ConditionGroupCardProps) {
    const intl = useIntl();

    const setCondition = (typeKey: string, condition: Condition) => {
        onChange({
            conditions: { ...group.conditions, [typeKey]: condition }
        });
    };

    return (
        <div className="rounded-lg border bg-background p-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                    {intl.formatMessage(messages.heading, { index })}
                </h4>
                {onRemove && !disabled ? (
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={intl.formatMessage(messages.remove, {
                            index
                        })}
                        onClick={onRemove}
                    >
                        <Trash2 aria-hidden />
                    </Button>
                ) : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
                {intl.formatMessage(messages.admits)}
            </p>
            <Separator className="my-3" />
            <div className="flex flex-col gap-3">
                {types.map((type) => (
                    <ConditionRow
                        key={type.id}
                        type={type}
                        condition={group.conditions[type.key]}
                        allowInherit
                        disabled={disabled}
                        container={container}
                        onChange={(condition) =>
                            setCondition(type.key, condition)
                        }
                    />
                ))}
            </div>
        </div>
    );
}
