import { useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    ConfirmDialog,
    toast
} from '@ortha-cms/design-system';
import type {
    ContentField,
    ContentTypeDetail,
    EntryRecord,
    RelationDelta,
    StagedRelation
} from '../../../../domain/types/contentType';
import { useUnsavedChanges } from '@ortha-cms/utils-admin';
import { CONTENT_FIELD_TYPE, ENTRY_TAB } from '../../../../domain/constants';
import { useEntryForm } from '../../../hooks/useEntryForm';
import { useEntrySlotContext } from '../../../hooks/useEntrySlotContext';
import { ENTRY_HEADER_SLOT } from '../../../slots/contentSlots';
import { useEntryRelations } from '../../../../application/useEntryRelations';
import { entryIssuesFrom } from '../../../../infrastructure/entryIssues';
import { fieldLabel } from '../../../../domain/entryColumns';
import { toRelationIds } from '../../../../domain/relationIds';
import { EntryFieldSections } from './EntryFieldSections';
import { EntrySidebar, type PublishGateItem } from './EntrySidebar';
import { HistoryTimeline } from './HistoryTimeline';
import { RelationFieldSection } from './RelationFieldSection';

const messages = defineMessages({
    backToList: {
        id: 'content.editor.backToList',
        defaultMessage: 'Back to records'
    },
    tabGeneral: {
        id: 'content.editor.tabGeneral',
        defaultMessage: 'General'
    },
    tabRelations: {
        id: 'content.editor.tabRelations',
        defaultMessage: 'Relations'
    },
    tabMedia: { id: 'content.editor.tabMedia', defaultMessage: 'Media' },
    tabHistory: {
        id: 'content.editor.tabHistory',
        defaultMessage: 'History'
    },
    relationsEmpty: {
        id: 'content.editor.relationsEmpty',
        defaultMessage: 'This content type has no relation fields.'
    },
    relationsSubtitle: {
        id: 'content.editor.relationsSubtitle',
        defaultMessage:
            'Assign related records and set the order they appear in the delivery API.'
    },
    mediaTitle: { id: 'content.editor.mediaTitle', defaultMessage: 'Media' },
    mediaBody: {
        id: 'content.editor.mediaBody',
        defaultMessage:
            'Image and file fields for this record will appear here once media support lands.'
    },
    relationRequired: {
        id: 'content.editor.relationRequired',
        defaultMessage: 'Needs at least one link'
    },
    sharedSaveTitle: {
        id: 'content.editor.sharedSaveTitle',
        defaultMessage: 'This also changes the other locales'
    },
    sharedSaveBody: {
        id: 'content.editor.sharedSaveBody',
        defaultMessage:
            'You changed {count, plural, one {the shared field “{first}”} other {# shared fields, starting with “{first}”}}. Shared fields aren’t translated — saving applies the new value to every locale of this record, not just this one.'
    },
    sharedSaveConfirm: {
        id: 'content.editor.sharedSaveConfirm',
        defaultMessage: 'Save anyway'
    },
    cancel: { id: 'content.editor.cancel', defaultMessage: 'Cancel' },
    publishBlocked: {
        id: 'content.editor.publishBlocked',
        defaultMessage:
            'Can’t publish — {count, plural, one {# field needs} other {# fields need}} attention. Start with “{field}”.'
    },
    saveBlocked: {
        id: 'content.editor.saveBlocked',
        defaultMessage:
            'Can’t save — {count, plural, one {# field needs} other {# fields need}} attention. Start with “{field}”.'
    }
});

/** A field is hidden when its admin hints say so. */
function isHidden(field: ContentField): boolean {
    return (field.admin as { hidden?: boolean }).hidden === true;
}

/** An untouched relation staging — no pending link/unlink/reorder. */
const EMPTY_STAGED: StagedRelation = { added: [], removed: [], order: null };

/** Stable JSON of a value for dirty comparison (undefined ≡ null). */
const norm = (value: unknown) => JSON.stringify(value ?? null);

/** Whether a relation staging holds any pending change. */
function isStagedDirty(staged: StagedRelation): boolean {
    return (
        staged.added.length > 0 ||
        staged.removed.length > 0 ||
        staged.order !== null
    );
}

