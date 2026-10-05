import {
    useCallback,
    useEffect,
    useId,
    useRef,
    useState,
    type ReactElement
} from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Alert,
    AlertDescription,
    AlertTitle,
    Button,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Spinner,
    Tooltip,
    TooltipContent,
    TooltipTrigger
} from '@orthacms/design-system';
import type {
    FilterField,
    RelationValueEditor
} from '../../types/filter-field.type';
import type { FilterGroup } from '../../types/filter-tree.type';
import { countRules } from '../../utils/countRules';
import { useFilterDraft } from '../../hooks/useFilterDraft';
import { QueryBuilder } from '../QueryBuilder';
import { JsonPreview } from '../QueryBuilderDrawer/JsonPreview';
import { FiltersIconButton } from './FiltersIconButton';

const messages = defineMessages({
    title: { id: 'qb.popover.title', defaultMessage: 'Filters' },
    trigger: {
        id: 'qb.popover.trigger',
        defaultMessage:
            '{count, plural, =0 {Filters} one {Filters, # applied} other {Filters, # applied}}'
    },
    conditions: {
        id: 'qb.popover.conditions',
        defaultMessage:
            '{count, plural, =0 {No conditions} one {# condition} other {# conditions}}'
    },
    apply: { id: 'qb.popover.apply', defaultMessage: 'Apply' },
    reset: { id: 'qb.popover.reset', defaultMessage: 'Reset' },
    loading: {
        id: 'qb.popover.loading',
        defaultMessage: 'Loading filterable fields…'
    },
    errorTitle: {
        id: 'qb.popover.errorTitle',
        defaultMessage: "Couldn't load the filterable fields"
    },
    errorBody: {
        id: 'qb.popover.errorBody',
        defaultMessage:
            'Filters are unavailable until this loads. Any filter already applied is still in effect.'
    },
    retry: { id: 'qb.popover.retry', defaultMessage: 'Try again' }
});

/** Props for {@link QueryBuilderPopover}. */
export type QueryBuilderPopoverProps = {
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
    /**
     * `fields` has not loaded yet. Renders a loading state instead of the
     * builder — a rule whose field is missing can never pass the Apply gate,
     * so showing an empty picker would just look broken.
     */
    fieldsPending?: boolean;
    /**
     * Loading `fields` failed. Renders an error state with {@link onRetryFields}
     * instead of the builder. Distinct from "the type has no filterable
     * fields", which is a legitimately empty picker.
     */
    fieldsError?: boolean;
    /** Retry the `fields` request; renders a Try again action when set. */
    onRetryFields?: () => void;
    /**
     * A custom trigger, rendered through `PopoverTrigger asChild` — so it must
     * be a single element that forwards its ref and props (a `Button`). Omit it
     * for the standard list-toolbar trigger: an icon-only "Filters" button with
     * a tooltip and the applied-rule count as a corner badge.
     */
    trigger?: ReactElement;
    /**
     * The popover's heading, which is also its accessible name. Defaults to
     * "Filters"; a consumer whose trigger says something else (the alarm
     * editor's "Edit conditions") passes that, so the surface is named after
     * the control that opened it.
     */
    title?: string;
    /** Controlled open state. Omit to let the popover own it. */
    open?: boolean;
    /** Called whenever the popover opens or closes. */
    onOpenChange?: (open: boolean) => void;
};

/** The first control a user opening the builder means to reach. */
function firstBuilderControl(root: HTMLElement): HTMLElement | null {
    return (
        root.querySelector<HTMLElement>('[role="combobox"]') ??
        root.querySelector<HTMLElement>('[data-qb-add-rule]')
    );
}

/**
 * A {@link QueryBuilder} in a large popover anchored to its trigger — the
 * surface every list page and the alarm rule editor mount.
 *
 * Owns the trigger (the standard icon button, or the consumer's own), the open
 * state (unless controlled), the staged draft ({@link useFilterDraft}), and the
 * header / Apply–Reset footer:
 *
 * - **Apply** commits the draft and closes. Apply on a draft with invalid rules
 *   shows the inline errors, moves focus to the first offending row, and keeps
 *   the popover open.
 * - **Reset** clears the draft and commits "no filter", and stays open so the
 *   next filter can be built without reopening.
 * - **Closing without Apply** — Esc, a click outside, the trigger again —
 *   discards the draft; the next open re-reads the applied filter. Radix hands
 *   focus back to the trigger.
 *
 * Non-modal on purpose: a modal popover `aria-hidden`s the page root, which
 * holds focusable content, and fails axe's `aria-hidden-focus` (the same reason
 * every menu in the admin passes `modal={false}`). Being non-modal also means no
 * scroll lock, so the builder's own nested popovers (field picker, selects,
 * date and relation pickers) keep the default body portal and still wheel —
 * they are React descendants of this layer, so interacting with them does not
 * count as "outside" and does not dismiss it.
 */
