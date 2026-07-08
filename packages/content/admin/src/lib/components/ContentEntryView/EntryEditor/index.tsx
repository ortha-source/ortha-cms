import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type FocusEvent
} from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { useHasPermission } from '@ortha-cms/identity-admin';
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    cn
} from '@ortha-cms/design-system';
import type {
    ContentField,
    ContentTypeDetail,
    EntryRecord,
    RelationDelta,
    StagedRelation
} from '../../../types/contentType';
import {
    CONTENT_CREATE,
    CONTENT_DELETE,
    CONTENT_FIELD_TYPE,
    CONTENT_PUBLISH,
    CONTENT_UPDATE,
    ENTRY_STATUS
} from '../../../constants';
import { useEntryForm } from '../../../hooks/useEntryForm';
import { useEntryRelations } from '../../../api/useEntryRelations';
import { entryIssuesFrom } from '../../../utils/entryIssues';
import { fieldLabel } from '../../../utils/entryColumns';
import { relationLabel } from '../../../utils/relationLabel';
import { toRelationIds } from '../../../utils/relationIds';
import { RelationFieldSection } from './RelationFieldSection';
import { EntryTopBar } from './EntryTopBar';
import { EntryFieldRow } from './EntryFieldRow';
import { buildOutlineStates, isContentFilled } from './fieldOutlineState';
import { FieldGroupHeader } from './FieldGroupHeader';
import { FieldNavigator } from './FieldNavigator';
import { PublishGate, type PublishGateItem } from './EntrySidebar/PublishGate';
import { DetailsBlock } from './EntrySidebar/DetailsBlock';
import type { PrimaryAction } from './EntrySidebar/SidebarActionBar';

