import { useId, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
    MultiSelect,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Spinner
} from '@ortha-cms/design-system';
import type { ApiTokenScope } from '../../../domain/types/apiToken';
import type { CreateApiTokenInput } from '../../../infrastructure/apiTokenGateway';
import { useWorkspaceOptions } from '../../../application/useWorkspaceOptions';

const messages = defineMessages({
    title: {
        id: 'apiTokens.create.title',
        defaultMessage: 'New API token'
    },
    description: {
        id: 'apiTokens.create.description',
        defaultMessage:
            'The token grants API access to the content of every workspace you pick.'
    },
    nameLabel: { id: 'apiTokens.create.name', defaultMessage: 'Name' },
    namePlaceholder: {
        id: 'apiTokens.create.namePlaceholder',
        defaultMessage: 'e.g. Production website'
    },
    workspaceLabel: {
        id: 'apiTokens.create.workspace',
        defaultMessage: 'Workspaces'
    },
    workspacePlaceholder: {
        id: 'apiTokens.create.workspacePlaceholder',
        defaultMessage: 'Select workspaces'
    },
    workspaceSearch: {
        id: 'apiTokens.create.workspaceSearch',
        defaultMessage: 'Search workspaces…'
    },
    workspaceEmpty: {
        id: 'apiTokens.create.workspaceEmpty',
        defaultMessage: 'No workspaces found.'
    },
    workspaceHint: {
        id: 'apiTokens.create.workspaceHint',
        defaultMessage:
            'Pick one or more. A request names the workspace it targets with the X-Workspace-Id header.'
    },
    scopeLabel: { id: 'apiTokens.create.scope', defaultMessage: 'Access' },
    scopeRead: {
        id: 'apiTokens.create.scopeRead',
        defaultMessage: 'Read-only'
    },
    scopeFull: {
        id: 'apiTokens.create.scopeFull',
        defaultMessage: 'Full access'
    },
    expiryLabel: { id: 'apiTokens.create.expiry', defaultMessage: 'Expires' },
    expiryNever: {
        id: 'apiTokens.create.expiryNever',
        defaultMessage: 'Never'
    },
    expiry30: { id: 'apiTokens.create.expiry30', defaultMessage: '30 days' },
    expiry90: { id: 'apiTokens.create.expiry90', defaultMessage: '90 days' },
    expiry365: {
        id: 'apiTokens.create.expiry365',
        defaultMessage: '1 year'
    },
    cancel: { id: 'apiTokens.create.cancel', defaultMessage: 'Cancel' },
    submit: { id: 'apiTokens.create.submit', defaultMessage: 'Create token' }
});

/** Expiry presets (in days); `never` maps to no expiry. */
type ExpiryPreset = 'never' | '30' | '90' | '365';

/** Turns an expiry preset into an ISO timestamp, or `undefined` for never. */
function expiryToIso(preset: ExpiryPreset): string | undefined {
    if (preset === 'never') {
        return undefined;
    }
    const days = Number(preset);
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * The create-token form. The parent owns `open` and the mutation; on submit it
 * receives a ready-to-send {@link CreateApiTokenInput} (expiry already resolved
 * to an ISO string). The workspace selector is fed by `GET /api/workspaces`, so
 * the page itself needs no workspace context.
 */
export function CreateApiTokenDialog({
    open,
    onOpenChange,
    onSubmit,
    submitting
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (input: CreateApiTokenInput) => void;
    submitting: boolean;
}) {
    const intl = useIntl();
    const nameId = useId();
    const workspacesId = useId();
    const workspacesHintId = useId();
    const { data: workspaces = [] } = useWorkspaceOptions(open);

    const [name, setName] = useState('');
    const [workspaceIds, setWorkspaceIds] = useState<string[]>([]);
    const [scope, setScope] = useState<ApiTokenScope>('read');
    const [expiry, setExpiry] = useState<ExpiryPreset>('never');

    const reset = () => {
        setName('');
        setWorkspaceIds([]);
        setScope('read');
        setExpiry('never');
    };

    // The server rejects an empty bucket (400), so the form does too.
    const canSubmit = name.trim().length > 0 && workspaceIds.length > 0;

    const submit = () => {
        if (!canSubmit) {
            return;
        }
        onSubmit({
            name: name.trim(),
            workspaceIds,
            scope,
            expiresAt: expiryToIso(expiry)
        });
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    reset();
                }
                onOpenChange(next);
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {intl.formatMessage(messages.title)}
                    </DialogTitle>
                    <DialogDescription>
                        {intl.formatMessage(messages.description)}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor={nameId}>
                            {intl.formatMessage(messages.nameLabel)}
                        </Label>
                        <Input
                            id={nameId}
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder={intl.formatMessage(
                                messages.namePlaceholder
                            )}
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor={workspacesId}>
                            {intl.formatMessage(messages.workspaceLabel)}
                        </Label>
                        <MultiSelect
                            id={workspacesId}
                            options={workspaces.map((workspace) => ({
                                value: workspace.id,
                                label: workspace.name
                            }))}
                            value={workspaceIds}
                            onChange={setWorkspaceIds}
                            placeholder={intl.formatMessage(
                                messages.workspacePlaceholder
                            )}
                            searchPlaceholder={intl.formatMessage(
                                messages.workspaceSearch
                            )}
                            emptyText={intl.formatMessage(
                                messages.workspaceEmpty
                            )}
                            aria-describedby={workspacesHintId}
                            className="w-full"
                        />
                        <p
                            id={workspacesHintId}
                            className="text-xs text-muted-foreground"
                        >
                            {intl.formatMessage(messages.workspaceHint)}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>{intl.formatMessage(messages.scopeLabel)}</Label>
                        <Select
                            value={scope}
                            onValueChange={(value) =>
                                setScope(value as ApiTokenScope)
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="read">
                                    {intl.formatMessage(messages.scopeRead)}
                                </SelectItem>
                                <SelectItem value="full">
                                    {intl.formatMessage(messages.scopeFull)}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>
                            {intl.formatMessage(messages.expiryLabel)}
                        </Label>
                        <Select
                            value={expiry}
                            onValueChange={(value) =>
                                setExpiry(value as ExpiryPreset)
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="never">
                                    {intl.formatMessage(messages.expiryNever)}
                                </SelectItem>
                                <SelectItem value="30">
                                    {intl.formatMessage(messages.expiry30)}
                                </SelectItem>
                                <SelectItem value="90">
                                    {intl.formatMessage(messages.expiry90)}
                                </SelectItem>
                                <SelectItem value="365">
                                    {intl.formatMessage(messages.expiry365)}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={submitting}
                    >
                        {intl.formatMessage(messages.cancel)}
                    </Button>
                    <Button
                        onClick={submit}
                        disabled={!canSubmit || submitting}
                    >
                        {submitting ? <Spinner /> : null}
                        {intl.formatMessage(messages.submit)}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
