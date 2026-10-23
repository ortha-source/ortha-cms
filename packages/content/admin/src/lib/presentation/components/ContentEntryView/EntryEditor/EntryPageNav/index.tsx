import { useEffect, useRef, useState, type RefObject } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ListTree } from 'lucide-react';
import {
    Badge,
    BadgeDot,
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    cn
} from '@orthacms/design-system';
import {
    BASICS_SECTION,
    type PageSection
} from '../../../../../domain/pageSections';

const messages = defineMessages({
    title: { id: 'content.pageNav.title', defaultMessage: 'On this page' },
    sections: { id: 'content.pageNav.sections', defaultMessage: 'Sections' },
    basics: { id: 'content.pageNav.basics', defaultMessage: 'Basics' },
    changed: {
        id: 'content.pageNav.changed',
        defaultMessage: '{count, plural, one {# change} other {# changes}}'
    },
    issues: {
        id: 'content.pageNav.issues',
        defaultMessage: '{count, plural, one {# issue} other {# issues}}'
    },
    legendChanged: {
        id: 'content.pageNav.legendChanged',
        defaultMessage: 'Unsaved changes'
    },
    legendIssues: {
        id: 'content.pageNav.legendIssues',
        defaultMessage: 'Needs a fix'
    }
});

/** The form's mark on a section (`FieldSection`, and the Basics run). */
const sectionSelector = (key: string) =>
    `[data-entry-section="${CSS.escape(key)}"]`;

/**
 * **On this page** — the Content form's sections as a short list beside it
 * (`docs/design/entry-editor.md`): one row per section, Basics for the
 * fields above the first, the one in view highlighted, and each carrying how
 * many of its fields are changed or block publishing. A pick unfolds the
 * section and scrolls to it.
 *
 * It replaced the bar outline, which listed every **field** — a map as long
 * as the form. Fewer than three sections need no map at all, and the editor
 * does not render one.
 *
 * Two shapes: `list`, sticky in the work area's left margin when there is
 * room; `menu`, a "Sections" button in the title block when there is not.
 */
export function EntryPageNav({
    sections,
    isChanged,
    hasIssue,
    onGo,
    scopeRef,
    variant
}: {
    sections: PageSection[];
    /** Whether a field holds an unsaved edit. */
    isChanged: (name: string) => boolean;
    /** Whether a field blocks publishing. */
    hasIssue: (name: string) => boolean;
    /** Unfold a section and scroll to it. */
    onGo: (key: string) => void;
    /** The pane the form is drawn in, where the section marks are found. */
    scopeRef: RefObject<HTMLElement | null>;
    variant: 'list' | 'menu';
}) {
    const intl = useIntl();
    const [current, setCurrent] = useState<string | null>(
        sections[0]?.key ?? null
    );
    const keys = sections.map((section) => section.key).join('|');

    // Which section is in view, read off the page: the first marked section
    // whose box crosses the upper part of the viewport.
    useEffect(() => {
        if (variant !== 'list') return;
        const scope = scopeRef.current;
        if (!scope || typeof IntersectionObserver === 'undefined') return;
        const visible = new Map<string, boolean>();
        const order = keys.split('|');
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    const key = entry.target.getAttribute('data-entry-section');
                    if (key) visible.set(key, entry.isIntersecting);
                }
                const first = order.find((key) => visible.get(key));
                if (first) setCurrent(first);
            },
            { rootMargin: '-15% 0px -55% 0px' }
        );
        for (const key of order) {
            const element = scope.querySelector(sectionSelector(key));
            if (element) observer.observe(element);
        }
        return () => observer.disconnect();
    }, [keys, scopeRef, variant]);

    const labelOf = (section: PageSection) =>
        section.key === BASICS_SECTION
            ? intl.formatMessage(messages.basics)
            : (section.label ?? section.key);

    const counts = (section: PageSection) => ({
        changed: section.fields.filter(isChanged).length,
        issues: section.fields.filter(hasIssue).length
    });

    const marks = (section: PageSection) => {
        const { changed, issues } = counts(section);
        return (
            <span className="ml-auto flex shrink-0 items-center gap-1.5">
                {changed > 0 ? (
                    <span className="flex text-warning-soft-foreground">
                        <BadgeDot />
                        <span className="sr-only">
                            {intl.formatMessage(messages.changed, {
                                count: changed
                            })}
                        </span>
                    </span>
                ) : null}
                {issues > 0 ? (
                    <Badge
                        variant="destructive-soft"
                        size="xs"
                        className="tabular-nums"
                    >
                        <span aria-hidden>{issues}</span>
                        <span className="sr-only">
                            {intl.formatMessage(messages.issues, {
                                count: issues
                            })}
                        </span>
                    </Badge>
                ) : null}
            </span>
        );
    };

    // A pick moves focus into the form; the menu's own focus restore on
    // close would put it straight back on the "Sections" button.
    const picked = useRef(false);
    const go = (key: string) => {
        picked.current = true;
        setCurrent(key);
        onGo(key);
    };

    if (variant === 'menu') {
        return (
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 px-2 text-muted-foreground"
                    >
                        <ListTree aria-hidden />
                        {intl.formatMessage(messages.sections)}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="start"
                    className="w-60"
                    onCloseAutoFocus={(event) => {
                        if (!picked.current) return;
                        picked.current = false;
                        event.preventDefault();
                    }}
                >
                    {sections.map((section) => (
                        <DropdownMenuItem
                            key={section.key}
                            onSelect={() => go(section.key)}
                        >
                            <span className="truncate">{labelOf(section)}</span>
                            {marks(section)}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    const anyChanged = sections.some((section) => counts(section).changed);
    const anyIssues = sections.some((section) => counts(section).issues);

    return (
        <nav
            aria-label={intl.formatMessage(messages.title)}
            data-testid="entry-page-nav"
            className="flex w-[184px] flex-col gap-0.5 pt-1"
        >
            <h2 className="px-2.5 pb-2 text-xs font-medium text-muted-foreground">
                {intl.formatMessage(messages.title)}
            </h2>
            <ul className="flex flex-col gap-0.5">
                {sections.map((section) => {
                    const active = current === section.key;
                    const failing = counts(section).issues > 0;
                    return (
                        <li key={section.key}>
                            <button
                                type="button"
                                aria-current={active ? 'location' : undefined}
                                onClick={() => go(section.key)}
                                className={cn(
                                    'flex h-[30px] w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    active
                                        ? 'bg-muted font-medium text-foreground'
                                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                                    failing &&
                                        'text-destructive hover:text-destructive'
                                )}
                            >
                                <span className="truncate">
                                    {labelOf(section)}
                                </span>
                                {marks(section)}
                            </button>
                        </li>
                    );
                })}
            </ul>
            {/* What the marks mean, once, under the list — only the marks
                actually drawn. Hidden from assistive tech: each mark already
                carries its own sr-only sentence. */}
            {anyChanged || anyIssues ? (
                <div
                    aria-hidden
                    className="mx-2.5 mt-3 flex flex-col gap-1.5 border-t pt-3 text-xs text-muted-foreground"
                >
                    {anyChanged ? (
                        <span className="flex items-center gap-2">
                            <BadgeDot className="text-warning-soft-foreground" />
                            {intl.formatMessage(messages.legendChanged)}
                        </span>
                    ) : null}
                    {anyIssues ? (
                        <span className="flex items-center gap-2">
                            <BadgeDot className="text-destructive" />
                            {intl.formatMessage(messages.legendIssues)}
                        </span>
                    ) : null}
                </div>
            ) : null}
        </nav>
    );
}
