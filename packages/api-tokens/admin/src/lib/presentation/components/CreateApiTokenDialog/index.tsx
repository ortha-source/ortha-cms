import { useEffect, useId, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Alert,
    AlertDescription,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
    SegmentedControl,
    SegmentedControlItem,
    Spinner
} from '@orthacms/design-system';
import type { ApiTokenScope } from '../../../domain/types/apiToken';
import {
    DEFAULT_EXPIRY_PRESET,
    EXPIRING_SOON_DAYS,
    EXPIRY_PRESETS,
    expiryFromPreset,
    type ExpiryPreset
} from '../../../domain/apiTokenExpiry';
import type { CreateApiTokenInput } from '../../../infrastructure/apiTokenGateway';
import { useWorkspaceOptions } from '../../../application/useWorkspaceOptions';
import { WorkspacePicker } from '../WorkspacePicker';
import { AccessChoice } from '../AccessChoice';

/** The server's cap on a token name (`CreateApiTokenDto`). */
export const NAME_MAX_LENGTH = 120;

const messages = defineMessages({
    title: {
        id: 'apiTokens.create.title',
        defaultMessage: 'New API token'
    },
    description: {
        id: 'apiTokens.create.description',
        defaultMessage:
            'For a site, an app or a build that reads content through the API.'
    },
    nameLabel: { id: 'apiTokens.create.name', defaultMessage: 'Name' },
    namePlaceholder: {
        id: 'apiTokens.create.namePlaceholder',
        defaultMessage: 'e.g. Production website'
    },
    nameHint: {
        id: 'apiTokens.create.nameHint',
        defaultMessage: 'So you can tell it apart later.'
    },
    workspaceLabel: {
        id: 'apiTokens.create.workspace',
        defaultMessage: 'Workspaces'
    },
    workspaceError: {
        id: 'apiTokens.create.workspaceError',
        defaultMessage:
            'Couldn’t load the workspaces. Without them a token can’t be scoped, so try again before creating one.'
    },
    workspaceRetry: {
        id: 'apiTokens.create.workspaceRetry',
        defaultMessage: 'Retry'
    },
    workspaceHint: {
        id: 'apiTokens.create.workspaceHint',
        defaultMessage: 'Requests name one of these in the {header} header.'
    },
    scopeLabel: { id: 'apiTokens.create.scope', defaultMessage: 'Access' },
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
    expiryOn: {
        id: 'apiTokens.create.expiryOn',
        defaultMessage: 'On {date}. We flag it {days} days before.'
    },
    expiryNeverHint: {
        id: 'apiTokens.create.expiryNeverHint',
        defaultMessage: 'It keeps working until someone revokes it.'
    },
    cancel: { id: 'apiTokens.create.cancel', defaultMessage: 'Cancel' },
    submit: { id: 'apiTokens.create.submit', defaultMessage: 'Create token' }
});

const PRESET_LABEL: Record<ExpiryPreset, keyof typeof messages> = {
    never: 'expiryNever',
    '30': 'expiry30',
    '90': 'expiry90',
    '365': 'expiry365'
};

/**
 * The `*` beside a required field's label. Decorative: the control itself
 * carries `aria-required`, which is what a screen reader announces.
 */
function RequiredMark() {
    return (
        <span aria-hidden className="text-destructive">
            *
        </span>
    );
}

