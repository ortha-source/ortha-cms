import { useEffect, useMemo, useState, type RefObject } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@orthacms/design-system';
import { fieldLabel } from '../../../../../domain/entryColumns';
import type { OutlineItem } from '../../../../../domain/fieldOutline';

const messages = defineMessages({
    label: {
        id: 'content.form.outline.label',
        defaultMessage: 'Jump to a field'
    },
    hasError: {
        id: 'content.form.outline.hasError',
        defaultMessage: '— needs attention'
    }
});

/** Anything a keyboard can land on, for a field whose control has no id. */
const FOCUSABLE =
    'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

/** Frames to wait for an unfolding section to mount its fields. */
const REVEAL_FRAMES = 12;

/** A stable key per stop, shared by the bars, the list and the observer. */
function keyOf(item: OutlineItem): string {
    return item.kind === 'section' ? `s:${item.key}` : `f:${item.field.name}`;
}

/** The selector for a stop's element in the form. */
function selectorOf(item: OutlineItem): string {
    return item.kind === 'section'
        ? `[data-entry-section="${CSS.escape(item.key)}"]`
        : `[data-entry-field="${CSS.escape(item.field.name)}"]`;
}

/** The key of an observed element — the inverse of {@link selectorOf}. */
function keyOfElement(element: Element): string | null {
    const field = element.getAttribute('data-entry-field');
    if (field !== null) return `f:${field}`;
    const section = element.getAttribute('data-entry-section');
    return section !== null ? `s:${section}` : null;
}

/**
 * Where focus goes on a jump: the field's own control — the element its
 * `<label for>` names (`entry-field-<name>`, put on the focusable element by
 * contract, contributed controls included) — else the first focusable thing in
 * the cell; for a section, its fold toggle.
 */
function focusTargetOf(item: OutlineItem, element: HTMLElement) {
    if (item.kind === 'section') {
        return element.querySelector<HTMLElement>('button');
    }
    const control = document.getElementById(`entry-field-${item.field.name}`);
    if (control && element.contains(control) && control.matches(FOCUSABLE)) {
        return control;
    }
    return element.querySelector<HTMLElement>(FOCUSABLE);
}

/**
 * The General tab's outline — a column of short bars at the left edge of the
 * editor, one per field and per section, the way Notion, Coda and incident.io
 * mark a long document.
 *
 * - **At rest it is only bars.** The one in view is drawn darker, and a field
 *   showing an error is drawn in the destructive colour, so a long form says
 *   where you are and where the problems are without taking a column of text.
 * - **Hovered or focused it opens into the list of labels**, and a pick
 *   scrolls the field into the middle of the view and puts the cursor in it. A
 *   field inside a folded section unfolds it first (`useFieldReveal`) — a jump
 *   that stops on a closed heading is half a jump.
 *
 * The bars are decoration (`aria-hidden`); the list is the navigation, a
 * `<nav>` of buttons that is always in the accessibility tree and simply
 * transparent until hovered or focused — `visibility: hidden` would also take
 * it out of the tab order, and then a keyboard could never open it. It comes
 * **after** the form in the DOM, so tabbing through the fields is not preceded
 * by a stop for every one of them.
 *
 * Which bar is current is read from the page, not from the schema: an
 * `IntersectionObserver` watches the cells `FieldStack` and `FieldSection`
 * mark (`data-entry-field` / `data-entry-section`) and the first one in a band
 * across the upper part of the view wins. A `MutationObserver` re-collects
 * them, since unfolding a section mounts fields that were not there.
 */
