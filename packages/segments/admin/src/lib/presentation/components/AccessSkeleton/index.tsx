import { defineMessages, useIntl } from 'react-intl';
import { ShieldCheck } from 'lucide-react';
import { PageTopBar } from '@orthacms/shell-admin';
import {
    Container,
    ContainerHeader,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@orthacms/design-system';

/** Intl descriptors for the segmentation skeletons, co-located here. */
const messages = defineMessages({
    title: { id: 'segments.types.title', defaultMessage: 'Segmentation' },
    subtitle: {
        id: 'segments.types.subtitle',
        defaultMessage:
            'The axes reader access is decided on, and the segments each one holds.'
    },
    loading: {
        id: 'segments.skeleton.loading',
        defaultMessage: 'Loading segmentation…'
    }
});

/**
 * The table placeholder shown while a list loads. Built from the real `Table`
 * primitives inside the same card frame the loaded table uses, so the columns
 * line up exactly and nothing reflows on swap. Owns the single `role="status"`
 * announcement; the table itself is `aria-hidden`.
 */
export function AccessTableSkeleton({
    rows = 4,
    columns = 5
}: {
    rows?: number;
    columns?: number;
}) {
    const intl = useIntl();

    return (
        <div role="status">
            <span className="sr-only">
                {intl.formatMessage(messages.loading)}
            </span>
            <div
                aria-hidden
                className="mt-4 overflow-hidden rounded-xl border bg-card shadow-xs"
            >
                <Table>
                    <TableHeader>
                        <TableRow>
                            {Array.from({ length: columns }).map((_, index) => (
                                <TableHead key={index}>
                                    <Skeleton className="h-4 w-20" />
                                </TableHead>
                            ))}
                            <TableHead className="w-12" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: rows }).map((_, row) => (
                            <TableRow key={row}>
                                {Array.from({ length: columns }).map(
                                    (_, cell) => (
                                        <TableCell key={cell}>
                                            <Skeleton className="h-4 w-24" />
                                        </TableCell>
                                    )
                                )}
                                <TableCell>
                                    <Skeleton className="ml-auto size-8 rounded-md" />
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
 * Full-page placeholder for the lazy `/access` route's `Suspense` fallback. The
 * chrome — the top bar and the container header — is **real**, not skeleton:
 * the bar is the page's identity, so it must be there from the first paint
 * rather than popping in once the chunk resolves. Only the table is a skeleton,
 * which is exactly what the page then swaps for its own pending state, so the
 * chunk boundary is invisible.
 */
export function SegmentTypesPageSkeleton() {
    const intl = useIntl();

    return (
        <>
            <PageTopBar
                icon={ShieldCheck}
                crumbs={[
                    {
                        key: 'access',
                        label: intl.formatMessage(messages.title)
                    }
                ]}
            />
            <Container>
                <ContainerHeader
                    title={intl.formatMessage(messages.title)}
                    subtitle={intl.formatMessage(messages.subtitle)}
                />
                <AccessTableSkeleton />
            </Container>
        </>
    );
}

/** The workspace Access page's fallback — same reasoning, no top bar of its own. */
export function WorkspaceAccessPageSkeleton() {
    return (
        <div className="p-6">
            <AccessTableSkeleton columns={4} />
        </div>
    );
}
