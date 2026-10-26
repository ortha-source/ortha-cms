import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { CornerDownLeft, Mail, Plus, Search } from 'lucide-react';
import { initialsOf } from '@orthacms/utils-admin';
import {
    AVATAR_COLORS,
    Badge,
    cn,
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    Kbd,
    Popover,
    PopoverAnchor,
    PopoverContent,
    Spinner
} from '@orthacms/design-system';
import { useUsersSearch } from '../../../../../application/useUsersSearch';
import type { MemberDraft } from '../../../../../domain/types/wizard';
import { useComboboxList } from '../../../../hooks/useComboboxList';
import { WorkspaceAvatar } from '../../../WorkspaceAvatar';

/** Matches a plausible email address. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const messages = defineMessages({
    popoverLabel: {
        id: 'workspaces.create.members.popoverLabel',
        defaultMessage: 'People search results'
    },
    placeholder: {
        id: 'workspaces.create.members.searchPlaceholder',
        defaultMessage: 'Type a name, or an email to invite'
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
        id: 'workspaces.create.members.inviteByEmail',
        defaultMessage: 'Invite <b>{email}</b> by email'
    },
    label: {
        id: 'workspaces.create.members.searchLabel',
        defaultMessage: 'Add people by name or email'
    },
    results: {
        id: 'workspaces.create.members.resultsAnnouncement',
        defaultMessage:
            '{count, plural, =0 {No people match your search.} one {# person available.} other {# people available.}}'
    },
    inviteAvailable: {
        id: 'workspaces.create.members.inviteAnnouncement',
        defaultMessage: 'No matches. You can invite {email} instead.'
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

    const addUser = (user: {
        id: string;
        name: string;
        email: string;
        role?: string;
    }) => {
        onAdd({
            id: user.id,
            name: user.name,
            email: user.email,
            ...(user.role ? { role: user.role } : {})
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

    // The invite row is the last option when it's offered, so one flat index
    // space covers both kinds and Enter can act on whichever is active.
    const optionCount = results.length + (canInvite ? 1 : 0);
    const selectAt = (index: number) => {
        const user = results[index];
        if (user) {
            addUser(user);
            return;
        }
        if (canInvite) invite();
    };
    const combobox = useComboboxList({
        count: optionCount,
        open,
        onSelect: selectAt,
        onDismiss: () => setQuery('')
    });

    const optionClass = (active: boolean) =>
        cn(
            'flex w-full cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm',
            active && 'bg-accent'
        );

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                if (!next) setQuery('');
            }}
        >
            <PopoverAnchor asChild>
                <InputGroup className="shadow-none">
                    <InputGroupAddon>
                        <Search />
                    </InputGroupAddon>
                    <InputGroupInput
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={combobox.onKeyDown}
                        placeholder={intl.formatMessage(messages.placeholder)}
                        aria-label={intl.formatMessage(messages.label)}
                        role="combobox"
                        aria-expanded={open}
                        aria-controls={combobox.listboxId}
                        aria-activedescendant={combobox.activeId}
                        aria-autocomplete="list"
                        autoComplete="off"
                    />
                    {open ? (
                        <InputGroupAddon align="inline-end">
                            <Kbd aria-hidden>
                                <CornerDownLeft />
                            </Kbd>
                        </InputGroupAddon>
                    ) : null}
                </InputGroup>
            </PopoverAnchor>
            <PopoverContent
                align="start"
                // Keep focus in the input so typing isn't interrupted.
                onOpenAutoFocus={(event) => event.preventDefault()}
                // Radix gives this `role="dialog"`. Focus stays in the input, so
                // the name is rarely announced on entry — but it is what a
                // screen-reader user gets when they navigate *into* the results,
                // and it was a bare "dialog" (`ORT-169`). Named for what the
                // surface holds, not for the field that opened it, which is
                // already named by its own label.
                aria-label={intl.formatMessage(messages.popoverLabel)}
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
                    <ul
                        id={combobox.listboxId}
                        role="listbox"
                        aria-label={intl.formatMessage(messages.label)}
                        className="flex flex-col"
                    >
                        {results.map((user, i) => (
                            <li
                                key={user.id}
                                id={combobox.optionId(i)}
                                role="option"
                                aria-selected={combobox.activeIndex === i}
                                onClick={() => addUser(user)}
                                onMouseEnter={() => combobox.setActiveIndex(i)}
                                className={optionClass(
                                    combobox.activeIndex === i
                                )}
                            >
                                <span aria-hidden>
                                    <WorkspaceAvatar
                                        initials={initialsOf(user.name)}
                                        color={
                                            AVATAR_COLORS[
                                                (i + 3) % AVATAR_COLORS.length
                                            ]
                                        }
                                        className="size-7 rounded-full text-[10px]"
                                    />
                                </span>
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate font-medium">
                                        {user.name}
                                    </span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        {user.email}
                                    </span>
                                </span>
                                {user.role ? (
                                    <Badge variant="outline" size="xs">
                                        {user.role}
                                    </Badge>
                                ) : null}
                                <Plus
                                    aria-hidden
                                    className="size-4 text-muted-foreground"
                                />
                            </li>
                        ))}
                        {canInvite ? (
                            <li
                                id={combobox.optionId(results.length)}
                                role="option"
                                aria-selected={
                                    combobox.activeIndex === results.length
                                }
                                onClick={invite}
                                onMouseEnter={() =>
                                    combobox.setActiveIndex(results.length)
                                }
                                className={optionClass(
                                    combobox.activeIndex === results.length
                                )}
                            >
                                <Mail
                                    aria-hidden
                                    className="size-4 text-muted-foreground"
                                />
                                <span>
                                    {intl.formatMessage(messages.invite, {
                                        email: trimmed.toLowerCase(),
                                        b: (chunks) => (
                                            <b key="b" className="font-medium">
                                                {chunks}
                                            </b>
                                        )
                                    })}
                                </span>
                            </li>
                        ) : null}
                    </ul>
                )}
            </PopoverContent>
            {/* Results arriving in a popover are silent otherwise — the user
                typing an email has no signal that an invite option even exists.
                Held outside the popover so it survives the popover unmounting. */}
            <span role="status" aria-live="polite" className="sr-only">
                {!open || loading
                    ? ''
                    : results.length === 0 && canInvite
                      ? intl.formatMessage(messages.inviteAvailable, {
                            email: trimmed.toLowerCase()
                        })
                      : intl.formatMessage(messages.results, {
                            count: optionCount
                        })}
            </span>
        </Popover>
    );
}