export function EntryFieldOutline({
    items,
    errorFor,
    onRevealSection,
    scopeRef
}: {
    /** The stops, in the order the form draws them (`outlineGeneralTab`). */
    items: OutlineItem[];
    /** The error a field is showing now, if any — the form's own `errorFor`. */
    errorFor: (name: string) => string | undefined;
    /** Asks the named section to unfold. */
    onRevealSection: (section: string) => void;
    /** The element holding the form — where stops are looked up. */
    scopeRef: RefObject<HTMLElement | null>;
}) {
    const intl = useIntl();
    const [active, setActive] = useState<string | null>(null);
    const keys = useMemo(() => items.map(keyOf), [items]);

    useEffect(() => {
        const scope = scopeRef.current;
        if (
            !scope ||
            typeof IntersectionObserver === 'undefined' ||
            typeof MutationObserver === 'undefined'
        ) {
            return;
        }
        const visible = new Set<string>();
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    const key = keyOfElement(entry.target);
                    if (!key) continue;
                    if (entry.isIntersecting) visible.add(key);
                    else visible.delete(key);
                }
                // The topmost stop in the band, by the outline's own order. A
                // gap with nothing in the band (between two tall fields) keeps
                // the last answer rather than blanking it.
                const first = keys.find((key) => visible.has(key));
                if (first) setActive(first);
            },
            // A band across the upper part of the view: a field counts as
            // current once it has scrolled up to where the eye is reading.
            { rootMargin: '-15% 0px -55% 0px' }
        );

        let frame = 0;
        const collect = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                observer.disconnect();
                visible.clear();
                scope
                    .querySelectorAll(
                        '[data-entry-field], [data-entry-section]'
                    )
                    .forEach((element) => observer.observe(element));
            });
        };
        collect();
        const mutations = new MutationObserver(collect);
        mutations.observe(scope, { childList: true, subtree: true });
        return () => {
            cancelAnimationFrame(frame);
            mutations.disconnect();
            observer.disconnect();
        };
    }, [keys, scopeRef]);

    const jump = (item: OutlineItem) => {
        const section = item.kind === 'section' ? item.key : item.section;
        if (section) onRevealSection(section);

        // An unfolding section mounts its fields a render later, so look for
        // the element over a few frames rather than once.
        let frames = 0;
        const attempt = () => {
            const element = scopeRef.current?.querySelector<HTMLElement>(
                selectorOf(item)
            );
            if (!element) {
                if (frames++ < REVEAL_FRAMES) requestAnimationFrame(attempt);
                return;
            }
            const reduceMotion = window.matchMedia?.(
                '(prefers-reduced-motion: reduce)'
            ).matches;
            element.scrollIntoView({
                block: 'center',
                behavior: reduceMotion ? 'auto' : 'smooth'
            });
            // `preventScroll`: the smooth scroll above is already on its way,
            // and focusing would otherwise snap there first.
            focusTargetOf(item, element)?.focus({ preventScroll: true });
            setActive(keyOf(item));
        };
        requestAnimationFrame(attempt);
    };

    const barClass = (item: OutlineItem, key: string) => {
        const failing = item.kind === 'field' && !!errorFor(item.field.name);
        return cn(
            'block h-0.5 shrink-0 rounded-full transition-colors',
            item.kind === 'section'
                ? 'w-4'
                : item.section
                  ? 'ml-1.5 w-2.5'
                  : 'w-3',
            failing
                ? 'bg-destructive'
                : key === active
                  ? 'bg-foreground'
                  : 'bg-muted-foreground/40'
        );
    };

    return (
        <nav
            aria-label={intl.formatMessage(messages.label)}
            className="group/outline relative"
        >
            <ol
                aria-hidden
                className="flex flex-col gap-1.5 py-1 transition-opacity group-focus-within/outline:opacity-0 group-hover/outline:opacity-0"
            >
                {items.map((item, index) => (
                    <li key={keys[index]} className="flex h-1.5 items-center">
                        <span className={barClass(item, keys[index])} />
                    </li>
                ))}
            </ol>
            <ol
                className={cn(
                    // Transparent, not hidden: a hidden list leaves the tab
                    // order, and then a keyboard could never open it.
                    'pointer-events-none absolute -left-1.5 -top-1.5 z-20 flex max-h-[70vh] w-60 flex-col overflow-y-auto rounded-lg border bg-popover p-1 opacity-0 shadow-md transition-opacity',
                    'group-focus-within/outline:pointer-events-auto group-focus-within/outline:opacity-100 group-hover/outline:pointer-events-auto group-hover/outline:opacity-100'
                )}
            >
                {items.map((item, index) => {
                    const key = keys[index];
                    const error =
                        item.kind === 'field' && !!errorFor(item.field.name);
                    return (
                        <li key={key}>
                            <button
                                type="button"
                                onClick={() => jump(item)}
                                aria-current={
                                    key === active ? 'location' : undefined
                                }
                                className={cn(
                                    'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
                                    item.kind === 'section'
                                        ? 'font-medium'
                                        : 'text-muted-foreground',
                                    key === active && 'text-foreground',
                                    error && 'text-destructive'
                                )}
                            >
                                <span
                                    aria-hidden
                                    className={barClass(item, key)}
                                />
                                <span className="truncate">
                                    {item.kind === 'section'
                                        ? item.label
                                        : fieldLabel(item.field)}
                                </span>
                                {error ? (
                                    <span className="sr-only">
                                        {intl.formatMessage(messages.hasError)}
                                    </span>
                                ) : null}
                            </button>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
