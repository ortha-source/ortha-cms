import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { UserPlus } from 'lucide-react';
import { useHasPermission } from '@ortha-cms/identity-admin';
import {
    Button,
    Container,
    ContainerHeader,
    Spinner
} from '@ortha-cms/design-system';
import { useMembers } from '../../api/useMembers';
import { DEFAULT_PAGE_SIZE } from '../../api/membersApi';
import { EditMemberDialog } from '../../components/EditMemberDialog';
import { MembersEmpty } from '../../components/MembersEmpty';
import { MembersNoAccess } from '../../components/MembersNoAccess';
import { MembersPagination } from '../../components/MembersPagination';
import { MembersTable } from '../../components/MembersTable';
import { MembersToolbar } from '../../components/MembersToolbar';
import { useDebouncedValue } from '../../utils/useDebouncedValue';
import type { Member } from '../../types/member';

/** Intl descriptors for {@link MembersPage}, co-located with the component. */
const messages = defineMessages({
    title: {
        id: 'users.page.title',
        defaultMessage: 'Members'
    },
    subtitle: {
        id: 'users.page.subtitle',
        defaultMessage:
            '{count, plural, one {# person} other {# people}} who can sign in to this workspace.'
    },
    invite: {
        id: 'users.page.invite',
        defaultMessage: 'Invite member'
    }
});

/** Debounce window for the search box, so a keystroke burst issues one query. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The Members management page: a searchable, paginated table of everyone who
 * can sign in, with invite / edit / role / status controls gated on the
 * signed-in user's `users:*` permissions. Rendered at `/users` inside the
 * authenticated shell.
 *
 * Gated on `users:read`: without it the page shows a no-access state and
 * fetches nothing (the server would refuse the request anyway).
 */
export function MembersPage() {
    const intl = useIntl();
    const navigate = useNavigate();
    const canRead = useHasPermission('users:read');
    const canInvite = useHasPermission('users:create');

    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

    const [editing, setEditing] = useState<Member | null>(null);

    const { data, isPending, isError } = useMembers(
        { search: debouncedSearch || undefined, page, pageSize },
        canRead
    );

    if (!canRead) {
        return (
            <Container>
                <ContainerHeader title={intl.formatMessage(messages.title)} />
                <MembersNoAccess />
            </Container>
        );
    }

    const total = data?.total ?? 0;
    // The server echoes the effective page size; fall back to the requested one
    // until the first response lands.
    const effectivePageSize = data?.pageSize ?? pageSize;
    const pageCount = Math.max(1, Math.ceil(total / effectivePageSize));
    const members = data?.items ?? [];
    const hasSearch = debouncedSearch.trim().length > 0;

    const changeSearch = (value: string) => {
        setSearch(value);
        // A narrowed result set may have fewer pages than the current one.
        setPage(1);
    };

    const changePageSize = (next: number) => {
        setPageSize(next);
        // A larger page may absorb the current rows; restart from the first.
        setPage(1);
    };

    const openInvite = () => navigate('/users/invite');

    return (
        <Container>
            <ContainerHeader
                title={intl.formatMessage(messages.title)}
                subtitle={intl.formatMessage(messages.subtitle, {
                    count: total
                })}
                actions={
                    canInvite ? (
                        <Button onClick={openInvite}>
                            <UserPlus />
                            {intl.formatMessage(messages.invite)}
                        </Button>
                    ) : undefined
                }
            />

            <MembersToolbar search={search} onSearchChange={changeSearch} />

            {isPending ? (
                <div className="flex justify-center py-16">
                    <Spinner />
                </div>
            ) : isError ? (
                <MembersEmpty
                    filtered={hasSearch}
                    onClear={() => changeSearch('')}
                    onInvite={canInvite ? openInvite : undefined}
                />
            ) : members.length === 0 ? (
                <MembersEmpty
                    filtered={hasSearch}
                    onClear={() => changeSearch('')}
                    onInvite={canInvite ? openInvite : undefined}
                />
            ) : (
                <>
                    <MembersTable members={members} onEdit={setEditing} />
                    <MembersPagination
                        page={page}
                        pageCount={pageCount}
                        pageSize={effectivePageSize}
                        total={total}
                        onPageChange={setPage}
                        onPageSizeChange={changePageSize}
                    />
                </>
            )}

            <EditMemberDialog
                member={editing}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditing(null);
                    }
                }}
            />
        </Container>
    );
}
