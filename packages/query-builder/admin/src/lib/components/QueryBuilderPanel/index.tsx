import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Button } from '@ortha-cms/design-system';
import type {
    FilterField,
    RelationValueEditor
} from '../../types/filter-field.type';
import type { FilterGroup } from '../../types/filter-tree.type';
import { countRules } from '../../utils/countRules';
import { treeHasInvalidRules } from '../../utils/validateRule';
import { QueryBuilder } from '../QueryBuilder';
import { JsonPreview } from '../QueryBuilderDrawer/JsonPreview';

const messages = defineMessages({
    conditions: {
        id: 'qb.panel.conditions',
        defaultMessage:
            '{count, plural, =0 {No conditions} one {# condition} other {# conditions}}'
    },
    apply: { id: 'qb.panel.apply', defaultMessage: 'Apply' },
    reset: { id: 'qb.panel.reset', defaultMessage: 'Reset' }
});

/** Props for {@link QueryBuilderPanel}. */
export type QueryBuilderPanelProps = {
    /** Whether the panel is expanded. The consumer owns the toggle button. */
    open: boolean;
    /** Called to collapse the panel (Apply, Esc). */
    onOpenChange: (open: boolean) => void;
    /** Available filter fields. */
    fields: readonly FilterField[];
    /** The applied filter tree (URL-driven). `null` when no rules are set. */
    value: FilterGroup | null;
    /** Called on Apply (with the next tree) or Reset (with `null`). */
    onApply: (next: FilterGroup | null) => void;
    /** Called after a successful **Apply** (not Reset) — e.g. to toast. */
    onApplied?: () => void;
    /** Record picker for a relation-id rule, forwarded to the builder. */
    renderRelationValue?: RelationValueEditor;
    /** `id` of the toggle button, so the region is labelled by it. */
    labelledBy?: string;
    /** `id` for the region element (the toggle's `aria-controls` target). */
    id?: string;
};

/**
 * Inline, full-width accordion hosting a {@link QueryBuilder} — the in-page
 * alternative to `QueryBuilderDrawer`. It sits between the records toolbar and
 * the table and pushes the table down when open (no overlay, no backdrop). The
 * consumer owns the toggle button (in the toolbar) and the `open` state; this
 * owns the staged `draft`, the Apply/Reset footer, and the collapse-on-Apply /
 * Esc behaviour.
 *
 * Open/close animates the height via `grid-template-rows` `0fr → 1fr` (~150ms,
 * no fade/scale), and honours `prefers-reduced-motion`. The rules list caps its
 * height and scrolls internally so the table is never pushed off-screen; the
 * JSON preview and footer stay pinned below it.
 */
export function QueryBuilderPanel({
    open,
    onOpenChange,
    fields,
    value,
    onApply,
    onApplied,
    renderRelationValue,
    labelledBy,
    id
}: QueryBuilderPanelProps) {
    const intl = useIntl();
    const [draft, setDraft] = useState<FilterGroup | null>(value);
    // Inline errors stay hidden until Apply is pressed on an invalid draft.
    const [showErrors, setShowErrors] = useState(false);
    const regionRef = useRef<HTMLDivElement>(null);

    // Sync the draft to the applied filter every time the panel opens, so the
    // user always edits the current state; closing without Apply discards edits.
    useEffect(() => {
        if (open) {
            setDraft(value);
            setShowErrors(false);
        }
    }, [open, value]);

    // Errors fade out as the draft becomes valid — no need to re-press Apply.
    useEffect(() => {
        if (showErrors && !treeHasInvalidRules(draft, fields)) {
            setShowErrors(false);
        }
    }, [draft, fields, showErrors]);

    // Move focus into the first condition's field cell when the panel opens.
    useEffect(() => {
        if (!open) return;
        regionRef.current
            ?.querySelector<HTMLElement>('[role="combobox"]')
            ?.focus();
    }, [open]);

    const apply = () => {
        if (treeHasInvalidRules(draft, fields)) {
            setShowErrors(true);
            return;
        }
        const hasRules = draft && draft.children.length > 0;
        onApply(hasRules ? draft : null);
        onApplied?.();
        // The panel stays open after Apply — the URL/table update, but the
        // builder remains expanded for further edits (the toggle collapses it).
    };

    const reset = () => {
        setDraft(null);
        setShowErrors(false);
        onApply(null);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        // Esc collapses the panel — but let an open popover (the field/value
        // pickers) swallow its own Escape first.
        if (event.key === 'Escape' && !event.defaultPrevented) {
            onOpenChange(false);
        }
    };

    return (
        <div
            className="grid transition-[grid-template-rows] duration-150 ease-out motion-reduce:transition-none"
            style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
        >
            <div className="overflow-hidden">
                <section
                    ref={regionRef}
                    id={id}
                    role="region"
                    aria-labelledby={labelledBy}
                    inert={!open}
                    onKeyDown={onKeyDown}
                    className="mb-6 flex flex-col gap-4 rounded-2xl border bg-muted/50 p-5"
                >
                    <div className="max-h-[22rem] overflow-y-auto pr-1">
                        <QueryBuilder
                            fields={fields}
                            value={draft}
                            onChange={setDraft}
                            showErrors={showErrors}
                            renderRelationValue={renderRelationValue}
                        />
                    </div>
                    <JsonPreview tree={draft} />
                    <div className="flex items-center justify-between gap-2 border-t pt-4">
                        <span className="text-xs text-muted-foreground tabular-nums">
                            {intl.formatMessage(messages.conditions, {
                                count: countRules(draft)
                            })}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={reset}
                            >
                                {intl.formatMessage(messages.reset)}
                            </Button>
                            <Button type="button" onClick={apply}>
                                {intl.formatMessage(messages.apply)}
                            </Button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
