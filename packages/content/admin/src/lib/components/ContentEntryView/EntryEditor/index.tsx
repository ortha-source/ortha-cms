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
    TabsTrigger
} from '@ortha-cms/design-system';
import type {
    ContentField,
    ContentTypeDetail,
    EntryRecord,
    RelationDelta,
    StagedRelation
} from '../../../types/contentType';
import { CONTENT_FIELD_TYPE } from '../../../constants';
import { useEntryForm } from '../../../hooks/useEntryForm';
import { useEntryRelations } from '../../../api/useEntryRelations';
import { entryIssuesFrom } from '../../../utils/entryIssues';
import { fieldLabel } from '../../../utils/entryColumns';
import { toRelationIds } from '../../../utils/relationIds';
import { EntryFieldSections } from './EntryFieldSections';
import { EntrySidebar, type PublishGateItem } from './EntrySidebar';
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
    mediaTitle: { id: 'content.editor.mediaTitle', defaultMessage: 'Media' },
    mediaBody: {
        id: 'content.editor.mediaBody',
        defaultMessage:
            'Image and file fields for this record will appear here once media support lands.'
    },
    historyTitle: {
        id: 'content.editor.historyTitle',
        defaultMessage: 'History'
    },
    historyBody: {
        id: 'content.editor.historyBody',
        defaultMessage:
            'A timeline of edits to this record will appear here soon.'
    }
});

/** Tab keys for the editor — named so they aren't bare string literals. */
const TAB = {
    General: 'general',
    Relations: 'relations',
    Media: 'media',
    History: 'history'
} as const;

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
    availableTypeNames
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
}) {
    const intl = useIntl();
    // The existing entry's id, or undefined while creating. Many/inverse
    // relations are staged locally either way and sent as a delta on Save.
    const entryId = entry?.id;
    // Which tab is active, so the relation links are fetched **lazily** — only
    // once the Relations tab is opened, never on entry load.
    const [tab, setTab] = useState<string>(TAB.General);
    // First page + total per relation field, for the header counts and to title
    // single relations. Gated on the Relations tab being open (and an existing
    // entry) so it doesn't fire until the user goes looking for relations.
    const relationRefs = useEntryRelations(
        schema.name,
        entryId,
        tab === TAB.Relations && !!entryId
    ).data;
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
    const gate = useMemo<PublishGateItem[]>(() => {
        if (!publishable) return [];
        return visible
            .filter((field) => !validationIgnored.has(field.name))
            .filter((field) => field.required || form.errors[field.name])
            .map((field) => ({
                label: fieldLabel(field),
                ok: !form.errors[field.name],
                message: form.errors[field.name]
            }));
    }, [publishable, form.errors, visible, validationIgnored]);

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
            onSave(values, { publish, relations: relationsPayload() })
                .then(() => setRelationDeltas({}))
                .catch((error) => {
                    form.setServerErrors(entryIssuesFrom(error));
                });

    // A **draft** of a publishable type can be saved incomplete, so it uses the
    // relaxed (format-only) gate — required isn't enforced, but a malformed value
    // is still caught client-side. Publishing — or any save of an always-live,
    // non-publishable type — enforces the full rules before submitting.
    const save = (publish: boolean) => () => {
        if (publish || !publishable) {
            form.submit(submitWith(publish));
        } else {
            form.submitDraft(submitWith(publish));
        }
    };

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
                    <h1 className="text-lg font-semibold tracking-[-0.01em]">
                        {title}
                    </h1>
                    {subtitle ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                            {subtitle}
                        </p>
                    ) : null}
                </div>

                <div className="min-w-0">
                    <Tabs value={tab} onValueChange={setTab}>
                        <TabsList className="mb-4">
                            <TabsTrigger value={TAB.General}>
                                {intl.formatMessage(messages.tabGeneral)}
                            </TabsTrigger>
                            <TabsTrigger value={TAB.Relations}>
                                {intl.formatMessage(messages.tabRelations)}
                            </TabsTrigger>
                            <TabsTrigger value={TAB.Media}>
                                {intl.formatMessage(messages.tabMedia)}
                            </TabsTrigger>
                            <TabsTrigger value={TAB.History}>
                                {intl.formatMessage(messages.tabHistory)}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value={TAB.General}>
                            <EntryFieldSections
                                fields={generalFields}
                                form={form}
                                isChanged={isFieldDirty}
                            />
                        </TabsContent>

                        <TabsContent value={TAB.Relations}>
                            {relationFields.length > 0 ? (
                                <div className="flex flex-col gap-3">
                                    {relationFields.map((field) => {
                                        // A many/inverse relation is staged +
                                        // link-managed; a single relation is a
                                        // plain form value.
                                        const managed =
                                            !!field.relation?.many ||
                                            !!field.relation?.inverse;
                                        const staged = stagedFor(field.name);
                                        // Header count: server total adjusted by
                                        // the staged add/remove (managed), else
                                        // the single form value's length.
                                        const count = managed
                                            ? Math.max(
                                                  0,
                                                  (relationRefs?.[field.name]
                                                      ?.total ?? 0) -
                                                      staged.removed.length +
                                                      staged.added.length
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
                                                value={form.values[field.name]}
                                                error={form.errorFor(field.name)}
                                                onChange={(value) =>
                                                    form.setValue(
                                                        field.name,
                                                        value
                                                    )
                                                }
                                                onBlur={() =>
                                                    form.touch(field.name)
                                                }
                                                // A handful stay open; many start
                                                // collapsed to keep the tab tidy.
                                                defaultOpen={
                                                    relationFields.length <= 3 ||
                                                    field.required
                                                }
                                                initialRefs={
                                                    relationRefs?.[field.name]
                                                        ?.items
                                                }
                                                staged={staged}
                                                onStagedChange={(next) =>
                                                    setStaged(field.name, next)
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

                        <TabsContent value={TAB.Media}>
                            <Card className="shadow-none">
                                <CardHeader>
                                    <CardTitle className="text-base">
                                        {intl.formatMessage(
                                            messages.mediaTitle
                                        )}
                                    </CardTitle>
                                    <CardDescription>
                                        {intl.formatMessage(messages.mediaBody)}
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        </TabsContent>

                        <TabsContent value={TAB.History}>
                            <Card className="shadow-none">
                                <CardHeader>
                                    <CardTitle className="text-base">
                                        {intl.formatMessage(
                                            messages.historyTitle
                                        )}
                                    </CardTitle>
                                    <CardDescription>
                                        {intl.formatMessage(
                                            messages.historyBody
                                        )}
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        </TabsContent>
                    </Tabs>
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
        </form>
    );
}