/**
 * The create-token form: a name, the workspaces it may act in (chips), the
 * access level as two cards, and an expiry preset that turns into a date
 * before you submit. The parent owns `open` and the mutation; on submit it
 * receives a ready-to-send {@link CreateApiTokenInput} (expiry already resolved
 * to an ISO string). The workspace list is fed by `GET /api/workspaces`, so the
 * page itself needs no workspace context.
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
    const nameHintId = useId();
    const workspacesId = useId();
    const workspacesLabelId = useId();
    const workspacesHintId = useId();
    const scopeId = useId();
    const scopeLabelId = useId();
    const expiryLabelId = useId();
    const expiryHintId = useId();
    // The dialog's element. Radix Dialog scroll-locks the page while open, so
    // the workspace picker's popover must portal INTO it or its list won't
    // scroll by mouse wheel — the same reason the relation picker and the
    // records filter drawer capture theirs.
    const [dialogEl, setDialogEl] = useState<HTMLDivElement | null>(null);
    const {
        data: workspaces = [],
        isError: workspacesFailed,
        refetch: refetchWorkspaces
    } = useWorkspaceOptions(open);

    const [name, setName] = useState('');
    const [workspaceIds, setWorkspaceIds] = useState<string[]>([]);
    const [scope, setScope] = useState<ApiTokenScope>('read');
    const [expiry, setExpiry] = useState<ExpiryPreset>(DEFAULT_EXPIRY_PRESET);

    const reset = () => {
        setName('');
        setWorkspaceIds([]);
        setScope('read');
        setExpiry(DEFAULT_EXPIRY_PRESET);
    };

    // The server rejects an empty bucket (400), so the form does too.
    const canSubmit = name.trim().length > 0 && workspaceIds.length > 0;

    const submit = () => {
        if (!canSubmit) {
            return;
        }
        // Resolved at submit, not at render: a dialog left open over lunch
        // must not mint a token that expires an hour early.
        const expiresAt = expiryFromPreset(expiry);
        onSubmit({
            name: name.trim(),
            workspaceIds,
            scope,
            expiresAt: expiresAt ? expiresAt.toISOString() : undefined
        });
    };

    // Reset on the way *in*, not only on the way out. Closing happens four
    // ways and one of them — a successful mint — flips the controlled `open`
    // prop from the page, which never reaches Radix's `onOpenChange`. Keying
    // off the opening edge is the one place that catches every path, so the
    // dialog cannot present a previous draft as a fresh form.
    const wasOpen = useRef(open);
    useEffect(() => {
        if (open && !wasOpen.current) {
            reset();
        }
        wasOpen.current = open;
    });

    /** The one way out of this dialog, so every path resets the form. */
    const requestClose = () => {
        reset();
        onOpenChange(false);
    };

    const expiresOn = expiryFromPreset(expiry);

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
            <DialogContent
                ref={setDialogEl}
                className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[620px]"
            >
                <DialogHeader>
                    <DialogTitle>
                        {intl.formatMessage(messages.title)}
                    </DialogTitle>
                    <DialogDescription>
                        {intl.formatMessage(messages.description)}
                    </DialogDescription>
                </DialogHeader>

                <form
                    id={`${nameId}-form`}
                    className="space-y-5"
                    onSubmit={(event) => {
                        event.preventDefault();
                        submit();
                    }}
                >
                    <div className="space-y-2">
                        <Label htmlFor={nameId}>
                            {intl.formatMessage(messages.nameLabel)}
                            <RequiredMark />
                        </Label>
                        <Input
                            id={nameId}
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder={intl.formatMessage(
                                messages.namePlaceholder
                            )}
                            maxLength={NAME_MAX_LENGTH}
                            aria-required
                            aria-describedby={nameHintId}
                            autoComplete="off"
                            autoFocus
                        />
                        <p
                            id={nameHintId}
                            className="text-xs text-muted-foreground"
                        >
                            {intl.formatMessage(messages.nameHint)}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label id={workspacesLabelId} htmlFor={workspacesId}>
                            {intl.formatMessage(messages.workspaceLabel)}
                            <RequiredMark />
                        </Label>
                        <WorkspacePicker
                            id={workspacesId}
                            labelId={workspacesLabelId}
                            describedBy={workspacesHintId}
                            options={workspaces}
                            value={workspaceIds}
                            onChange={setWorkspaceIds}
                            container={dialogEl}
                        />
                        <p
                            id={workspacesHintId}
                            className="text-xs text-muted-foreground"
                        >
                            {intl.formatMessage(messages.workspaceHint, {
                                header: (
                                    <code
                                        key="header"
                                        className="font-mono text-[11px]"
                                    >
                                        X-Workspace-Id
                                    </code>
                                )
                            })}
                        </p>
                        {/* A failed workspace fetch leaves the picker empty,
                            which reads exactly like a deployment with no
                            workspaces — so the admin would think there is
                            nothing to pick rather than that the list failed.
                            Say which it is, and offer the retry. */}
                        {workspacesFailed ? (
                            <Alert variant="destructive" role="alert">
                                <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                                    <span>
                                        {intl.formatMessage(
                                            messages.workspaceError
                                        )}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="shadow-none"
                                        onClick={() => refetchWorkspaces()}
                                    >
                                        {intl.formatMessage(
                                            messages.workspaceRetry
                                        )}
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        ) : null}
                    </div>

                    <div className="space-y-2">
                        <Label id={scopeLabelId} htmlFor={`${scopeId}-read`}>
                            {intl.formatMessage(messages.scopeLabel)}
                        </Label>
                        <AccessChoice
                            id={scopeId}
                            labelId={scopeLabelId}
                            value={scope}
                            onChange={setScope}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label id={expiryLabelId}>
                            {intl.formatMessage(messages.expiryLabel)}
                        </Label>
                        <SegmentedControl
                            variant="field"
                            className="self-start"
                            aria-labelledby={expiryLabelId}
                            aria-describedby={expiryHintId}
                            value={expiry}
                            // Radix single-toggle emits '' when the lit
                            // segment is pressed again; an expiry is never
                            // unset, so ignore it.
                            onValueChange={(value) => {
                                if (value) {
                                    setExpiry(value as ExpiryPreset);
                                }
                            }}
                        >
                            {EXPIRY_PRESETS.map((preset) => (
                                <SegmentedControlItem
                                    key={preset}
                                    value={preset}
                                >
                                    {intl.formatMessage(
                                        messages[PRESET_LABEL[preset]]
                                    )}
                                </SegmentedControlItem>
                            ))}
                        </SegmentedControl>
                        <p
                            id={expiryHintId}
                            className="text-xs text-muted-foreground"
                        >
                            {expiresOn
                                ? intl.formatMessage(messages.expiryOn, {
                                      date: intl.formatDate(expiresOn, {
                                          dateStyle: 'medium'
                                      }),
                                      days: EXPIRING_SOON_DAYS
                                  })
                                : intl.formatMessage(messages.expiryNeverHint)}
                        </p>
                    </div>
                </form>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        // `requestClose`, not `onOpenChange` directly: the reset
                        // lives in the Dialog's own handler, which Esc, the
                        // backdrop and the corner X all go through — and this
                        // button did not, so Cancel left the name, workspaces,
                        // scope and expiry in place for the next open.
                        onClick={requestClose}
                        disabled={submitting}
                    >
                        {intl.formatMessage(messages.cancel)}
                    </Button>
                    <Button
                        type="submit"
                        form={`${nameId}-form`}
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
