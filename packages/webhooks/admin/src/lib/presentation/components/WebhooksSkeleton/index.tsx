import { defineMessages, useIntl } from 'react-intl';
import { Webhook } from 'lucide-react';
import { PageTopBar } from '@orthacms/shell-admin';
import {
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@orthacms/design-system';

/** Intl descriptors for the webhook skeletons, co-located here. */
const messages = defineMessages({
    title: { id: 'webhooks.page.title', defaultMessage: 'Webhooks' },
    subtitle: {
        id: 'webhooks.page.description',
        defaultMessage:
            'Send content changes to your services. Each delivery is signed, queued and retried until it lands.'
    },
    loading: {
        id: 'webhooks.skeleton.loading',
        defaultMessage: 'Loading webhooks…'
    }
});

/**
 * The table placeholder shown while the list loads. Built from the real `Table`
 * primitives inside the same card frame the loaded table uses, so the columns
 * line up and nothing reflows on swap. Owns the single `role="status"`
 * announcement; the table itself is `aria-hidden`.
 */
export function WebhooksSkeleton({ rows = 4 }: { rows?: number }) {
    const intl = useIntl();

    return (
        <div role="status">
            <span className="sr-only">
                {intl.formatMessage(messages.loading)}
            </span>
            <div aria-hidden className="overflow-hidden rounded-xl border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>
                                <Skeleton className="h-4 w-24" />
                            </TableHead>
                            <TableHead>
                                <Skeleton className="h-4 w-40" />
                            </TableHead>
                            <TableHead>
                                <Skeleton className="h-4 w-28" />
                            </TableHead>
                            <TableHead>
                                <Skeleton className="h-4 w-20" />
                            </TableHead>
                            <TableHead>
                                <Skeleton className="h-4 w-24" />
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: rows }).map((_, index) => (
                            <TableRow key={index}>
                                <TableCell>
                                    <Skeleton className="h-4 w-32" />
                                </TableCell>
                                <TableCell>
                                    <Skeleton className="h-4 w-56" />
                                </TableCell>
                                <TableCell>
                                    <Skeleton className="h-5 w-24 rounded-full" />
                                </TableCell>
                                <TableCell>
                                    <Skeleton className="h-5 w-16 rounded-full" />
                                </TableCell>
                                <TableCell>
                                    <Skeleton className="h-4 w-24" />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

/**
 * Full-page placeholder for the lazy route's `Suspense` fallback.
 *
 * The chrome — the top bar and the container header — is **real**, not
 * skeleton: it is the page's identity, so it must be there from the first paint
 * rather than popping in when the chunk resolves. Only the table is a skeleton,
 * which is exactly what the page then swaps for its own pending state, so the
 * chunk boundary is invisible.
 */
export function WebhooksPageSkeleton() {
    const intl = useIntl();

    return (
        <>
            <PageTopBar
                icon={Webhook}
                crumbs={[
                    {
                        key: 'webhooks',
                        label: intl.formatMessage(messages.title)
                    }
                ]}
            />
            <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-5 px-4 py-8 sm:px-10">
                <header className="flex flex-col gap-1.5">
                    <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.012em]">
                        {intl.formatMessage(messages.title)}
                    </h1>
                    <p className="max-w-[640px] text-[13px] text-muted-foreground">
                        {intl.formatMessage(messages.subtitle)}
                    </p>
                </header>
                <WebhooksSkeleton />
            </div>
        </>
    );
}
