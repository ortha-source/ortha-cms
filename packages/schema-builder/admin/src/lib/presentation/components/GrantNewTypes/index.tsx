import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useQueryClient } from '@tanstack/react-query';
import { CircleCheck, Search } from 'lucide-react';
import { Button, Input } from '@orthacms/design-system';
import {
    useWorkspaces,
    workspaceContentAccessRoot,
    workspacesKey
} from '@orthacms/workspaces-admin';
import type { SchemaGateway } from '../../../domain/schemaGateway';
import { httpSchemaGateway } from '../../../infrastructure/httpSchemaGateway';
import { WorkspaceTile } from './WorkspaceTile';

const messages = defineMessages({
    title: {
        id: 'schemaBuilder.grant.titleNamed',
        defaultMessage: 'Use {types} in workspaces'
    },
    description: {
        id: 'schemaBuilder.grant.descriptionInline',
        defaultMessage:
            '{count, plural, one {A new type belongs} other {New types belong}} to no workspace yet. Pick where people should be able to write {types}.'
    },
    workspaces: {
        id: 'schemaBuilder.grant.workspaces',
        defaultMessage: 'Workspaces'
    },
    none: {
        id: 'schemaBuilder.grant.none',
        defaultMessage: 'There are no workspaces yet.'
    },
    search: {
        id: 'schemaBuilder.grant.search',
        defaultMessage: 'Search workspaces'
    },
    noMatch: {
        id: 'schemaBuilder.grant.noMatch',
        defaultMessage: 'No workspace matches “{query}”.'
    },
    grant: {
        id: 'schemaBuilder.grant.grantCount',
        defaultMessage:
            '{count, plural, =0 {Grant} one {Grant to # workspace} other {Grant to # workspaces}}'
    },
    skip: { id: 'schemaBuilder.grant.skip', defaultMessage: 'Not now' },
    granted: {
        id: 'schemaBuilder.grant.granted',
        defaultMessage:
            '{types} can be used in {count, plural, one {# workspace} other {# workspaces}} now.'
    },
    skipped: {
        id: 'schemaBuilder.grant.skipped',
        defaultMessage:
            'Not granted. A workspace’s settings can add {types} any time.'
    },
    failed: {
        id: 'schemaBuilder.grant.failed',
        defaultMessage: 'Some grants failed: {message}'
    }
});

/** More than this many workspaces, and the card offers a search. */
const SEARCH_FROM = 6;

type Props = {
    /** The created types' names — what is granted. */
    types: readonly string[];
    /** The same types as people read them. */
    labels: readonly string[];
    gateway?: SchemaGateway;
};

/**
 * [schema-builder:I-11] A new type is granted to no workspace implicitly:
 * this offers it, on the applied page itself rather than in a modal over it,
 * through the workspaces API — with "Not now" as an equal answer. Either
 * answer leaves a line saying what happened in its place.
 */
export function GrantNewTypes({
    types,
    labels,
    gateway = httpSchemaGateway
}: Props) {
    const intl = useIntl();
    const queryClient = useQueryClient();
    const workspaces = useWorkspaces();
    const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [answer, setAnswer] = useState<'granted' | 'skipped' | null>(null);
    const [query, setQuery] = useState('');
    const named = intl.formatList(labels, { type: 'conjunction' });
    const active = (workspaces.data ?? []).filter(
        (workspace) => workspace.status === 'Active'
    );
    const needle = query.trim().toLowerCase();
    const shown = needle
        ? active.filter(
              (workspace) =>
                  workspace.name.toLowerCase().includes(needle) ||
                  (workspace.slug ?? '').toLowerCase().includes(needle)
          )
        : active;
    const toggle = (id: string) =>
        setPicked((previous) => {
            const next = new Set(previous);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const grant = async () => {
        setBusy(true);
        setError(null);
        const results = await Promise.allSettled(
            [...picked].flatMap((workspace) =>
                types.map((slug) => gateway.grant(workspace, slug))
            )
        );
        await queryClient.invalidateQueries({ queryKey: workspacesKey });
        await queryClient.invalidateQueries({
            queryKey: workspaceContentAccessRoot
        });
        setBusy(false);
        const failed = results.find((result) => result.status === 'rejected');
        if (failed)
            setError((failed as PromiseRejectedResult).reason?.message ?? '');
        else setAnswer('granted');
    };

    if (answer)
        return (
            <p
                role="status"
                className="flex items-center gap-2 rounded-xl border bg-card px-5 py-4 text-sm shadow-xs"
            >
                <CircleCheck
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                />
                {intl.formatMessage(
                    answer === 'granted' ? messages.granted : messages.skipped,
                    { types: named, count: picked.size }
                )}
            </p>
        );

    return (
        <section
            aria-labelledby="grant-title"
            className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs"
        >
            <div className="flex flex-col gap-1">
                <h2 id="grant-title" className="text-base font-semibold">
                    {intl.formatMessage(messages.title, { types: named })}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {intl.formatMessage(messages.description, {
                        types: named,
                        count: types.length
                    })}
                </p>
            </div>
            <fieldset className="flex min-w-0 flex-col gap-3">
                <legend className="sr-only">
                    {intl.formatMessage(messages.workspaces)}
                </legend>
                {active.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        {intl.formatMessage(messages.none)}
                    </p>
                ) : (
                    <>
                        {active.length > SEARCH_FROM && (
                            <div className="relative">
                                <Search
                                    aria-hidden
                                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                                />
                                <Input
                                    type="search"
                                    value={query}
                                    onChange={(event) =>
                                        setQuery(event.target.value)
                                    }
                                    placeholder={intl.formatMessage(
                                        messages.search
                                    )}
                                    aria-label={intl.formatMessage(
                                        messages.search
                                    )}
                                    className="pl-9"
                                />
                            </div>
                        )}
                        {shown.length === 0 ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">
                                {intl.formatMessage(messages.noMatch, {
                                    query: query.trim()
                                })}
                            </p>
                        ) : (
                            <div className="grid max-h-80 gap-2 overflow-y-auto p-0.5 sm:grid-cols-2">
                                {shown.map((workspace) => (
                                    <WorkspaceTile
                                        key={workspace.id}
                                        workspace={workspace}
                                        selected={picked.has(workspace.id)}
                                        onToggle={() => toggle(workspace.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </fieldset>
            {error !== null && (
                <p role="alert" className="text-sm text-destructive">
                    {intl.formatMessage(messages.failed, { message: error })}
                </p>
            )}
            <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setAnswer('skipped')}>
                    {intl.formatMessage(messages.skip)}
                </Button>
                <Button
                    onClick={() => void grant()}
                    disabled={picked.size === 0 || busy}
                >
                    {intl.formatMessage(messages.grant, {
                        count: picked.size
                    })}
                </Button>
            </div>
        </section>
    );
}
