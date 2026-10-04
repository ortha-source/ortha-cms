import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input
} from '@orthacms/design-system';
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
        id: 'schemaBuilder.grant.title',
        defaultMessage:
            'Use the new {count, plural, one {type} other {types}} in workspaces'
    },
    description: {
        id: 'schemaBuilder.grant.description',
        defaultMessage:
            '{types} {count, plural, one {exists} other {exist}} now, granted to no workspace. Pick where people should be able to author it.'
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
    selected: {
        id: 'schemaBuilder.grant.selected',
        defaultMessage:
            '{count, plural, =0 {None selected} one {# selected} other {# selected}}'
    },
    selectShown: {
        id: 'schemaBuilder.grant.selectShown',
        defaultMessage: 'Select all shown'
    },
    clear: { id: 'schemaBuilder.grant.clear', defaultMessage: 'Clear' },
    grant: { id: 'schemaBuilder.grant.grant', defaultMessage: 'Grant' },
    skip: { id: 'schemaBuilder.grant.skip', defaultMessage: 'Not now' },
    failed: {
        id: 'schemaBuilder.grant.failed',
        defaultMessage: 'Some grants failed: {message}'
    }
});

type Props = {
    types: readonly string[];
    onClose: () => void;
    gateway?: SchemaGateway;
};

/**
 * [schema-builder:I-11] A new type is granted to no workspace implicitly: this
 * offers it, after the apply, through the workspaces API — with "Not now" as
 * an equal answer.
 */
export function GrantNewTypeDialog({
    types,
    onClose,
    gateway = httpSchemaGateway
}: Props) {
    const intl = useIntl();
    const queryClient = useQueryClient();
    const workspaces = useWorkspaces();
    const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
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
    const selectShown = () =>
        setPicked(
            (previous) =>
                new Set([
                    ...previous,
                    ...shown.map((workspace) => workspace.id)
                ])
        );

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
        else onClose();
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {intl.formatMessage(messages.title, {
                            count: types.length
                        })}
                    </DialogTitle>
                    <DialogDescription>
                        {intl.formatMessage(messages.description, {
                            types: types.join(', '),
                            count: types.length
                        })}
                    </DialogDescription>
                </DialogHeader>
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
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span aria-live="polite">
                                    {intl.formatMessage(messages.selected, {
                                        count: picked.size
                                    })}
                                </span>
                                <span className="flex gap-1">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={selectShown}
                                        disabled={shown.length === 0}
                                    >
                                        {intl.formatMessage(
                                            messages.selectShown
                                        )}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setPicked(new Set())}
                                        disabled={picked.size === 0}
                                    >
                                        {intl.formatMessage(messages.clear)}
                                    </Button>
                                </span>
                            </div>
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
                                            onToggle={() =>
                                                toggle(workspace.id)
                                            }
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </fieldset>
                {error !== null && (
                    <p role="alert" className="text-sm text-destructive">
                        {intl.formatMessage(messages.failed, {
                            message: error
                        })}
                    </p>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        {intl.formatMessage(messages.skip)}
                    </Button>
                    <Button
                        onClick={() => void grant()}
                        disabled={picked.size === 0 || busy}
                    >
                        {intl.formatMessage(messages.grant)}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