const messages = defineMessages({
    localePill: {
        id: 'content.editor.localePill',
        defaultMessage: 'EN · English'
    },
    tabGeneral: { id: 'content.editor.tabGeneral', defaultMessage: 'General' },
    tabRelations: {
        id: 'content.editor.tabRelations',
        defaultMessage: 'Relations'
    },
    tabMedia: { id: 'content.editor.tabMedia', defaultMessage: 'Files' },
    tabHistory: {
        id: 'content.editor.tabHistory',
        defaultMessage: 'History'
    },
    groupProperties: {
        id: 'content.editor.groupProperties',
        defaultMessage: 'Properties'
    },
    groupContent: {
        id: 'content.editor.groupContent',
        defaultMessage: 'Content'
    },
    relationsEmpty: {
        id: 'content.editor.relationsEmpty',
        defaultMessage: 'This content type has no relation fields.'
    },
    mediaTitle: { id: 'content.editor.mediaTitle', defaultMessage: 'Files' },
    mediaBody: {
        id: 'content.editor.mediaBody',
        defaultMessage:
            'File and image fields for this record will appear here once media support lands.'
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

/** How far below the pane top a field must clear to become the active one. */
const SPY_OFFSET = 130;

/** Where a jumped-to field lands from the pane top. */
const JUMP_OFFSET = 90;

/** Underline tab-bar styling (overrides the design-system pill defaults): the
 *  bottom hairline spans the full card width, while `px-9` insets the triggers
 *  so they line up with the header + body content. */
const TAB_LIST_CLS =
    'mt-5 h-auto w-full justify-start gap-6 rounded-none border-b bg-transparent px-5 py-0 lg:px-9';

/** Underline tab trigger: muted text, foreground underline when active, its
 *  border overlapping the list's bottom hairline (`-mb-px`). */
const TAB_TRIGGER_CLS =
    '-mb-px rounded-none border-b-2 border-transparent px-0 pb-2.5 pt-0 text-[13px] font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none';

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
 * The full entry editor, in the record-editor design: a fixed top bar (back +
 * breadcrumb + status + Publish/Save actions), a left {@link FieldOutline}
 * mirroring the fields' fill/validation with scroll-spy + click-to-jump, a
 * tabbed center **island** (a pinned header + underline tabs over the only
 * scrolling region — **General** = the fields one-per-line, **Relations**, and
 * Files / History placeholders), and a
 * right rail ({@link PublishGate} + {@link DetailsBlock}). Owns the form state
 * ({@link useEntryForm}); persistence is the caller's `onSave`, called with the
 * publish intent so the same editor backs create / edit / single-page modes.
 */
export function EntryEditor({
    schema,
    initialValues,
    entry,
    isCreate,
    publishable,
    subtitle,
    saving,
    mutating,
    onSave,
    onUnpublish,
    onDelete,
    backTo,
    libraryTo,
    availableTypeNames
}: {
    schema: ContentTypeDetail;
    initialValues: Record<string, unknown>;
    entry?: EntryRecord;
    isCreate: boolean;
    publishable: boolean;
    subtitle?: string;
    saving: boolean;
    /** Whether an unpublish/delete action is in flight (disables the actions). */
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
    /** Where "back to records" goes; omitted for a single page. */
    backTo?: string;
    /** The content library root (`…/content`), for the "Content" breadcrumb. */
    libraryTo?: string;
    /**
     * Content-type names granted to the open workspace. A relation field is shown
     * only when its target is in this set — a relation to a collection the
     * workspace can't access is hidden (you couldn't pick its records anyway).
     * Undefined = unrestricted (show every relation).
     */
    availableTypeNames?: readonly string[];
}) {
    const intl = useIntl();
    const navigate = useNavigate();
    // The existing entry's id, or undefined while creating. Many/inverse
    // relations are staged locally either way and sent as a delta on Save.
    const entryId = entry?.id;
    const [tab, setTab] = useState<string>(TAB.General);
    // First page + total per relation field, fetched lazily — only once the
    // Relations tab is opened, never on entry load.
    const relationRefs = useEntryRelations(
        schema.name,
        entryId,
        tab === TAB.Relations && !!entryId
    ).data;
    // Per-field staged relation edits (many/inverse), owned here so they survive
    // switching tabs, sent as `relations` deltas on Save. Cleared after a save.
    const [relationDeltas, setRelationDeltas] = useState<
        Record<string, StagedRelation>
    >({});
    const stagedFor = (name: string): StagedRelation =>
        relationDeltas[name] ?? EMPTY_STAGED;
    const setStaged = (name: string, next: StagedRelation) =>
        setRelationDeltas((current) => ({ ...current, [name]: next }));

    const isFieldDirty = (name: string) =>
        norm(form.values[name]) !== norm(initialValues[name]);
    const isRelationDirty = (name: string) => isStagedDirty(stagedFor(name));

    // Relation fields hidden because their target collection isn't granted to the
    // open workspace: excluded from client validation and the publish gate too,
    // else a required one is an un-satisfiable, invisible block.
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
    // is dropped from the form values — excluded from validation + the gate too.
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

    const validationIgnored = useMemo(
        () => new Set([...ignoredFields, ...managedRelationNames]),
        [ignoredFields, managedRelationNames]
    );

    const form = useEntryForm(schema, initialValues, {
        ignoreFields: validationIgnored,
        // Seed once per record: a background refetch of the same entry must not
        // discard in-progress edits (e.g. a just-picked date).
        seedKey: entry?.id ?? 'new'
    });

    const visible = useMemo(
        () => schema.fields.filter((field) => !isHidden(field)),
        [schema]
    );
    const generalFields = useMemo(
        () =>
            visible.filter(
                (field) => field.type !== CONTENT_FIELD_TYPE.Relation
            ),
        [visible]
    );
    // Long-form fields (richtext / JSON) stack full-width at the bottom under a
    // "Content" group; every other field is a "Property" laid out in a grid.
    const longFields = useMemo(
        () =>
            generalFields.filter(
                (field) =>
                    field.type === CONTENT_FIELD_TYPE.RichText ||
                    field.type === CONTENT_FIELD_TYPE.Json
            ),
        [generalFields]
    );
    const scalarFields = useMemo(
        () =>
            generalFields.filter(
                (field) =>
                    field.type !== CONTENT_FIELD_TYPE.RichText &&
                    field.type !== CONTENT_FIELD_TYPE.Json
            ),
        [generalFields]
    );
    // The outline + scroll-spy follow the on-screen order: scalars, then
    // long-form — so a jump from the outline lands where the field is drawn.
    const orderedGeneralFields = useMemo(
        () => [...scalarFields, ...longFields],
        [scalarFields, longFields]
    );
    const relationFields = useMemo(
        () =>
            visible.filter(
                (field) =>
                    field.type === CONTENT_FIELD_TYPE.Relation &&
                    !ignoredFields.has(field.name)
            ),
        [visible, ignoredFields]
    );

    // The publish gate: every required field, plus any field whose current value
    // is invalid, each with its live pass/fail. Reuses the form's strict errors.
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

    // The staged relation deltas to send with the save.
    const relationsPayload = (): Record<string, RelationDelta> | undefined => {
        const out: Record<string, RelationDelta> = {};
        for (const [name, staged] of Object.entries(relationDeltas)) {
            if (isStagedDirty(staged)) out[name] = stagedToWire(staged);
        }
        return Object.keys(out).length ? out : undefined;
    };

    // A 422 is mapped back onto the form as inline field errors; on success the
    // staging is cleared (the saved links are now the server set).
    const submitWith =
        (publish: boolean) => (values: Record<string, unknown>) =>
            onSave(values, { publish, relations: relationsPayload() })
                .then(() => setRelationDeltas({}))
                .catch((error) => {
                    form.setServerErrors(entryIssuesFrom(error));
                });

    // A **draft** of a publishable type can be saved incomplete (relaxed gate);
    // publishing — or any save of an always-live type — enforces the full rules.
    const save = (publish: boolean) => () => {
        if (publish || !publishable) {
            form.submit(submitWith(publish));
        } else {
            form.submitDraft(submitWith(publish));
        }
    };

    // Permissions decide the primary action + which menu items show.
    const canCreate = useHasPermission(CONTENT_CREATE);
    const canUpdate = useHasPermission(CONTENT_UPDATE);
    const canPublish = useHasPermission(CONTENT_PUBLISH);
    const canDelete = useHasPermission(CONTENT_DELETE);
    const canSave = isCreate ? canCreate : canUpdate;
    const busy = saving || !!mutating;
    const published = entry?.status === ENTRY_STATUS.Published;

    const primary: PrimaryAction | null =
        publishable && canPublish && canSave
            ? { kind: 'publish', onClick: save(true) }
            : canSave
              ? {
                    kind: publishable ? 'saveDraft' : 'save',
                    onClick: save(false)
                }
              : null;
    const showSaveDraft = publishable && canSave;
    const showPublish = publishable && canPublish && canSave;
    const showUnpublish =
        !isCreate && publishable && published && canPublish && !!onUnpublish;
    const showDelete = !isCreate && canDelete && !!onDelete;

    // Outline state, derived from the general fields (in on-screen order) + form.
    const outlineStates = useMemo(
        () => buildOutlineStates(orderedGeneralFields, form),
        [orderedGeneralFields, form]
    );
    const filledCount = orderedGeneralFields.filter((field) =>
        isContentFilled(field.type, form.values[field.name])
    ).length;
    const recordName = relationLabel(form.values, generalFields, '');
    // Only split into Properties / Content headers when both groups exist.
    const showGroups = scalarFields.length > 0 && longFields.length > 0;

    // --- Cross-zone interaction: active field, scroll-spy, click-to-jump. ---
    const scrollRef = useRef<HTMLDivElement>(null);
    const [activeKey, setActiveKey] = useState<string | undefined>(
        orderedGeneralFields[0]?.name
    );
    // Field type by name — lets a jump open the overlay controls (date/select)
    // instead of only focusing their trigger.
    const fieldTypeByName = useMemo(() => {
        const map = new Map<string, string>();
        for (const field of orderedGeneralFields) map.set(field.name, field.type);
        return map;
    }, [orderedGeneralFields]);

    const jumpTo = useCallback(
        (name: string) => {
            setActiveKey(name);
            setTab(TAB.General);
            requestAnimationFrame(() => {
                const container = scrollRef.current;
                const el = document.getElementById(`f-${name}`);
                if (container && el) {
                    const top =
                        container.scrollTop +
                        (el.getBoundingClientRect().top -
                            container.getBoundingClientRect().top) -
                        JUMP_OFFSET;
                    container.scrollTo({
                        top: Math.max(0, top),
                        behavior: 'smooth'
                    });
                }
                requestAnimationFrame(() => {
                    const host = document.getElementById(`f-${name}`);
                    const control = host?.querySelector<HTMLElement>(
                        'input, textarea, select, button, [tabindex]'
                    );
                    control?.focus({ preventScroll: true });
                    if (!control) return;
                    // Focusing an overlay field via the navigator should reveal
                    // its options, not just its trigger: open the popover of a
                    // date/datetime or multiselect (a click toggles it) or the
                    // select listbox (Radix opens on an Enter/Space/Arrow
                    // keydown). A plain text input just takes focus.
                    const type = fieldTypeByName.get(name);
                    if (
                        type === CONTENT_FIELD_TYPE.Date ||
                        type === CONTENT_FIELD_TYPE.Datetime ||
                        type === CONTENT_FIELD_TYPE.Multiselect
                    ) {
                        control.click();
                    } else if (type === CONTENT_FIELD_TYPE.Select) {
                        control.dispatchEvent(
                            new KeyboardEvent('keydown', {
                                key: 'Enter',
                                bubbles: true
                            })
                        );
                    }
                });
            });
        },
        [fieldTypeByName]
    );

    const onScroll = useCallback(() => {
        const container = scrollRef.current;
        if (!container) return;
        const paneTop = container.getBoundingClientRect().top;
        let current: string | undefined;
        for (const field of orderedGeneralFields) {
            const el = document.getElementById(`f-${field.name}`);
            if (!el) continue;
            const top = el.getBoundingClientRect().top - paneTop;
            if (top <= SPY_OFFSET) current = field.name;
            else break;
        }
        if (current) setActiveKey(current);
    }, [orderedGeneralFields]);

    useEffect(() => {
        const container = scrollRef.current;
        if (!container || tab !== TAB.General) return;
        container.addEventListener('scroll', onScroll, { passive: true });
        return () => container.removeEventListener('scroll', onScroll);
    }, [onScroll, tab]);

    const onPaneFocus = useCallback((event: FocusEvent<HTMLDivElement>) => {
        const host = (event.target as HTMLElement).closest('[data-field-key]');
        const key = host?.getAttribute('data-field-key');
        if (key) setActiveKey(key);
    }, []);

    const onExit = useCallback(() => {
        if (backTo) navigate(backTo);
        else navigate(-1);
    }, [backTo, navigate]);

    return (
        <form
            noValidate
            className="flex h-full min-h-0 flex-col bg-muted/40"
            onSubmit={(event) => {
                event.preventDefault();
                // Enter runs the primary action (publish for a publishable type,
                // else a plain save), matching the visually-primary button.
                save(publishable)();
            }}
        >
            <EntryTopBar
                typeLabel={schema.label}
                recordName={recordName}
                status={entry?.status}
                publishable={publishable}
                paranoid={schema.paranoid ?? false}
                busy={busy}
                saving={saving}
                primary={primary}
                showSaveDraft={showSaveDraft}
                showPublish={showPublish}
                showUnpublish={showUnpublish}
                showDelete={showDelete}
                typeTo={backTo}
                rootTo={libraryTo}
                onExit={onExit}
                onSaveDraft={save(false)}
                onPublish={save(true)}
                onUnpublish={onUnpublish}
                onDelete={onDelete}
            />

            {/* Below `lg` the three columns stack and the whole body scrolls as
                one page (the field nav hides, the rail drops under the form);
                from `lg` up it's the fixed side-rails + internally-scrolling
                card. */}
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 lg:flex-row lg:gap-6 lg:overflow-hidden lg:px-6 lg:py-6">
                <FieldNavigator
                    fieldStates={outlineStates}
                    activeKey={activeKey}
                    filledCount={filledCount}
                    totalCount={orderedGeneralFields.length}
                    onJump={jumpTo}
                />

                <div className="flex min-w-0 flex-col lg:min-h-0 lg:flex-1">
                    <Tabs
                        value={tab}
                        onValueChange={setTab}
                        className="flex flex-col lg:min-h-0 lg:flex-1"
                    >
                        {/* The island card: a pinned header (title + locale +
                            underline tabs) over a single scrolling content
                            region, so the scrollbar sits inside the card and the
                            page never scrolls. Spans the full center column. */}
                        <div className="flex w-full flex-col rounded-2xl border bg-background lg:min-h-0 lg:flex-1 lg:overflow-hidden">
                            <div className="flex-none pt-6 lg:pt-7">
                                <div className="px-5 lg:px-9">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <h1 className="text-2xl font-semibold tracking-tight">
                                            {schema.label}
                                        </h1>
                                        <span className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
                                            {intl.formatMessage(
                                                messages.localePill
                                            )}
                                        </span>
                                    </div>
                                    {subtitle ? (
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            {subtitle}
                                        </p>
                                    ) : null}
                                </div>
                                <TabsList className={TAB_LIST_CLS}>
                                    <TabsTrigger
                                        value={TAB.General}
                                        className={TAB_TRIGGER_CLS}
                                    >
                                        {intl.formatMessage(
                                            messages.tabGeneral
                                        )}
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value={TAB.Relations}
                                        className={TAB_TRIGGER_CLS}
                                    >
                                        {intl.formatMessage(
                                            messages.tabRelations
                                        )}
                                        {relationFields.length > 0
                                            ? ` · ${relationFields.length}`
                                            : ''}
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value={TAB.Media}
                                        className={TAB_TRIGGER_CLS}
                                    >
                                        {intl.formatMessage(messages.tabMedia)}
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value={TAB.History}
                                        className={TAB_TRIGGER_CLS}
                                    >
                                        {intl.formatMessage(
                                            messages.tabHistory
                                        )}
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <div
                                ref={scrollRef}
                                onFocus={onPaneFocus}
                                className="px-5 pb-7 pt-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-9"
                            >
                                <TabsContent
                                    value={TAB.General}
                                    className="mt-0"
                                >
                                    {scalarFields.length > 0 ? (
                                        <section>
                                            {showGroups ? (
                                                <FieldGroupHeader
                                                    label={intl.formatMessage(
                                                        messages.groupProperties
                                                    )}
                                                    count={scalarFields.length}
                                                />
                                            ) : null}
                                            {/* Flexible rows: cells wrap at a
                                                ~340px basis (→ 1 / 2 / 3 columns
                                                by width) and **grow** to fill
                                                their row, so a lone field — the
                                                only one, or the last of an odd
                                                count — stretches full width
                                                instead of leaving a gap. */}
                                            <div
                                                className={cn(
                                                    'flex flex-wrap gap-x-6 gap-y-[22px]',
                                                    showGroups && 'mt-4'
                                                )}
                                            >
                                                {scalarFields.map((field) => (
                                                    <EntryFieldRow
                                                        key={field.name}
                                                        className="min-w-0 grow basis-[340px]"
                                                        field={field}
                                                        value={
                                                            form.values[
                                                                field.name
                                                            ]
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
                                                            form.touch(
                                                                field.name
                                                            )
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </section>
                                    ) : null}

                                    {longFields.length > 0 ? (
                                        <section
                                            className={cn(
                                                scalarFields.length > 0 &&
                                                    'mt-8'
                                            )}
                                        >
                                            {showGroups ? (
                                                <FieldGroupHeader
                                                    label={intl.formatMessage(
                                                        messages.groupContent
                                                    )}
                                                    count={longFields.length}
                                                />
                                            ) : null}
                                            <div
                                                className={cn(
                                                    'flex flex-col gap-[22px]',
                                                    showGroups && 'mt-4'
                                                )}
                                            >
                                                {longFields.map((field) => (
                                                    <EntryFieldRow
                                                        key={field.name}
                                                        field={field}
                                                        value={
                                                            form.values[
                                                                field.name
                                                            ]
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
                                                            form.touch(
                                                                field.name
                                                            )
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </section>
                                    ) : null}
                                </TabsContent>

                                <TabsContent
                                    value={TAB.Relations}
                                    className="mt-0"
                                >
                                    <div>
                                        {relationFields.length > 0 ? (
                                            <div className="flex flex-col gap-3">
                                                {relationFields.map((field) => {
                                                    const managed =
                                                        !!field.relation
                                                            ?.many ||
                                                        !!field.relation
                                                            ?.inverse;
                                                    const staged = stagedFor(
                                                        field.name
                                                    );
                                                    const count = managed
                                                        ? Math.max(
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
                                                              form.values[
                                                                  field.name
                                                              ],
                                                              false
                                                          ).length;
                                                    const changed = managed
                                                        ? isRelationDirty(
                                                              field.name
                                                          )
                                                        : isFieldDirty(
                                                              field.name
                                                          );
                                                    return (
                                                        <RelationFieldSection
                                                            key={field.name}
                                                            field={field}
                                                            count={count}
                                                            changed={changed}
                                                            typeName={
                                                                schema.name
                                                            }
                                                            entryId={entryId}
                                                            value={
                                                                form.values[
                                                                    field.name
                                                                ]
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
                                                                form.touch(
                                                                    field.name
                                                                )
                                                            }
                                                            defaultOpen={
                                                                relationFields.length <=
                                                                    3 ||
                                                                field.required
                                                            }
                                                            initialRefs={
                                                                relationRefs?.[
                                                                    field.name
                                                                ]?.items
                                                            }
                                                            staged={staged}
                                                            onStagedChange={(
                                                                next
                                                            ) =>
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
                                    </div>
                                </TabsContent>

                                <TabsContent value={TAB.Media} className="mt-0">
                                    <div>
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
                                    </div>
                                </TabsContent>

                                <TabsContent
                                    value={TAB.History}
                                    className="mt-0"
                                >
                                    <div>
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
                                    </div>
                                </TabsContent>
                            </div>
                        </div>
                    </Tabs>
                </div>

                <aside className="flex w-full flex-none flex-col gap-4 lg:w-[300px] lg:overflow-y-auto">
                    {publishable ? <PublishGate items={gate} /> : null}
                    <DetailsBlock entry={entry} isCreate={isCreate} />
                </aside>
            </div>
        </form>
    );
}
