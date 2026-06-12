import { defineMessages, useIntl } from 'react-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
    Button,
    Pagination,
    PaginationContent,
    PaginationItem
} from '@ortha-cms/design-system';

/** Intl descriptors for {@link MembersPagination}, co-located with the component. */
const messages = defineMessages({
    previous: {
        id: 'users.pagination.previous',
        defaultMessage: 'Previous page'
    },
    next: {
        id: 'users.pagination.next',
        defaultMessage: 'Next page'
    },
    page: {
        id: 'users.pagination.page',
        defaultMessage: 'Page {page} of {pageCount}'
    }
});

/**
 * Pagination under the table: previous/next buttons around a "Page x of y"
 * readout. Real buttons (not the link-styled pagination anchors) because page
 * state is client state, not a URL — buttons disable cleanly at either end.
 * Hidden entirely when everything fits on one page.
 */
export function MembersPagination({
    page,
    pageCount,
    onPageChange
}: {
    page: number;
    pageCount: number;
    onPageChange: (page: number) => void;
}) {
    const intl = useIntl();

    if (pageCount <= 1) {
        return null;
    }

    return (
        <Pagination className="mt-4">
            <PaginationContent className="gap-3">
                <PaginationItem>
                    <Button
                        variant="outline"
                        size="icon"
                        className="size-8 shadow-none"
                        disabled={page <= 1}
                        onClick={() => onPageChange(page - 1)}
                        aria-label={intl.formatMessage(messages.previous)}
                    >
                        <ChevronLeft />
                    </Button>
                </PaginationItem>
                <PaginationItem>
                    <span className="text-sm text-muted-foreground">
                        {intl.formatMessage(messages.page, {
                            page,
                            pageCount
                        })}
                    </span>
                </PaginationItem>
                <PaginationItem>
                    <Button
                        variant="outline"
                        size="icon"
                        className="size-8 shadow-none"
                        disabled={page >= pageCount}
                        onClick={() => onPageChange(page + 1)}
                        aria-label={intl.formatMessage(messages.next)}
                    >
                        <ChevronRight />
                    </Button>
                </PaginationItem>
            </PaginationContent>
        </Pagination>
    );
}
