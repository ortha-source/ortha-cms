import { defineMessages, useIntl } from 'react-intl';
import { Check, X } from 'lucide-react';
import { Button, cn } from '@ortha-cms/design-system';
import type { GateItem } from '../../../../hooks/useRecordEditor';

const messages = defineMessages({
    title: { id: 'content.record.gate.title', defaultMessage: 'Publish gate' },
    blocking: {
        id: 'content.record.gate.blocking',
        defaultMessage: 'blocking'
    },
    ready: { id: 'content.record.gate.ready', defaultMessage: 'ready' },
    fix: { id: 'content.record.gate.fix', defaultMessage: 'Fix' },
    fixAria: {
        id: 'content.record.gate.fixAria',
        defaultMessage: 'Fix {field}'
    },
    caption: {
        id: 'content.record.gate.caption',
        defaultMessage: 'Checks re-run on every change.'
    }
});

/**
 * The **Publish gate** widget: one row per required (or invalid) field with its
 * live pass/fail, and a header state word that reads `blocking` / `ready`. Each
 * failing row carries a "Fix" button that jumps to and focuses the field. Purely
 * derived from the gate the editor computes — it recomputes on every change.
 */
export function PublishGateWidget({
    items,
    blocking,
    onFix
}: {
    items: GateItem[];
    blocking: boolean;
    onFix: (key: string) => void;
}) {
    const intl = useIntl();
    return (
        <section className="rounded-2xl border bg-background p-[18px]">
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-[13px] font-medium text-muted-foreground">
                    {intl.formatMessage(messages.title)}
                </h2>
                <span
                    className={cn(
                        'text-[13px] font-medium',
                        blocking ? 'text-destructive' : 'text-muted-foreground'
                    )}
                >
                    {intl.formatMessage(
                        blocking ? messages.blocking : messages.ready
                    )}
                </span>
            </div>

            <ul className="mt-3 flex flex-col gap-2">
                {items.map((item) => (
                    <li
                        key={item.key}
                        className="flex items-center gap-2 text-[13px]"
                    >
                        {item.ok ? (
                            <Check
                                className="size-4 shrink-0 text-foreground"
                                aria-hidden
                            />
                        ) : (
                            <X
                                className="size-4 shrink-0 text-destructive"
                                aria-hidden
                            />
                        )}
                        <span
                            className={cn(
                                'min-w-0 flex-1 truncate',
                                item.ok ? '' : 'text-destructive'
                            )}
                        >
                            {item.label}
                        </span>
                        {item.ok ? null : (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-xs shadow-none"
                                aria-label={intl.formatMessage(messages.fixAria, {
                                    field: item.label
                                })}
                                onClick={() => onFix(item.key)}
                            >
                                {intl.formatMessage(messages.fix)}
                            </Button>
                        )}
                    </li>
                ))}
            </ul>

            <p className="mt-3 text-xs text-muted-foreground">
                {intl.formatMessage(messages.caption)}
            </p>
        </section>
    );
}
