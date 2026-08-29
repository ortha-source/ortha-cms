import { useEffect, useMemo, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Alert,
    AlertDescription,
    Button,
    Checkbox,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    InputField,
    Label,
    MultiSelect
} from '@orthacms/design-system';
import type {
    WebhookEndpoint,
    WebhookEventOption
} from '../../../domain/types/webhook';
import type { WorkspaceOption } from '../../../domain/types/workspaceOption';
import type { SaveWebhookInput } from '../../../infrastructure/webhookGateway';

const messages = defineMessages({
    createTitle: {
        id: 'webhooks.form.createTitle',
        defaultMessage: 'New webhook'
    },
    editTitle: {
        id: 'webhooks.form.editTitle',
        defaultMessage: 'Edit webhook'
    },
    description: {
        id: 'webhooks.form.description',
        defaultMessage:
            'Choose where deliveries go and which changes are worth sending.'
    },
    name: { id: 'webhooks.form.name', defaultMessage: 'Name' },
    namePlaceholder: {
        id: 'webhooks.form.namePlaceholder',
        defaultMessage: 'Rebuild the storefront'
    },
    url: { id: 'webhooks.form.url', defaultMessage: 'URL' },
    urlHint: {
        id: 'webhooks.form.urlHint',
        defaultMessage: 'Must be https:// and reachable on the public internet.'
    },
    workspaces: {
        id: 'webhooks.form.workspaces',
        defaultMessage: 'Workspaces'
    },
    allWorkspaces: {
        id: 'webhooks.form.allWorkspaces',
        defaultMessage: 'All workspaces, including ones created later'
    },
    workspacesHint: {
        id: 'webhooks.form.workspacesHint',
        defaultMessage:
            'A record that belongs to no workspace is only sent to endpoints that take them all.'
    },
    workspacesPlaceholder: {
        id: 'webhooks.form.workspacesPlaceholder',
        defaultMessage: 'Choose workspaces'
    },
    events: { id: 'webhooks.form.events', defaultMessage: 'Events' },
    allEvents: {
        id: 'webhooks.form.allEvents',
        defaultMessage: 'Every event, including ones added later'
    },
    eventsPlaceholder: {
        id: 'webhooks.form.eventsPlaceholder',
        defaultMessage: 'Choose events'
    },
    contentTypes: {
        id: 'webhooks.form.contentTypes',
        defaultMessage: 'Content types'
    },
    allContentTypes: {
        id: 'webhooks.form.allContentTypes',
        defaultMessage: 'Every content type'
    },
    contentTypesHint: {
        id: 'webhooks.form.contentTypesHint',
        defaultMessage:
            'One per line, using the machine name — for example, article.'
    },
    enabled: {
        id: 'webhooks.form.enabled',
        defaultMessage: 'Send deliveries to this endpoint'
    },
    save: { id: 'webhooks.form.save', defaultMessage: 'Save' },
    create: { id: 'webhooks.form.create', defaultMessage: 'Create webhook' },
    cancel: { id: 'webhooks.form.cancel', defaultMessage: 'Cancel' },
    nameRequired: {
        id: 'webhooks.form.nameRequired',
        defaultMessage: 'Give the webhook a name.'
    },
    urlRequired: {
        id: 'webhooks.form.urlRequired',
        defaultMessage: 'Enter the URL deliveries should be posted to.'
    },
    noWorkspaces: {
        id: 'webhooks.form.noWorkspaces',
        defaultMessage:
            'Choose at least one workspace, or switch on “All workspaces”. As it stands this endpoint would receive nothing.'
    }
});

/** What the dialog is currently editing. */
export type WebhookFormValues = {
    name: string;
    url: string;
    enabled: boolean;
    allWorkspaces: boolean;
    workspaceIds: string[];
    allEvents: boolean;
    eventKinds: string[];
    contentTypes: string[];
};

/** The values a fresh dialog opens with. */
function emptyValues(): WebhookFormValues {
    return {
        name: '',
        url: '',
        enabled: true,
        // Defaults to false: reaching across every workspace should be
        // something someone chose, not something they forgot to narrow.
        allWorkspaces: false,
        workspaceIds: [],
        // Defaults to true, for the opposite reason: an endpoint that takes no
        // events is not a safer endpoint, it is a broken one.
        allEvents: true,
        eventKinds: [],
        contentTypes: []
    };
}

