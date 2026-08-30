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
    Input,
    InputField,
    Label,
    MultiSelect
} from '@orthacms/design-system';
import type {
    WebhookEndpoint,
    WebhookEventOption
} from '../../../domain/types/webhook';
import type { ContentTypeOption } from '../../../domain/types/contentTypeOption';
import type { WorkspaceOption } from '../../../domain/types/workspaceOption';
import {
    addContentTypeNames,
    contentTypeChoices,
    grantedContentTypes,
    parseContentTypeNames
} from '../../../domain/contentTypeChoices';
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
        defaultMessage: 'Every content type, including ones added later'
    },
    contentTypesPlaceholder: {
        id: 'webhooks.form.contentTypesPlaceholder',
        defaultMessage: 'Choose content types'
    },
    contentTypesHint: {
        id: 'webhooks.form.contentTypesHint',
        defaultMessage:
            'Pick from the types this build defines, or add one by machine name — a type you are about to create can be subscribed to before it exists.'
    },
    noContentTypes: {
        id: 'webhooks.form.noContentTypes',
        defaultMessage:
            'Nothing chosen yet, so this endpoint still receives every type.'
    },
    addContentType: {
        id: 'webhooks.form.addContentType',
        defaultMessage: 'Add a type that isn’t listed'
    },
    addContentTypePlaceholder: {
        id: 'webhooks.form.addContentTypePlaceholder',
        defaultMessage: 'article'
    },
    add: { id: 'webhooks.form.add', defaultMessage: 'Add' },
    unknownContentType: {
        id: 'webhooks.form.unknownContentType',
        defaultMessage: '{name} (not defined here)'
    },
    contentTypesNeedWorkspace: {
        id: 'webhooks.form.contentTypesNeedWorkspace',
        defaultMessage:
            'Choose a workspace first — which types exist depends on what those workspaces were granted.'
    },
    contentTypesNoneGranted: {
        id: 'webhooks.form.contentTypesNoneGranted',
        defaultMessage:
            'The chosen workspaces were granted no content types, so there is nothing to pick. A name can still be added by hand.'
    },
    contentTypesScoped: {
        id: 'webhooks.form.contentTypesScoped',
        defaultMessage: 'Listing only what the chosen workspaces were granted.'
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
    allContentTypes: boolean;
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
        // Same reasoning as events: a subscription narrowed to nothing is not
        // a safer one, so the default is the whole registry.
        allContentTypes: true,
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
        allContentTypes: endpoint.contentTypes.length === 0,
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
    contentTypes,
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
    /**
     * The code-defined content types. Empty is a legitimate state — an
     * unreachable catalogue, or a build with no types yet — and the picker
     * still accepts a typed-in machine name.
     */
    contentTypes: ContentTypeOption[];
    pending: boolean;
    /** A server-side refusal to show above the footer (a rejected URL, say). */
    error: string | null;
    onSubmit: (input: SaveWebhookInput) => void;
}) {
    const intl = useIntl();
    const [values, setValues] = useState<WebhookFormValues>(emptyValues);
    const [touched, setTouched] = useState(false);
    /** What is typed into the "add a type that isn't listed" field. */
    const [typeDraft, setTypeDraft] = useState('');
    const contentRef = useRef<HTMLDivElement>(null);

    // Reset whenever the dialog opens, so a cancelled edit is not inherited by
    // the next one — and so "create" never opens on the last endpoint's values.
    useEffect(() => {
        if (open) {
            setValues(endpoint ? valuesOf(endpoint) : emptyValues());
            setTouched(false);
            setTypeDraft('');
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

    // The registry's types plus any selected name it does not know. The unknown
    // ones are labelled as such rather than hidden: an endpoint subscribed to a
    // type that has been removed, or to one with a typo in its name, is
    // receiving nothing and this is the only place that shows.
    // Narrowed to what the chosen workspaces were actually granted: a delivery
    // needs the event's workspace *and* its type to match, so a type none of
    // them can hold would never fire here.
    const offeredContentTypes = useMemo(
        () =>
            grantedContentTypes(contentTypes, workspaces, {
                allWorkspaces: values.allWorkspaces,
                workspaceIds: values.workspaceIds
            }),
        [contentTypes, workspaces, values.allWorkspaces, values.workspaceIds]
    );

    const contentTypeOptions = useMemo(
        () =>
            contentTypeChoices(offeredContentTypes, values.contentTypes).map(
                (choice) => ({
                    value: choice.value,
                    label: choice.known
                        ? choice.label
                        : intl.formatMessage(messages.unknownContentType, {
                              name: choice.value
                          })
                })
            ),
        [offeredContentTypes, values.contentTypes, intl]
    );

    // Which types are on offer is a question about the workspaces, so it cannot
    // be asked before they are chosen. An endpoint that already carries a type
    // filter is the exception — hiding it would leave a saved subscription
    // invisible and uneditable.
    const workspaceChosen =
        values.allWorkspaces || values.workspaceIds.length > 0;
    const contentTypesAnswerable =
        workspaceChosen || values.contentTypes.length > 0;
    // Chosen workspaces that were granted nothing: the picker is empty for a
    // reason worth stating, rather than looking broken.
    const noGrants =
        workspaceChosen &&
        !values.allWorkspaces &&
        offeredContentTypes.length === 0;

    const addTypedContentTypes = () => {
        const names = parseContentTypeNames(typeDraft);
        if (names.length === 0) return;
        setValues((prev) => ({
            ...prev,
            contentTypes: addContentTypeNames(prev.contentTypes, names)
        }));
        setTypeDraft('');
    };

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
            contentTypes: values.allContentTypes ? [] : values.contentTypes
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
                            <>
                                {/* The trigger is a `Button role="combobox"`
                                    showing its own selection, so it has no name
                                    of its own — and a <legend> names the group,
                                    not the control inside it. Without this it
                                    is an unnamed button to a screen reader (axe
                                    `button-name`). */}
                                <Label
                                    htmlFor="webhook-workspaces"
                                    className="sr-only"
                                >
                                    {intl.formatMessage(messages.workspaces)}
                                </Label>
                                <MultiSelect
                                    id="webhook-workspaces"
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
                            </>
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
                            <>
                                <Label
                                    htmlFor="webhook-events"
                                    className="sr-only"
                                >
                                    {intl.formatMessage(messages.events)}
                                </Label>
                                <MultiSelect
                                    id="webhook-events"
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
                            </>
                        ) : null}
                    </fieldset>

                    <fieldset className="flex flex-col gap-2">
                        <legend className="text-sm font-medium">
                            {intl.formatMessage(messages.contentTypes)}
                        </legend>
                        {!contentTypesAnswerable ? (
                            <p className="text-xs text-muted-foreground">
                                {intl.formatMessage(
                                    messages.contentTypesNeedWorkspace
                                )}
                            </p>
                        ) : null}
                        {contentTypesAnswerable ? (
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="webhook-all-content-types"
                                    checked={values.allContentTypes}
                                    onCheckedChange={(checked) =>
                                        setValues((prev) => ({
                                            ...prev,
                                            allContentTypes: checked === true
                                        }))
                                    }
                                />
                                <Label
                                    htmlFor="webhook-all-content-types"
                                    className="text-sm font-normal"
                                >
                                    {intl.formatMessage(
                                        messages.allContentTypes
                                    )}
                                </Label>
                            </div>
                        ) : null}
                        {contentTypesAnswerable && !values.allContentTypes ? (
                            <>
                                <Label
                                    htmlFor="webhook-content-types"
                                    className="sr-only"
                                >
                                    {intl.formatMessage(messages.contentTypes)}
                                </Label>
                                <MultiSelect
                                    id="webhook-content-types"
                                    options={contentTypeOptions}
                                    value={values.contentTypes}
                                    onChange={(next) =>
                                        setValues((prev) => ({
                                            ...prev,
                                            contentTypes: next
                                        }))
                                    }
                                    placeholder={intl.formatMessage(
                                        messages.contentTypesPlaceholder
                                    )}
                                    container={contentRef.current}
                                />
                                <div className="flex items-center gap-2">
                                    <Label
                                        htmlFor="webhook-content-type-add"
                                        className="sr-only"
                                    >
                                        {intl.formatMessage(
                                            messages.addContentType
                                        )}
                                    </Label>
                                    <Input
                                        id="webhook-content-type-add"
                                        value={typeDraft}
                                        placeholder={intl.formatMessage(
                                            messages.addContentTypePlaceholder
                                        )}
                                        className="font-mono text-sm"
                                        onChange={(event) =>
                                            setTypeDraft(event.target.value)
                                        }
                                        onKeyDown={(event) => {
                                            // Enter here means "add this one",
                                            // not "submit the dialog" — the
                                            // footer button is the only way to
                                            // save.
                                            if (event.key === 'Enter') {
                                                event.preventDefault();
                                                addTypedContentTypes();
                                            }
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={addTypedContentTypes}
                                        disabled={
                                            parseContentTypeNames(typeDraft)
                                                .length === 0
                                        }
                                    >
                                        {intl.formatMessage(messages.add)}
                                    </Button>
                                </div>
                                {noGrants ? (
                                    <p className="text-xs text-muted-foreground">
                                        {intl.formatMessage(
                                            messages.contentTypesNoneGranted
                                        )}
                                    </p>
                                ) : null}
                                {!noGrants &&
                                values.contentTypes.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                        {intl.formatMessage(
                                            messages.noContentTypes
                                        )}
                                    </p>
                                ) : null}
                            </>
                        ) : null}
                        {contentTypesAnswerable && !noGrants ? (
                            <p className="text-xs text-muted-foreground">
                                {intl.formatMessage(messages.contentTypesHint)}
                                {!values.allContentTypes &&
                                !values.allWorkspaces &&
                                values.workspaceIds.length > 0
                                    ? ` ${intl.formatMessage(
                                          messages.contentTypesScoped
                                      )}`
                                    : ''}
                            </p>
                        ) : null}
                    </fieldset>

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
