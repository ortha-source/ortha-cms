import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useQueryClient } from '@tanstack/react-query';
import {
    Button,
    Checkbox,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Label
} from '@orthacms/design-system';
import {
    useWorkspaces,
    workspaceContentAccessRoot,
    workspacesKey
} from '@orthacms/workspaces-admin';
import type { SchemaGateway } from '../../../domain/schemaGateway';
import { httpSchemaGateway } from '../../../infrastructure/httpSchemaGateway';

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
    const active = (workspaces.data ?? []).filter(
        (workspace) => workspace.status === 'Active'
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
            <DialogContent>
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
                <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 text-sm font-medium">
                        {intl.formatMessage(messages.workspaces)}
                    </legend>
                    {active.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            {intl.formatMessage(messages.none)}
                        </p>
                    )}
                    {active.map((workspace) => (
                        <div
                            key={workspace.id}
                            className="flex items-center gap-2"
                        >
                            <Checkbox
                                id={`grant-${workspace.id}`}
                                checked={picked.has(workspace.id)}
                                onCheckedChange={(on) =>
                                    setPicked((previous) => {
                                        const next = new Set(previous);
                                        if (on) next.add(workspace.id);
                                        else next.delete(workspace.id);
                                        return next;
                                    })
                                }
                            />
                            <Label htmlFor={`grant-${workspace.id}`}>
                                {workspace.name}
                            </Label>
                        </div>
                    ))}
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
