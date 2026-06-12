import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Mail, Plus, Search } from 'lucide-react';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    Popover,
    PopoverAnchor,
    PopoverContent,
    Spinner
} from '@ortha-cms/design-system';
import { useUsersSearch } from '../../../../api/useUsersSearch';
import type { MemberDraft } from '../../../../types/wizard';

/** Matches a plausible email address. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const messages = defineMessages({
    placeholder: {
        id: 'workspaces.create.members.searchPlaceholder',
        defaultMessage: 'Add people by name or email'
    },
    searching: {
        id: 'workspaces.create.members.searching',
        defaultMessage: 'Searching…'
    },
    noResults: {
        id: 'workspaces.create.members.noResults',
        defaultMessage: 'No people match your search.'
    },
    invite: {
        id: 'workspaces.create.members.invite',
        defaultMessage: 'Invite {email}'
    }
});

/** Props for {@link MemberTypeahead}. */
export type MemberTypeaheadProps = {
    /** Ids already present (owner + added members) — excluded from results. */
    excludeIds: Set<string>;
    /** Add a member (existing user or invited email). */
    onAdd: (member: MemberDraft) => void;
};

/**
 * Searchable input that adds people to the workspace. Existing directory users
 * are selected from the results; a typed-in email that isn't in the directory
 * can be invited instead.
 */
export function MemberTypeahead({ excludeIds, onAdd }: MemberTypeaheadProps) {
    const intl = useIntl();
    const [query, setQuery] = useState('');
    const { users, loading } = useUsersSearch(query);

    const trimmed = query.trim();
    const results = users.filter((u) => !excludeIds.has(u.id));
    const isEmail = EMAIL_RE.test(trimmed);
    const emailInDirectory = users.some(
        (u) => u.email.toLowerCase() === trimmed.toLowerCase()
    );
    const canInvite =
        isEmail && !emailInDirectory && !excludeIds.has(trimmed.toLowerCase());

    const open = trimmed.length > 0;

    const addUser = (user: { id: string; name: string; email: string }) => {
        onAdd({
            id: user.id,
            name: user.name,
            email: user.email
        });
        setQuery('');
    };

    const invite = () => {
        const email = trimmed.toLowerCase();
        onAdd({
            id: email,
            name: email,
            email,
            invited: true
        });
        setQuery('');
    };

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                if (!next) setQuery('');
            }}
        >
            <PopoverAnchor asChild>
                <InputGroup>
                    <InputGroupAddon>
                        <Search />
                    </InputGroupAddon>
                    <InputGroupInput
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={intl.formatMessage(messages.placeholder)}
                        autoComplete="off"
                    />
                </InputGroup>
            </PopoverAnchor>
            <PopoverContent
                align="start"
                // Keep focus in the input so typing isn't interrupted.
                onOpenAutoFocus={(event) => event.preventDefault()}
                className="w-[var(--radix-popover-trigger-width)] p-1"
            >
                {loading ? (
                    <p className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
                        <Spinner className="size-3.5" />
                        {intl.formatMessage(messages.searching)}
                    </p>
                ) : results.length === 0 && !canInvite ? (
                    <p className="px-2 py-2 text-sm text-muted-foreground">
                        {intl.formatMessage(messages.noResults)}
                    </p>
                ) : (
                    <ul className="flex flex-col">
                        {results.map((user) => (
                            <li key={user.id}>
                                <button
                                    type="button"
                                    onClick={() => addUser(user)}
                                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                                >
                                    <span className="truncate font-medium">
                                        {user.name}
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        {user.email}
                                    </span>
                                </button>
                            </li>
                        ))}
                        {canInvite ? (
                            <li>
                                <button
                                    type="button"
                                    onClick={invite}
                                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                                >
                                    <Mail className="size-4 text-muted-foreground" />
                                    {intl.formatMessage(messages.invite, {
                                        email: trimmed.toLowerCase()
                                    })}
                                    <Plus className="ml-auto size-4 text-muted-foreground" />
                                </button>
                            </li>
                        ) : null}
                    </ul>
                )}
            </PopoverContent>
        </Popover>
    );
}