export function QueryBuilderPopover({
    fields,
    value,
    onApply,
    onApplied,
    renderRelationValue,
    fieldsPending = false,
    fieldsError = false,
    onRetryFields,
    trigger,
    title,
    open: openProp,
    onOpenChange
}: QueryBuilderPopoverProps) {
    const intl = useIntl();
    const titleId = useId();
    const contentRef = useRef<HTMLDivElement>(null);

    const [openState, setOpenState] = useState(false);
    const controlled = openProp !== undefined;
    const open = controlled ? openProp : openState;
    const setOpen = useCallback(
        (next: boolean) => {
            if (!controlled) setOpenState(next);
            onOpenChange?.(next);
        },
        [controlled, onOpenChange]
    );

    // The trigger's tooltip is suppressed while the popover is open: it would
    // otherwise sit on top of the surface it names.
    const [tooltipOpen, setTooltipOpen] = useState(false);

    const { draft, setDraft, showErrors, apply, reset } = useFilterDraft({
        open,
        value,
        fields,
        onApply,
        onApplied
    });

    // Without the field definitions every rule fails the Apply gate (a rule
    // whose field can't be resolved is never valid), so committing is
    // impossible — say so with a disabled button rather than a dead one.
    const fieldsReady = !fieldsPending && !fieldsError;
    const heading = title ?? intl.formatMessage(messages.title);
    const appliedCount = countRules(value);

    // Fields that resolve *after* opening: until then the builder (and so its
    // first field cell) isn't rendered, and focus was parked on the surface
    // itself. Move it on once there is somewhere to go — but never away from a
    // control the user has already reached.
    useEffect(() => {
        if (!open || !fieldsReady) return;
        const content = contentRef.current;
        if (!content) return;
        const active = document.activeElement;
        if (active && active !== content && content.contains(active)) return;
        firstBuilderControl(content)?.focus({ preventScroll: true });
    }, [open, fieldsReady]);

    const onApplyClick = () => {
        if (apply()) {
            setOpen(false);
            return;
        }
        // Take the user to the first thing that is wrong. Otherwise a failed
        // Apply inserts several `role="alert"` messages at once, which screen
        // readers coalesce or drop, and leaves focus on Apply (3.3.1,
        // `ORT-157`). The errors render in the commit `apply()` scheduled, so
        // the query waits a frame.
        requestAnimationFrame(() => {
            const firstError = contentRef.current?.querySelector<HTMLElement>(
                '[data-testid="qb-rule-error"]'
            );
            // The row's first control, not the message: the message is not
            // focusable, and the control is what has to change.
            firstError?.parentElement
                ?.querySelector<HTMLElement>(
                    'input, select, [role="combobox"], button'
                )
                ?.focus();
        });
    };

    const triggerElement = trigger ?? (
        <FiltersIconButton
            count={appliedCount}
            label={intl.formatMessage(messages.trigger, {
                count: appliedCount
            })}
        />
    );

    return (
        <Popover open={open} onOpenChange={setOpen}>
            {trigger ? (
                <PopoverTrigger asChild>{triggerElement}</PopoverTrigger>
            ) : (
                <Tooltip
                    open={tooltipOpen && !open}
                    onOpenChange={setTooltipOpen}
                >
                    <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                            {triggerElement}
                        </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>{heading}</TooltipContent>
                </Tooltip>
            )}
            <PopoverContent
                ref={contentRef}
                align="end"
                side="bottom"
                sideOffset={6}
                collisionPadding={16}
                aria-labelledby={titleId}
                // Land on the first condition's field cell rather than on the
                // first tabbable (the AND/OR toggle). With nothing to land on
                // yet — fields still loading — park focus on the surface
                // itself; the effect above moves it on once they arrive.
                //
                // `preventScroll`: the content is positioned on the frame it
                // mounts, and a scrolling focus would nudge the inner list
                // under a press that is already on its way.
                onOpenAutoFocus={(event) => {
                    const content = contentRef.current;
                    if (!content) return;
                    event.preventDefault();
                    const target = fieldsReady
                        ? firstBuilderControl(content)
                        : null;
                    (target ?? content).focus({ preventScroll: true });
                }}
                className="flex max-h-[var(--radix-popover-content-available-height)] w-[min(720px,calc(100vw-2rem))] flex-col overflow-hidden p-0"
            >
                <div className="flex items-baseline justify-between gap-3 border-b px-4 py-3">
                    <h2 id={titleId} className="text-sm font-semibold">
                        {heading}
                    </h2>
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {intl.formatMessage(messages.conditions, {
                            count: countRules(draft)
                        })}
                    </span>
                </div>
                <div className="min-h-0 max-h-[min(60vh,560px)] flex-1 overflow-y-auto p-4">
                    {fieldsError ? (
                        <Alert variant="destructive" role="alert">
                            <AlertTitle>
                                {intl.formatMessage(messages.errorTitle)}
                            </AlertTitle>
                            <AlertDescription className="flex flex-col items-start gap-2">
                                {intl.formatMessage(messages.errorBody)}
                                {onRetryFields ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={onRetryFields}
                                    >
                                        {intl.formatMessage(messages.retry)}
                                    </Button>
                                ) : null}
                            </AlertDescription>
                        </Alert>
                    ) : fieldsPending ? (
                        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                            <Spinner aria-hidden className="size-4" />
                            {intl.formatMessage(messages.loading)}
                        </p>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <QueryBuilder
                                fields={fields}
                                value={draft}
                                onChange={setDraft}
                                showErrors={showErrors}
                                renderRelationValue={renderRelationValue}
                            />
                            <JsonPreview tree={draft} />
                        </div>
                    )}
                </div>
                <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
                    <Button type="button" variant="ghost" onClick={reset}>
                        {intl.formatMessage(messages.reset)}
                    </Button>
                    <Button
                        type="button"
                        onClick={onApplyClick}
                        disabled={!fieldsReady}
                    >
                        {intl.formatMessage(messages.apply)}
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