/** Serialize a relation staging to the wire delta sent on Save. */
function stagedToWire(staged: StagedRelation): RelationDelta {
    const delta: RelationDelta = {};
    if (staged.added.length) delta.link = staged.added.map((a) => a.id);
    if (staged.removed.length) delta.unlink = staged.removed;
    if (staged.order) delta.order = staged.order;
    return delta;
}

/**
 * The full entry editor: a title header, a tabbed body (**General** = grouped
 * field sections, **Relations** = relation fields, **Media** and **History** =
 * placeholders; all tabs always present), and a single monolithic right
 * {@link EntrySidebar} that owns the Save / Save&Publish / Cancel actions and a
 * collapsible details block. Owns the form state ({@link useEntryForm}) and the
 * `<form>`; persistence is the caller's `onSave`, called with the publish intent
 * so the same editor backs create / edit / single-page modes.
 */
export function EntryEditor({
    schema,
    initialValues,
    entry,
    isCreate,
    publishable,
    title,
    subtitle,
    saving,
    mutating,
    onSave,
    onUnpublish,
    onDelete,
    backTo,
    availableTypeNames,
    tab,
    onTabChange
}: {
    schema: ContentTypeDetail;
    initialValues: Record<string, unknown>;
    entry?: EntryRecord;
    isCreate: boolean;
    publishable: boolean;
    title: string;
    subtitle?: string;
    saving: boolean;
    /** Whether an unpublish/delete action is in flight (disables the rail). */
    mutating?: boolean;
    onSave: (
        values: Record<string, unknown>,
        options: {
            publish: boolean;
            /** Staged many/inverse relation deltas to persist with the save. */
            relations?: Record<string, RelationDelta>;
            /**
             * Fields excluded from client validation (hidden/ungranted relations,
             * link-managed relations), forwarded so the save flow's publish gate
             * judges the same value set the form did.
             */
            ignoreFields?: ReadonlySet<string>;
        }
    ) => Promise<void>;
    /** Revert a published entry to draft — only on a saved publishable entry. */
    onUnpublish?: () => void;
    /** Delete the entry — only on a saved entry. */
    onDelete?: () => void;
    /** Where the "Back to records" link goes; omitted for a single page. */
    backTo?: string;
    /**
     * Content-type names granted to the open workspace. A relation field is shown
     * only when its target is in this set — a relation to a collection the
     * workspace can't access is hidden (you couldn't pick its records anyway).
     * Undefined = unrestricted (show every relation).
     */
    availableTypeNames?: readonly string[];
    /**
     * The open tab, owned by the **route** (`/…/:entryId/relations`) rather than
     * by this component — so it survives the remount a locale switch causes.
     */
    tab: string;
    /** Navigate to another tab (the caller pushes the route). */
    onTabChange: (next: string) => void;
}) {
    const intl = useIntl();
    // Slot-contributed title-row add-ons (e.g. the i18n plugin's locale chip),
    // rendered beside the heading with the surrounding editor's context.
    const slotContext = useEntrySlotContext();
    const headerItems = ENTRY_HEADER_SLOT.getItems();
    // The existing entry's id, or undefined while creating. Many/inverse
    // relations are staged locally either way and sent as a delta on Save.
    const entryId = entry?.id;
    // First page + total per relation field, for the header counts, to title
    // single relations, and to power the required-relation publish gate. Enabled
    // as soon as there's an existing entry — one request per entry open — rather
    // than waiting for the Relations tab: otherwise a populated relation flashes
    // count 0 on first tab open (#6), and the gate can't see the link counts to
    // flag an empty required relation (#1). Create mode has no server set, so the
    // query stays disabled there.
    const relationsQuery = useEntryRelations(schema.name, entryId, !!entryId);
    const relationRefs = relationsQuery.data;
    // True only while the first load is genuinely in flight (never when disabled
    // in create mode) — drives a neutral count affordance instead of a wrong 0.
    const relationsLoading = relationsQuery.isLoading;
    // Per-field staged relation edits (many/inverse), owned here so they survive
    // collapsing a section or switching tabs, and sent as `relations` deltas on
    // Save. Cleared after a successful save.
    const [relationDeltas, setRelationDeltas] = useState<
        Record<string, StagedRelation>
    >({});
    const stagedFor = (name: string): StagedRelation =>
        relationDeltas[name] ?? EMPTY_STAGED;
    const setStaged = (name: string, next: StagedRelation) =>
        setRelationDeltas((current) => ({ ...current, [name]: next }));

    // A scalar/single field is dirty when its value differs from the seed; a
    // many/inverse field is dirty when its staging holds any pending change.
    const isFieldDirty = (name: string) =>
        norm(form.values[name]) !== norm(initialValues[name]);
    const isRelationDirty = (name: string) => isStagedDirty(stagedFor(name));

    // Relation fields hidden because their target collection isn't granted to the
    // open workspace: their records aren't reachable here, so the editor doesn't
    // render them (see `relationFields`). They must also be excluded from client
    // validation and the publish gate — otherwise a *required* one is an
    // un-satisfiable, invisible block that pins the form shut with no way to fill
    // it. `undefined` availableTypeNames means unrestricted (nothing hidden).
    const ignoredFields = useMemo(() => {
        const names = new Set<string>();
        if (!availableTypeNames) return names;
        for (const field of schema.fields) {
            if (isHidden(field)) continue;
            if (field.type !== CONTENT_FIELD_TYPE.Relation) continue;
            if (!availableTypeNames.includes(field.relation?.to ?? ''))
                names.add(field.name);
        }
        return names;
    }, [schema, availableTypeNames]);

    // Many/inverse relations are link-managed (staged as deltas), so their key
    // is dropped from the form values (see `seedRelationValues`). They must be
    // excluded from values-based validation and the publish gate too — otherwise
    // a *required* one is a permanent, un-fillable block even though the user has
    // staged links for it. They still render in the Relations tab (via
    // `relationFields`, which keys off `ignoredFields` only).
    const managedRelationNames = useMemo(() => {
        const names = new Set<string>();
        for (const field of schema.fields) {
            if (
                field.type === CONTENT_FIELD_TYPE.Relation &&
                (field.relation?.many || field.relation?.inverse)
            )
                names.add(field.name);
        }
        return names;
    }, [schema]);

    // Fields excluded from client validation + the gate: ungranted relations
    // (hidden) plus every link-managed relation (not a form value).
    const validationIgnored = useMemo(
        () => new Set([...ignoredFields, ...managedRelationNames]),
        [ignoredFields, managedRelationNames]
    );

    const form = useEntryForm(schema, initialValues, {
        ignoreFields: validationIgnored
    });

    const visible = schema.fields.filter((field) => !isHidden(field));
    const generalFields = visible.filter(
        (field) => field.type !== CONTENT_FIELD_TYPE.Relation
    );
    const relationFields = visible.filter(
        (field) =>
            field.type === CONTENT_FIELD_TYPE.Relation &&
            !ignoredFields.has(field.name)
    );

    // The publish gate: each field that must hold to publish — every required
    // field, plus any field whose current value is invalid — with its live
    // pass/fail. Reuses the form's strict (required-enforced) errors, so it
    // mirrors exactly what the publish endpoint will check without re-running
    // validation over the same values. Publishable only.
    const fieldGate = useMemo<PublishGateItem[]>(() => {
        return visible
            .filter((field) => !validationIgnored.has(field.name))
            .filter((field) => field.required || form.errors[field.name])
            .map((field) => ({
                label: fieldLabel(field),
                ok: !form.errors[field.name],
                message: form.errors[field.name]
            }));
    }, [form.errors, visible, validationIgnored]);

    // A **required** many/inverse relation is link-managed, so it never appears
    // in the values bag `validateEntryValues` (and `fieldGate`) checks — the
    // `validationIgnored` skip there is correct and stays. But the server rejects
    // publishing a required relation with zero links, so mirror that here from
    // the counts we do have: the loaded server total ± the staged add/remove.
    // This surfaces the block in the publish gate before the server 422, exactly
    // like a required scalar field (#1).
    const relationGate = useMemo<PublishGateItem[]>(() => {
        const out: PublishGateItem[] = [];
        for (const field of visible) {
            if (field.type !== CONTENT_FIELD_TYPE.Relation) continue;
            if (!field.required) continue;
            // Only link-managed (many/inverse) relations that are actually shown:
            // single relations are gated through their form value, and
            // hidden/ungranted ones must never become an invisible block.
            if (!managedRelationNames.has(field.name)) continue;
            if (ignoredFields.has(field.name)) continue;
            // Inline the staged lookup (not `stagedFor`) so this memo depends on
            // `relationDeltas` directly, not a per-render helper.
            const staged = relationDeltas[field.name] ?? EMPTY_STAGED;
            const serverTotal = relationRefs?.[field.name]?.total;
            // On an existing entry the aggregate may still be loading — we can't
            // assert an empty set yet, so skip rather than raise a false failure.
            // Create mode has no server set (total 0), so the staged adds decide.
            if (entryId && serverTotal === undefined) continue;
            const count = Math.max(
                0,
                (serverTotal ?? 0) - staged.removed.length + staged.added.length
            );
            out.push({
                label: fieldLabel(field),
                ok: count > 0,
                message:
                    count > 0
                        ? undefined
                        : intl.formatMessage(messages.relationRequired)
            });
        }
        return out;
    }, [
        visible,
        managedRelationNames,
        ignoredFields,
        relationDeltas,
        relationRefs,
        entryId,
        intl
    ]);

    // The full gate shown in the rail: the values-bag checks plus the
    // count-based required-relation checks.
    const gate = useMemo<PublishGateItem[]>(
        () => [...fieldGate, ...relationGate],
        [fieldGate, relationGate]
    );

    // The staged relation deltas to send with the save — only fields with a
    // pending change, serialized to the wire shape. Undefined when nothing staged.
    const relationsPayload = (): Record<string, RelationDelta> | undefined => {
        const out: Record<string, RelationDelta> = {};
        for (const [name, staged] of Object.entries(relationDeltas)) {
            if (isStagedDirty(staged)) out[name] = stagedToWire(staged);
        }
        return Object.keys(out).length ? out : undefined;
    };

    // A 422 from the server is mapped back onto the form as inline field errors;
    // other failures fall through to the mutation's own error handling. On
    // success the staging is cleared (the saved links are now the server set).
    const submitWith =
        (publish: boolean) => (values: Record<string, unknown>) =>
            onSave(values, {
                publish,
                relations: relationsPayload(),
                ignoreFields: validationIgnored
            })
                .then(() => setRelationDeltas({}))
                .catch((error) => {
                    form.setServerErrors(entryIssuesFrom(error));
                });

    // A **draft** of a publishable type can be saved incomplete, so it uses the
    // relaxed (format-only) gate — required isn't enforced, but a malformed value
    // is still caught client-side. Publishing — or any save of an always-live,
    // non-publishable type — enforces the full rules before submitting.
    // A submit the client rules refused reveals the inline field errors — but
    // those can sit on a tab the user isn't looking at (or below the fold), so
    // the button reads as dead: pressed, nothing happened, nothing explained
    // (#10, #28). Announce it in a toast naming the first offending field, and
    // move to the tab that field lives on so the marked control is on screen.
    const announceBlocked = (strict: boolean, publish: boolean) => {
        const blocking = strict ? form.errors : form.draftErrors;
        const names = Object.keys(blocking);
        if (names.length === 0) return;
        const first =
            visible.find((field) => blocking[field.name]) ??
            schema.fields.find((field) => blocking[field.name]);
        if (first?.type === CONTENT_FIELD_TYPE.Relation)
            onTabChange(ENTRY_TAB.Relations);
        else onTabChange(ENTRY_TAB.General);
        toast.error(
            intl.formatMessage(
                publish ? messages.publishBlocked : messages.saveBlocked,
                {
                    count: names.length,
                    field: first ? fieldLabel(first) : names[0]
                }
            )
        );
    };

    const runSave = (publish: boolean) => {
        // A **draft** of a publishable type can be saved incomplete (relaxed
        // gate); publishing — or any save of an always-live type — is strict.
        const strict = publish || !publishable;
        const submitted = strict
            ? form.submit(submitWith(publish))
            : form.submitDraft(submitWith(publish));
        if (!submitted) announceBlocked(strict, publish);
    };

    // Shared (non-localized) fields are **synced across the translation group**
    // on save — the server copies them to every sibling row in the same
    // transaction. That is invisible from an editor scoped to one locale, so a
    // save that carries such a change confirms first (#17). Only ever relevant
    // on a type that *has* both kinds of field; a plain type has no siblings to
    // affect and never sees this.
    const dirtySharedFields = generalFields.filter(
        (field) => !field.localized && isFieldDirty(field.name)
    );
    const hasLocalizedFields = visible.some((field) => field.localized);
    const needsSharedWarning =
        hasLocalizedFields && !isCreate && dirtySharedFields.length > 0;

    const [pendingPublish, setPendingPublish] = useState<boolean | null>(null);

    const save = (publish: boolean) => () => {
        if (needsSharedWarning) {
            setPendingPublish(publish);
            return;
        }
        runSave(publish);
    };

    // Whether anything at all is unsaved — a dirty field value or staged
    // relation links. Handed to slot widgets so a locale switch can confirm
    // before discarding the work instead of dropping it silently (#36).
    const isDirty =
        visible.some((field) => isFieldDirty(field.name)) ||
        Object.values(relationDeltas).some(isStagedDirty);

    // Register with the app-wide guard, so *any* navigation away from a dirty
    // editor — a sidebar link, a breadcrumb, "Back to records", a browser
    // reload — confirms first, not just the locale switch.
    useUnsavedChanges(isDirty);

    return (
        <form
            noValidate
            className="flex min-h-0 flex-1 flex-col lg:flex-row"
            onSubmit={(event) => {
                event.preventDefault();
                // Submitting (e.g. Enter) runs the primary action — publish for
                // a publishable type, otherwise a plain save — so it matches the
                // visually-primary button rather than silently saving a draft.
                save(publishable)();
            }}
        >
            {/* Main column: title + tabs. The card itself is flush (no padding);
                padding lives here, inside the pane. `min-w-0` keeps wide field
                content from widening the page (the card scrolls as a whole). */}
            <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-6">
                {/* Centered reading column: the editor content is capped and
                    centered instead of stretching the full pane width. */}
                <div className="mx-auto w-full max-w-3xl">
                    {backTo ? (
                        <Link
                            to={backTo}
                            className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <ArrowLeft className="size-4" />
                            {intl.formatMessage(messages.backToList)}
                        </Link>
                    ) : null}
                    <div className="mb-6 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-lg font-semibold tracking-[-0.01em]">
                                {title}
                            </h1>
                            {slotContext
                                ? headerItems.map((item) => (
                                      <item.Component
                                          key={item.id}
                                          {...slotContext}
                                      />
                                  ))
                                : null}
                        </div>
                        {subtitle ? (
                            <p className="mt-1 text-sm text-muted-foreground">
                                {subtitle}
                            </p>
                        ) : null}
                    </div>

                    <div className="min-w-0">
                        <Tabs value={tab} onValueChange={onTabChange}>
                            <TabsList className="mb-4">
                                <TabsTrigger value={ENTRY_TAB.General}>
                                    {intl.formatMessage(messages.tabGeneral)}
                                </TabsTrigger>
                                <TabsTrigger value={ENTRY_TAB.Relations}>
                                    {intl.formatMessage(messages.tabRelations)}
                                </TabsTrigger>
                                <TabsTrigger value={ENTRY_TAB.Media}>
                                    {intl.formatMessage(messages.tabMedia)}
                                </TabsTrigger>
                                <TabsTrigger value={ENTRY_TAB.History}>
                                    {intl.formatMessage(messages.tabHistory)}
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value={ENTRY_TAB.General}>
                                <EntryFieldSections
                                    fields={generalFields}
                                    form={form}
                                    isChanged={isFieldDirty}
                                />
                            </TabsContent>

                            <TabsContent value={ENTRY_TAB.Relations}>
                                {relationFields.length > 0 ? (
                                    <div className="flex flex-col gap-3">
                                        <p className="text-sm text-muted-foreground">
                                            {intl.formatMessage(
                                                messages.relationsSubtitle
                                            )}
                                        </p>
                                        {relationFields.map((field) => {
                                            // A many/inverse relation is staged +
                                            // link-managed; a single relation is a
                                            // plain form value.
                                            const managed =
                                                !!field.relation?.many ||
                                                !!field.relation?.inverse;
                                            const staged = stagedFor(
                                                field.name
                                            );
                                            // Header count: server total adjusted by
                                            // the staged add/remove (managed), else
                                            // the single form value's length. `null`
                                            // while the managed set's aggregate is
                                            // still loading, so the header shows a
                                            // neutral affordance rather than a wrong
                                            // 0 for a populated relation (#6).
                                            const count: number | null = managed
                                                ? relationsLoading
                                                    ? null
                                                    : Math.max(
                                                          0,
                                                          (relationRefs?.[
                                                              field.name
                                                          ]?.total ?? 0) -
                                                              staged.removed
                                                                  .length +
                                                              staged.added
                                                                  .length
                                                      )
                                                : toRelationIds(
                                                      form.values[field.name],
                                                      false
                                                  ).length;
                                            const changed = managed
                                                ? isRelationDirty(field.name)
                                                : isFieldDirty(field.name);
                                            return (
                                                <RelationFieldSection
                                                    key={field.name}
                                                    field={field}
                                                    count={count}
                                                    changed={changed}
                                                    typeName={schema.name}
                                                    entryId={entryId}
                                                    value={
                                                        form.values[field.name]
                                                    }
                                                    error={form.errorFor(
                                                        field.name
                                                    )}
                                                    onChange={(value) =>
                                                        form.setValue(
                                                            field.name,
                                                            value
                                                        )
                                                    }
                                                    onBlur={() =>
                                                        form.touch(field.name)
                                                    }
                                                    initialRefs={
                                                        relationRefs?.[
                                                            field.name
                                                        ]?.items
                                                    }
                                                    staged={staged}
                                                    onStagedChange={(next) =>
                                                        setStaged(
                                                            field.name,
                                                            next
                                                        )
                                                    }
                                                />
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        {intl.formatMessage(
                                            messages.relationsEmpty
                                        )}
                                    </p>
                                )}
                            </TabsContent>

                            <TabsContent value={ENTRY_TAB.Media}>
                                <Card className="shadow-none">
                                    <CardHeader>
                                        <CardTitle className="text-base">
                                            {intl.formatMessage(
                                                messages.mediaTitle
                                            )}
                                        </CardTitle>
                                        <CardDescription>
                                            {intl.formatMessage(
                                                messages.mediaBody
                                            )}
                                        </CardDescription>
                                    </CardHeader>
                                </Card>
                            </TabsContent>

                            <TabsContent value={ENTRY_TAB.History}>
                                <HistoryTimeline
                                    typeName={schema.name}
                                    entryId={entry?.id}
                                    schema={schema}
                                />
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </div>

            <EntrySidebar
                entry={entry}
                publishable={publishable}
                paranoid={schema.paranoid ?? false}
                isCreate={isCreate}
                saving={saving}
                mutating={mutating}
                gate={gate}
                onSaveDraft={save(false)}
                onPublish={save(true)}
                onUnpublish={onUnpublish}
                onDelete={onDelete}
            />

            <ConfirmDialog
                open={pendingPublish !== null}
                onOpenChange={(open) => {
                    if (!open) setPendingPublish(null);
                }}
                title={intl.formatMessage(messages.sharedSaveTitle)}
                description={intl.formatMessage(messages.sharedSaveBody, {
                    count: dirtySharedFields.length,
                    first: dirtySharedFields[0]
                        ? fieldLabel(dirtySharedFields[0])
                        : ''
                })}
                confirmLabel={intl.formatMessage(messages.sharedSaveConfirm)}
                cancelLabel={intl.formatMessage(messages.cancel)}
                onConfirm={() => {
                    const publish = pendingPublish ?? false;
                    setPendingPublish(null);
                    runSave(publish);
                }}
            />
        </form>
    );
}
