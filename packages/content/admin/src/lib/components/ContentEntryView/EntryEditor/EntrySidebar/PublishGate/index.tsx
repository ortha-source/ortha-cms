import { defineMessages, useIntl } from 'react-intl';
import { Check, X } from 'lucide-react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    cn
} from '@ortha-cms/design-system';

/** One row of the publish gate: a field check with its live pass/fail. */
export type PublishGateItem = {
    /** The field's display label. */
    label: string;
    /** Whether the field currently passes publish validation. */
    ok: boolean;
    /** The failure message when `ok` is false. */
    message?: string;
};

const messages = defineMessages({
    gateTitle: {
        id: 'content.sidebar.gateTitle',
        defaultMessage: 'Publish gate'
    },
    gateBlocking: {
        id: 'content.sidebar.gateBlocking',
        defaultMessage: 'blocking'
    },
    gateReady: { id: 'content.sidebar.gateReady', defaultMessage: 'ready' },
    gateFailing: {
        id: 'content.sidebar.gateFailing',
        defaultMessage: 'failing'
    },
    gateAllClear: {
        id: 'content.sidebar.gateAllClear',
        defaultMessage: 'Every check passes — ready to publish.'
    },
    gateCaption: {
        id: 'content.sidebar.gateCaption',
        defaultMessage:
            'Checks re-run on every change — fix a field and watch it flip.'
    }
});

/**
 * The live **Publish Gate** card in the entry editor's right rail (publishable
 * types only): the publish validation field by field, each with its pass/fail,
 * and a header that reads `blocking`/`ready`. Presentational — the parent owns
 * the `items` (computed from the strict validation).
 */
export function PublishGate({ items }: { items: PublishGateItem[] }) {
    const intl = useIntl();
    const blocking = items.some((item) => !item.ok);

    return (
        <Card className="rounded-2xl bg-background shadow-none">
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                    {intl.formatMessage(messages.gateTitle)}
                </CardTitle>
                <span
                    className={cn(
                        'text-xs font-medium',
                        blocking ? 'text-destructive' : 'text-muted-foreground'
                    )}
                >
                    {intl.formatMessage(
                        blocking ? messages.gateBlocking : messages.gateReady
                    )}
                </span>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
                {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        {intl.formatMessage(messages.gateAllClear)}
                    </p>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {items.map((item) => (
                            <li
                                key={item.label}
                                className="flex items-start gap-2 text-sm"
                            >
                                {item.ok ? (
                                    <Check
                                        className="mt-0.5 size-4 shrink-0 text-primary"
                                        aria-hidden
                                    />
                                ) : (
                                    <X
                                        className="mt-0.5 size-4 shrink-0 text-destructive"
                                        aria-hidden
                                    />
                                )}
                                <span className="min-w-0 flex-1">
                                    {item.label}
                                </span>
                                {!item.ok && (
                                    <span className="shrink-0 text-xs text-destructive">
                                        {item.message ??
                                            intl.formatMessage(
                                                messages.gateFailing
                                            )}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                    {intl.formatMessage(messages.gateCaption)}
                </p>
            </CardContent>
        </Card>
    );
}