/** An existing endpoint, as the form edits it. */
function valuesOf(endpoint: WebhookEndpoint): WebhookFormValues {
    return {
        name: endpoint.name,
        url: endpoint.url,
        enabled: endpoint.enabled,
        allWorkspaces: endpoint.allWorkspaces,
        workspaceIds: endpoint.workspaceIds,
        allEvents: endpoint.eventKinds.length === 0,
        eventKinds: endpoint.eventKinds,
        contentTypes: endpoint.contentTypes
    };
}

/**
 * Create and edit an endpoint.
 *
 * The three filters are each an "All…" toggle over a picker, and the toggle is
 * not cosmetic: it is the difference between "everything, including what does
 * not exist yet" and an enumerated list that silently stops covering the next
 * workspace or event kind. Turning one on sends **no** value for that filter,
 * which is exactly how the server reads "all".
 */
export function WebhookFormDialog({
    open,
    onOpenChange,
    endpoint,
    events,
    workspaces,
    pending,
    error,
    onSubmit
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The endpoint being edited, or `undefined` when creating one. */
    endpoint?: WebhookEndpoint;
    events: WebhookEventOption[];
    workspaces: WorkspaceOption[];
    pending: boolean;
    /** A server-side refusal to show above the footer (a rejected URL, say). */
    error: string | null;
    onSubmit: (input: SaveWebhookInput) => void;
}) {
    const intl = useIntl();
    const [values, setValues] = useState<WebhookFormValues>(emptyValues);
    const [touched, setTouched] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    // Reset whenever the dialog opens, so a cancelled edit is not inherited by
    // the next one — and so "create" never opens on the last endpoint's values.
    useEffect(() => {
        if (open) {
            setValues(endpoint ? valuesOf(endpoint) : emptyValues());
            setTouched(false);
        }
    }, [open, endpoint]);

    const eventOptions = useMemo(
        () =>
            events
                // `ping` is what the Send-test button produces; it is not
                // something an endpoint subscribes to.
                .filter((event) => event.kind !== 'ping')
                .map((event) => ({ value: event.kind, label: event.label })),
        [events]
    );

    const workspaceOptions = useMemo(
        () =>
            workspaces.map((workspace) => ({
                value: workspace.id,
                label: workspace.name
            })),
        [workspaces]
    );

    const nameError =
        touched && values.name.trim().length === 0
            ? intl.formatMessage(messages.nameRequired)
            : undefined;
    const urlError =
        touched && values.url.trim().length === 0
            ? intl.formatMessage(messages.urlRequired)
            : undefined;
    // Not a hard error — the server accepts it — but an endpoint scoped to no
    // workspace receives nothing, which is never what someone meant.
    const emptyWorkspaces =
        !values.allWorkspaces && values.workspaceIds.length === 0;

    const submit = () => {
        setTouched(true);
        if (values.name.trim().length === 0 || values.url.trim().length === 0) {
            return;
        }
        onSubmit({
            name: values.name.trim(),
            url: values.url.trim(),
            enabled: values.enabled,
            allWorkspaces: values.allWorkspaces,
            workspaceIds: values.allWorkspaces ? [] : values.workspaceIds,
            // An empty list is how "all" is spelled on the wire, for both.
            eventKinds: values.allEvents ? [] : values.eventKinds,
            contentTypes: values.contentTypes
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                ref={contentRef}
                className="max-h-[90vh] overflow-y-auto"
            >
                <DialogHeader>
                    <DialogTitle>
                        {intl.formatMessage(
                            endpoint ? messages.editTitle : messages.createTitle
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {intl.formatMessage(messages.description)}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <InputField
                        id="webhook-name"
                        label={intl.formatMessage(messages.name)}
                        value={values.name}
                        placeholder={intl.formatMessage(
                            messages.namePlaceholder
                        )}
                        error={nameError}
                        onChange={(event) =>
                            setValues((prev) => ({
                                ...prev,
                                name: event.target.value
                            }))
                        }
                    />

                    <InputField
                        id="webhook-url"
                        label={intl.formatMessage(messages.url)}
                        value={values.url}
                        type="url"
                        placeholder="https://example.com/hooks/ortha"
                        description={intl.formatMessage(messages.urlHint)}
                        error={urlError}
                        onChange={(event) =>
                            setValues((prev) => ({
                                ...prev,
                                url: event.target.value
                            }))
                        }
                    />

                    <fieldset className="flex flex-col gap-2">
                        <legend className="text-sm font-medium">
                            {intl.formatMessage(messages.workspaces)}
                        </legend>
                        <div className="flex items-center gap-2">
                            {/* The design-system Checkbox is a Radix button
                                (`role="checkbox"`), not a native input, so a
                                wrapping <label> would not name it — it needs an
                                id and an explicit `htmlFor`. */}
                            <Checkbox
                                id="webhook-all-workspaces"
                                checked={values.allWorkspaces}
                                onCheckedChange={(checked) =>
                                    setValues((prev) => ({
                                        ...prev,
                                        allWorkspaces: checked === true
                                    }))
                                }
                            />
                            <Label
                                htmlFor="webhook-all-workspaces"
                                className="text-sm font-normal"
                            >
                                {intl.formatMessage(messages.allWorkspaces)}
                            </Label>
                        </div>
                        {!values.allWorkspaces ? (
                            <MultiSelect
                                options={workspaceOptions}
                                value={values.workspaceIds}
                                onChange={(next) =>
                                    setValues((prev) => ({
                                        ...prev,
                                        workspaceIds: next
                                    }))
                                }
                                placeholder={intl.formatMessage(
                                    messages.workspacesPlaceholder
                                )}
                                // The dialog locks scrolling, so the popover has
                                // to portal inside it or its list will not
                                // respond to the wheel.
                                container={contentRef.current}
                            />
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                            {intl.formatMessage(messages.workspacesHint)}
                        </p>
                        {emptyWorkspaces ? (
                            <p className="text-xs text-destructive">
                                {intl.formatMessage(messages.noWorkspaces)}
                            </p>
                        ) : null}
                    </fieldset>

                    <fieldset className="flex flex-col gap-2">
                        <legend className="text-sm font-medium">
                            {intl.formatMessage(messages.events)}
                        </legend>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="webhook-all-events"
                                checked={values.allEvents}
                                onCheckedChange={(checked) =>
                                    setValues((prev) => ({
                                        ...prev,
                                        allEvents: checked === true
                                    }))
                                }
                            />
                            <Label
                                htmlFor="webhook-all-events"
                                className="text-sm font-normal"
                            >
                                {intl.formatMessage(messages.allEvents)}
                            </Label>
                        </div>
                        {!values.allEvents ? (
                            <MultiSelect
                                options={eventOptions}
                                value={values.eventKinds}
                                onChange={(next) =>
                                    setValues((prev) => ({
                                        ...prev,
                                        eventKinds: next
                                    }))
                                }
                                placeholder={intl.formatMessage(
                                    messages.eventsPlaceholder
                                )}
                                container={contentRef.current}
                            />
                        ) : null}
                    </fieldset>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="webhook-content-types">
                            {intl.formatMessage(messages.contentTypes)}
                        </Label>
                        <textarea
                            id="webhook-content-types"
                            rows={2}
                            value={values.contentTypes.join('\n')}
                            placeholder={intl.formatMessage(
                                messages.allContentTypes
                            )}
                            onChange={(event) =>
                                setValues((prev) => ({
                                    ...prev,
                                    contentTypes: event.target.value
                                        .split('\n')
                                        .map((line) => line.trim())
                                        .filter(Boolean)
                                }))
                            }
                            className="rounded-md border bg-transparent px-3 py-2 font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                            {intl.formatMessage(messages.contentTypesHint)}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="webhook-enabled"
                            checked={values.enabled}
                            onCheckedChange={(checked) =>
                                setValues((prev) => ({
                                    ...prev,
                                    enabled: checked === true
                                }))
                            }
                        />
                        <Label
                            htmlFor="webhook-enabled"
                            className="text-sm font-normal"
                        >
                            {intl.formatMessage(messages.enabled)}
                        </Label>
                    </div>

                    {error ? (
                        <Alert variant="destructive" role="alert">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : null}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        {intl.formatMessage(messages.cancel)}
                    </Button>
                    <Button onClick={submit} disabled={pending}>
                        {intl.formatMessage(
                            endpoint ? messages.save : messages.create
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
