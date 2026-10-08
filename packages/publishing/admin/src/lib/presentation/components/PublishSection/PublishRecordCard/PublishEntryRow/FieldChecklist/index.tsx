import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Check, ChevronRight, Globe, X } from 'lucide-react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from '@orthacms/design-system';
import type { BulkPublishCheck } from '@orthacms/content-admin';

const messages = defineMessages({
    show: {
        id: 'publishing.checks.show',
        defaultMessage:
            'Show all {count, plural, one {# field check} other {# field checks}} for {entry}'
    },
    hide: {
        id: 'publishing.checks.hide',
        defaultMessage: 'Hide the field checks for {entry}'
    },
    toggleText: {
        id: 'publishing.checks.toggleText',
        defaultMessage: '{count, plural, one {# field} other {# fields}}'
    },
    translated: {
        id: 'publishing.checks.translated',
        defaultMessage: '(translated per locale)'
    },
    failing: {
        id: 'publishing.checks.failing',
        defaultMessage: 'What {entry} is missing'
    }
});

/** One check as a line: ✓/✗, its label, the globe on a translated field. */
function CheckLine({
    check,
    localized
}: {
    check: BulkPublishCheck;
    localized: boolean;
}) {
    const intl = useIntl();
    return (
        <li className="flex items-start gap-1.5 text-xs">
            {check.ok ? (
                <Check
                    className="mt-0.5 size-3.5 shrink-0 text-primary"
                    aria-hidden
                />
            ) : (
                <X
                    className="mt-0.5 size-3.5 shrink-0 text-destructive"
                    aria-hidden
                />
            )}
            <span
                className={
                    check.ok ? 'text-muted-foreground' : 'text-destructive'
                }
            >
                <span className="font-medium">{check.label}</span>
                {localized ? (
                    <>
                        <Globe
                            className="ml-1 inline size-3 align-[-1px]"
                            aria-hidden
                        />
                        <span className="sr-only">
                            {intl.formatMessage(messages.translated)}
                        </span>
                    </>
                ) : null}
                {!check.ok && check.message ? `: ${check.message}` : null}
            </span>
        </li>
    );
}

/**
 * What one entry's publish gate says field by field — the per-locale version
 * of the bulk dialog's checklist. The **failing** checks are always on screen,
 * because they are why this locale will not go out; the full list (passed
 * fields included) folds open on demand. A field translated per locale wears
 * a globe, so the reader can tell "the German title is missing" from "a
 * shared field is missing everywhere".
 */
export function FieldChecklist({
    entryName,
    checks,
    localizedFields
}: {
    /** "{record} · {language}", for the toggle's accessible name. */
    entryName: string;
    checks: readonly BulkPublishCheck[];
    localizedFields: ReadonlySet<string>;
}) {
    const intl = useIntl();
    const [open, setOpen] = useState(false);
    if (checks.length === 0) return null;
    const failing = checks.filter((check) => !check.ok);
    return (
        <Collapsible open={open} onOpenChange={setOpen} className="ml-7">
            {failing.length > 0 && !open ? (
                <ul
                    aria-label={intl.formatMessage(messages.failing, {
                        entry: entryName
                    })}
                    className="flex flex-col gap-1"
                >
                    {failing.map((check) => (
                        <CheckLine
                            key={check.field}
                            check={check}
                            localized={localizedFields.has(check.field)}
                        />
                    ))}
                </ul>
            ) : null}
            <CollapsibleContent>
                <ul className="flex flex-col gap-1">
                    {checks.map((check) => (
                        <CheckLine
                            key={check.field}
                            check={check}
                            localized={localizedFields.has(check.field)}
                        />
                    ))}
                </ul>
            </CollapsibleContent>
            <CollapsibleTrigger
                className="group/checks mt-1 inline-flex items-center gap-1 rounded text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={intl.formatMessage(
                    open ? messages.hide : messages.show,
                    { count: checks.length, entry: entryName }
                )}
            >
                <ChevronRight
                    className="size-3.5 transition-transform group-data-[state=open]/checks:rotate-90"
                    aria-hidden
                />
                {intl.formatMessage(messages.toggleText, {
                    count: checks.length
                })}
            </CollapsibleTrigger>
        </Collapsible>
    );
}
