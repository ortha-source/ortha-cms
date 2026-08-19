import { useCallback, useMemo, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import type {
    FilterField,
    RelationValueEditor
} from '../../types/filter-field.type';
import type { FilterGroup } from '../../types/filter-tree.type';
import { defaultValueForOp } from '../../utils/defaultValueForOp';
import { opsForField } from '../../utils/operators';
import {
    addGroupTo,
    addRuleTo,
    newGroup,
    newRule,
    removeNode,
    updateCombinator,
    updateRule
} from '../../utils/treeOps';
import { countRules } from '../../utils/countRules';
import { fieldPath } from '../../utils/fieldPath';
import { GroupNode, type GroupNodeOps } from './GroupNode';
import { PortalContainerContext } from '../portalContainer';

const messages = defineMessages({
    // The builder's structure changed under the user and said nothing: "Add
    // rule" appended a row to a plain `div` with no live region, and the
    // "N conditions" readout is not one either. 4.1.3 (`ORT-157`).
    ruleAdded: {
        id: 'qb.live.ruleAdded',
        defaultMessage:
            'Condition added. {count, plural, one {# condition} other {# conditions}} in total.'
    },
    ruleRemoved: {
        id: 'qb.live.ruleRemoved',
        defaultMessage:
            'Condition removed. {count, plural, =0 {No conditions left} one {# condition remains} other {# conditions remain}}.'
    },
    groupAdded: {
        id: 'qb.live.groupAdded',
        defaultMessage: 'Group added.'
    },
    // 3.2.2: picking a `date` field over a `string` one resets the operator and
    // swaps the value editor for a `datetime-local`. That is the right
    // behaviour — the alternative is a rule in an illegal op-for-type state —
    // but it is two changes of context, and it happened in silence.
    fieldChanged: {
        id: 'qb.live.fieldChanged',
        defaultMessage:
            '{path} selected. Operator and value reset for the new field type.'
    },
    liveLabel: {
        id: 'qb.live.label',
        defaultMessage: 'Filter builder status'
    }
});

/** Props for {@link QueryBuilder}. */
export type QueryBuilderProps = {
    /** Available filter fields — usually a static schema mirror of the BE filter spec. */
    fields: readonly FilterField[];
    /** Current tree, or null when no rules are set. Treated as the live-edit value. */
    value: FilterGroup | null;
    /**
     * Called on every edit (rule add / remove / update, group toggle,
     * sub-group add / remove). The consumer decides whether changes are
     * staged (commit on Apply) or applied immediately — the builder
     * itself is purely controlled.
     */
    onChange: (next: FilterGroup) => void;
    /**
     * When `true`, each invalid rule renders an inline validation
     * message under its row. The drawer flips this on after a failed
     * Apply so the user sees what to fix. Default `false`.
     */
    showErrors?: boolean;
    /**
     * Renders the value editor for a rule whose field carries a
     * `relationTarget` (a relation's `id`). Injected because this package
     * has no data layer. Omit it and relation-id rules use the raw uuid
     * input.
     */
    renderRelationValue?: RelationValueEditor;
    /**
     * DOM node the nested popovers (field picker, relation value picker) portal
     * into. Set it to the scroll-locking ancestor's element (a drawer / dialog)
     * so their lists scroll by mouse wheel; the `QueryBuilderDrawer` wires this
     * automatically. Defaults to `document.body`.
     */
    portalContainer?: HTMLElement | null;
};

/**
 * Visual filter-tree builder. Plain controlled component — the parent
 * owns the value and decides what "Apply" means (typically Apply +
 * Reset live in the host's footer). Supports OR + nested groups via
 * the recursive {@link GroupNode}; the recursive `FilterGroup` shape
 * means there's no depth limit on the FE state itself (the BE caps
 * group depth on its end via `maxGroupDepth`).
 */
export function QueryBuilder({
    fields,
    value,
    onChange,
    showErrors = false,
    renderRelationValue,
    portalContainer
}: QueryBuilderProps) {
    // Memoise the empty-state group so render stays pure: without this,
    // `newGroup()` runs on every render and produces a fresh id, which
    // means the next mutation operates against a different baseline
    // tree than the one currently on screen.
    const intl = useIntl();
    const emptyTree = useMemo(() => newGroup(), []);
    const tree = value ?? emptyTree;

    const rootRef = useRef<HTMLDivElement>(null);
    const [announcement, setAnnouncement] = useState('');

    /**
     * Puts focus somewhere real before a removed row takes it with it.
     *
     * Prefers the next remove button, then the previous, then the group's "Add
     * rule" — walking the same direction the list does, so removing three rows
     * in a row keeps the user in one place instead of sending them back to the
     * top of the document each time (2.4.3). The elements are captured *before*
     * the removal and focused after it: React keys the rows, so every row but
     * the removed one keeps its DOM node across the re-render.
     */
    const handleRemoveFocus = useCallback((trigger: HTMLElement) => {
        const root = rootRef.current;
        if (!root) return;

        const removes = Array.from(
            root.querySelectorAll<HTMLElement>('[data-qb-remove]')
        );
        const position = removes.indexOf(trigger);
        const target =
            (position >= 0 ? removes[position + 1] : undefined) ??
            (position > 0 ? removes[position - 1] : undefined) ??
            root.querySelector<HTMLElement>('[data-qb-add-rule]');

        if (!target) return;
        // After the commit that unmounts the row — focusing now would be undone
        // by the browser blurring the element that is about to disappear.
        requestAnimationFrame(() => target.focus());
    }, []);

    const ops: GroupNodeOps = {
        onAddRule: (parentGroupId) => {
            const first = fields[0];
            if (!first) return;
            // `opsForField`, not `OPS_FOR_TYPE`, so a field that narrows its
            // operator set (a virtual field answered by a subquery, say) is
            // seeded with an operator it actually offers. Seeding from the
            // type alone put "Add rule" and the operator picker on different
            // vocabularies — the one place `FilterField.operators` was not
            // being honoured.
            const op = opsForField(first)[0];
            const next = addRuleTo(
                tree,
                parentGroupId,
                newRule(first.id, op, defaultValueForOp(op))
            );
            onChange(next);
            setAnnouncement(
                intl.formatMessage(messages.ruleAdded, {
                    count: countRules(next)
                })
            );
        },
        onAddGroup: (parentGroupId) => {
            onChange(addGroupTo(tree, parentGroupId, newGroup()));
            setAnnouncement(intl.formatMessage(messages.groupAdded));
        },
        onUpdateRule: (ruleId, patch) => {
            onChange(updateRule(tree, ruleId, patch));
            // Only a *field* change resets the rest of the row, so only that
            // one is worth saying. An operator or value edit is the user
            // watching their own keystroke land.
            if (patch.fieldId) {
                setAnnouncement(
                    intl.formatMessage(messages.fieldChanged, {
                        path: fieldPath(intl, fields, patch.fieldId)
                    })
                );
            }
        },
        onUpdateCombinator: (groupId, combinator) => {
            onChange(updateCombinator(tree, groupId, combinator));
        },
        onRemoveNode: (nodeId) => {
            const next = removeNode(tree, nodeId);
            onChange(next);
            setAnnouncement(
                intl.formatMessage(messages.ruleRemoved, {
                    count: countRules(next)
                })
            );
        }
    };

    return (
        <PortalContainerContext.Provider value={portalContainer ?? null}>
            <div ref={rootRef}>
                <GroupNode
                    group={tree}
                    fields={fields}
                    isRoot
                    ops={ops}
                    onRemoveFocus={handleRemoveFocus}
                    showErrors={showErrors}
                    renderRelationValue={renderRelationValue}
                />
                {/* One polite region for the whole builder, named so it is not
                    mistaken for part of the tree. Polite rather than assertive:
                    the user did this on purpose and is not being interrupted. */}
                <p
                    role="status"
                    aria-label={intl.formatMessage(messages.liveLabel)}
                    className="sr-only"
                >
                    {announcement}
                </p>
            </div>
        </PortalContainerContext.Provider>
    );
}
