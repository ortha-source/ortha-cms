import { useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router-dom';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { PageTopBar } from '@orthacms/shell-admin';
import { RequiredMark } from '@orthacms/content-admin';
import { useHasPermission } from '@orthacms/identity-admin';
import { ApiError, slugify, useDocumentTitle } from '@orthacms/utils-admin';
import {
    isValidSegment,
    validateSegment,
    SEGMENT_ISSUE,
    SEGMENT_KEY_MAX,
    SEGMENT_LABEL_MAX,
    SEGMENT_TAG_MAX,
    SEGMENT_TAGS_MAX,
    type SegmentIssue,
    type SegmentIssues
} from '@orthacms/segments-domain';
import {
    Alert,
    AlertDescription,
    Button,
    Card,
    Container,
    ContainerHeader,
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
    Input,
    Spinner,
    toast
} from '@orthacms/design-system';
import {
    SEGMENTS_MANAGE,
    SEGMENTS_READ,
    useCreateSegment,
    useDeleteSegment,
    useSegment,
    useUpdateSegment
} from '../../../application/hooks';
import { effectiveTags } from '../../../domain/readerTest';
import type { Segment } from '../../../domain/types';
import {
    OFFERED_IN,
    OfferedInField,
    type OfferedIn
} from '../../components/OfferedInField';
import { ReaderTagsInput } from '../../components/ReaderTagsInput';
import { ReaderTester } from '../../components/ReaderTester';
import { SegmentUsagePanel } from '../../components/SegmentUsagePanel';
import { DeleteSegmentDialog } from '../../components/DeleteSegmentDialog';
import { SegmentFormSkeleton } from '../../components/SegmentFormSkeleton';

const messages = defineMessages({
    directory: { id: 'segments.editor.directory', defaultMessage: 'Segments' },
    createTitle: {
        id: 'segments.editor.createTitle',
        defaultMessage: 'New audience'
    },
    createBody: {
        id: 'segments.editor.createLede',
        defaultMessage:
            'A group of readers you want to decide about — a customer, a plan, a region.'
    },
    editTitle: {
        id: 'segments.editor.editTitle',
        defaultMessage: 'Edit audience'
    },
    editBody: {
        id: 'segments.editor.editLede',
        defaultMessage: 'Tag changes apply to readers at once.'
    },
    requiredLegend: {
        id: 'segments.editor.requiredLegend',
        defaultMessage: 'Fields marked * are required.'
    },
    label: { id: 'segments.editor.label', defaultMessage: 'Name' },
    key: { id: 'segments.editor.key', defaultMessage: 'Key' },
    keyHint: {
        id: 'segments.editor.keyMadeFromName',
        defaultMessage:
            'Made from the name; lowercase letters, digits and . _ -. It can’t change later.'
    },
    keyFixed: {
        id: 'segments.editor.keyPermanent',
        defaultMessage: 'Permanent — entries refer to it.'
    },
    tags: { id: 'segments.editor.tags', defaultMessage: 'Reader tags' },
    tagsHint: {
        id: 'segments.editor.tagsLimitHint',
        defaultMessage:
            '{count} of {max} · a reader with any of these is in the audience. Empty means the key itself.'
    },
    scopeRequired: {
        id: 'segments.editor.scopeRequired',
        defaultMessage:
            'Pick at least one workspace — or choose Every workspace.'
    },
    submitCreate: {
        id: 'segments.editor.submitCreate',
        defaultMessage: 'Create audience'
    },
    submitEdit: { id: 'segments.editor.submitEdit', defaultMessage: 'Save' },
    cancel: { id: 'segments.editor.cancel', defaultMessage: 'Cancel' },
    created: {
        id: 'segments.editor.created',
        defaultMessage: '“{name}” is ready to use on entries.'
    },
    saved: { id: 'segments.editor.saved', defaultMessage: 'Saved.' },
    deleted: {
        id: 'segments.editor.deleted',
        defaultMessage: '“{name}” was deleted.'
    },
    writeError: {
        id: 'segments.editor.writeError',
        defaultMessage: 'Couldn’t save that. Please try again.'
    },
    loadError: {
        id: 'segments.editor.loadError',
        defaultMessage: 'Couldn’t load this audience.'
    },
    noAccess: {
        id: 'segments.editor.noAccess',
        defaultMessage:
            'Editing audiences needs the “segments:manage” permission.'
    },
    deleteHeading: {
        id: 'segments.editor.deleteHeading',
        defaultMessage: 'Delete audience'
    },
    deleteBody: {
        id: 'segments.editor.deleteBody',
        defaultMessage:
            'Entries that name it stop treating these readers differently.'
    },
    deleteCta: {
        id: 'segments.editor.deleteCta',
        defaultMessage: 'Delete…'
    },

    // One message per (field, reason) rather than a generic "invalid": the
    // whole point of validating here is telling somebody what to change.
    labelRequired: {
        id: 'segments.editor.labelRequired',
        defaultMessage: 'Give the audience a name.'
    },
    labelTooLong: {
        id: 'segments.editor.labelTooLong',
        defaultMessage: 'Keep the name under {max} characters.'
    },
    keyRequired: {
        id: 'segments.editor.keyRequired',
        defaultMessage: 'A key is required — it is how the audience is matched.'
    },
    keyMalformed: {
        id: 'segments.editor.keyMalformed',
        defaultMessage:
            'Use lowercase letters, digits, and . _ - only, starting with a letter or digit. It becomes a reader tag, so a space or a capital would match nobody.'
    },
    keyTooLong: {
        id: 'segments.editor.keyTooLong',
        defaultMessage: 'Keep the key under {max} characters.'
    },
    keyDuplicate: {
        id: 'segments.editor.keyDuplicate',
        defaultMessage: 'An audience with this key already exists.'
    },
    tagsTooMany: {
        id: 'segments.editor.tagsTooMany',
        defaultMessage: 'At most {max} tags.'
    },
    tagsTooLong: {
        id: 'segments.editor.tagsTooLong',
        defaultMessage: 'One of the tags is over {max} characters.'
    },
    tagsDuplicate: {
        id: 'segments.editor.tagsDuplicate',
        defaultMessage: 'The same tag is listed twice.'
    }
});

/** Which message a field's issue renders as, with its parameter. */
const COPY: Record<
    keyof SegmentIssues,
    Partial<
        Record<
            SegmentIssue,
            { message: { id: string; defaultMessage: string }; max?: number }
        >
    >
> = {
    label: {
        [SEGMENT_ISSUE.Required]: { message: messages.labelRequired },
        [SEGMENT_ISSUE.TooLong]: {
            message: messages.labelTooLong,
            max: SEGMENT_LABEL_MAX
        }
    },
    key: {
        [SEGMENT_ISSUE.Required]: { message: messages.keyRequired },
        [SEGMENT_ISSUE.Malformed]: { message: messages.keyMalformed },
        [SEGMENT_ISSUE.TooLong]: {
            message: messages.keyTooLong,
            max: SEGMENT_KEY_MAX
        },
        [SEGMENT_ISSUE.Duplicate]: { message: messages.keyDuplicate }
    },
    tags: {
        [SEGMENT_ISSUE.TooMany]: {
            message: messages.tagsTooMany,
            max: SEGMENT_TAGS_MAX
        },
        [SEGMENT_ISSUE.TooLong]: {
            message: messages.tagsTooLong,
            max: SEGMENT_TAG_MAX
        },
        [SEGMENT_ISSUE.Duplicate]: { message: messages.tagsDuplicate }
    }
};

/** The form's id — what the buttons outside it submit through `form=`. */
const FORM_ID = 'segment-form';

/**
 * Create or edit an audience, at `/segments/new` and `/segments/:segmentId`.
 *
 * **The form, and beside it the thing it is for.** Creating, the right column
 * is "Try a reader" — would this person be in it? — answered from the form as
 * typed. Editing, it is **where the audience is used**: the entries naming it
 * and whether each allows or refuses it, read before somebody changes the tags
 * those entries rely on — and under it the delete, which spells out who will
 * see what afterwards.
 *
 * **Tags are chips**, with the kernel's limit counted under them, and **"Offered
 * in" is two cards** — Every workspace (including new ones) or Some — rather
 * than a list of boxes whose all-clear state silently meant "every".
 *
 * **The rules come from the kernel**, not from a pattern spelled out here:
 * `@orthacms/segments-domain`'s `validateSegment` is the same function the
 * server's DTO reads its constants from, so this form cannot accept something
 * the API then refuses.
 *
 * **Errors appear on blur, not on the first keystroke.** A key is malformed for
 * the whole time somebody is typing it, and complaining from the second
 * character is noise about a state they are on their way out of.
 *
 * **Save sits in the top bar while editing** (the page header's action portals
 * there) and stays on the page — the usage beside the form is still what the
 * next change is checked against. Creating ends with Create / Cancel under the
 * form and goes back to the directory, which flashes the new row.
 */
export function SegmentEditorPage() {
    const intl = useIntl();
    const navigate = useNavigate();
    const { segmentId } = useParams<{ segmentId: string }>();
    const editing = segmentId !== undefined;

    const canRead = useHasPermission(SEGMENTS_READ);
    const canManage = useHasPermission(SEGMENTS_MANAGE);
    const loaded = useSegment(editing ? segmentId : undefined);
    const segment = loaded.data;

    const create = useCreateSegment();
    const update = useUpdateSegment();
    const remove = useDeleteSegment();
    const submitting = create.isPending || update.isPending;

    const [label, setLabel] = useState('');
    const [key, setKey] = useState('');
    const [keyTouched, setKeyTouched] = useState(false);
    const [tags, setTags] = useState<string[]>([]);
    const [scope, setScope] = useState<OfferedIn>(OFFERED_IN.Every);
    const [workspaceIds, setWorkspaceIds] = useState<string[]>([]);
    const [blurred, setBlurred] = useState<Record<string, boolean>>({});
    const [submitted, setSubmitted] = useState(false);
    const [deleting, setDeleting] = useState<Segment | null>(null);
    // The key the server refused with a 409 — one somebody else took a moment
    // ago. Held as the key rather than a flag so the message clears itself the
    // moment a different one is typed.
    const [keyConflict, setKeyConflict] = useState<string | null>(null);

    // Seed from the loaded segment. Keyed on the row's identity rather than the
    // object, so a background refetch cannot overwrite what is being typed.
    useEffect(() => {
        if (!segment) return;
        setLabel(segment.label);
        setKey(segment.key);
        setKeyTouched(true);
        setTags(segment.tags);
        setScope(
            segment.workspaceIds.length ? OFFERED_IN.Some : OFFERED_IN.Every
        );
        setWorkspaceIds(segment.workspaceIds);
    }, [segment?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const pageTitle = editing
        ? (segment?.label ?? intl.formatMessage(messages.editTitle))
        : intl.formatMessage(messages.createTitle);
    useDocumentTitle(pageTitle);

    // The key tracks the name until somebody takes it over — the same
    // convention the workspace slug follows, and here for the same reason: the
    // derived value is right almost always, and typing in the field says it
    // isn't.
    const derivedKey = keyTouched ? key : slugify(label);

    // Editing sends no key, so there is nothing to check it against; creating
    // relies on the server's 409, which is the only complete answer now that the
    // directory is paginated — a local list of "existing keys" would be one page
    // of them, and a check that is right most of the time is worse than one that
    // is honestly late.
    const issues = validateSegment({
        ...(editing ? {} : { key: derivedKey }),
        label,
        tags
    });
    // "Some workspaces" with none ticked would save as `[]` — which the server
    // reads as **every** workspace, the opposite of the choice on screen.
    const scopeMissing = scope === OFFERED_IN.Some && workspaceIds.length === 0;
    const valid = isValidSegment(issues) && !scopeMissing;

    /** The message for a field, once it is due to be shown. */
    const errorFor = (field: keyof SegmentIssues): string | undefined => {
        if (!submitted && !blurred[field]) return undefined;
        const issue = issues[field];
        if (!issue) return undefined;
        const entry = COPY[field][issue];
        if (!entry) return undefined;
        return intl.formatMessage(entry.message, { max: entry.max });
    };

    const labelError = errorFor('label');
    const keyError =
        keyConflict !== null && keyConflict === derivedKey && !editing
            ? intl.formatMessage(messages.keyDuplicate)
            : errorFor('key');
    const tagsError = errorFor('tags');
    const scopeError =
        submitted && scopeMissing
            ? intl.formatMessage(messages.scopeRequired)
            : undefined;
    const onBlur = (field: string) => () =>
        setBlurred((current) => ({ ...current, [field]: true }));

    const bar = (
        <PageTopBar
            icon={ShieldCheck}
            crumbs={[
                {
                    key: 'segments',
                    label: intl.formatMessage(messages.directory),
                    to: '/segments'
                },
                { key: 'editor', label: pageTitle }
            ]}
        />
    );

    const failed = () => toast.error(intl.formatMessage(messages.writeError));
    const leave = () => navigate('/segments');
    // `[]` is how the server spells "every workspace, including new ones".
    const scopeToSend = scope === OFFERED_IN.Every ? [] : workspaceIds;

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        setSubmitted(true);
        if (!valid || submitting) return;
        setKeyConflict(null);

        if (editing && segmentId) {
            update.mutate(
                {
                    id: segmentId,
                    label: label.trim(),
                    tags,
                    workspaceIds: scopeToSend
                },
                {
                    onSuccess: () =>
                        toast.success(intl.formatMessage(messages.saved)),
                    onError: failed
                }
            );
            return;
        }

        create.mutate(
            {
                key: derivedKey,
                label: label.trim(),
                // An empty list means "use the key", which the server fills in —
                // sending `[]` would be an audience matching nobody.
                ...(tags.length ? { tags } : {}),
                workspaceIds: scopeToSend
            },
            {
                onSuccess: (created) => {
                    toast.success(
                        intl.formatMessage(messages.created, {
                            name: created.label
                        })
                    );
                    leave();
                },
                onError: (error) => {
                    // A taken key belongs on the field, not in a toast about a
                    // form that is still on screen and still looks fine.
                    if (error instanceof ApiError && error.status === 409) {
                        setKeyConflict(derivedKey);
                        return;
                    }
                    failed();
                }
            }
        );
    };

    const confirmDelete = () => {
        if (!deleting) return;
        const name = deleting.label;
        remove.mutate(deleting.id, {
            onSuccess: () => {
                toast.success(intl.formatMessage(messages.deleted, { name }));
                setDeleting(null);
                leave();
            },
            onError: () => {
                setDeleting(null);
                failed();
            }
        });
    };

    if (!canRead || !canManage) {
        return (
            <>
                {bar}
                <Container>
                    <ContainerHeader title={pageTitle} />
                    <p className="mt-6 text-sm text-muted-foreground">
                        {intl.formatMessage(messages.noAccess)}
                    </p>
                </Container>
            </>
        );
    }

    if (editing && loaded.isPending) {
        return (
            <>
                {bar}
                <Container>
                    {/* The same skeleton the route's own chunk fallback draws,
                        so loading the page and loading the audience on it are
                        one shape rather than two. */}
                    <SegmentFormSkeleton />
                </Container>
            </>
        );
    }

    if (editing && (loaded.isError || !segment)) {
        return (
            <>
                {bar}
                <Container>
                    <Alert variant="destructive" role="alert" className="mt-6">
                        <AlertDescription>
                            {intl.formatMessage(messages.loadError)}
                        </AlertDescription>
                    </Alert>
                </Container>
            </>
        );
    }

    const submitLabel = intl.formatMessage(
        editing ? messages.submitEdit : messages.submitCreate
    );

    return (
        <>
            {bar}
            <Container>
                <div className="max-w-[940px]">
                    <ContainerHeader
                        title={pageTitle}
                        subtitle={intl.formatMessage(
                            editing ? messages.editBody : messages.createBody
                        )}
                        // Editing, Save lives in the top bar — the header's
                        // actions portal there — and submits the form by id.
                        actions={
                            editing ? (
                                <Button
                                    type="submit"
                                    form={FORM_ID}
                                    disabled={submitting}
                                >
                                    {submitting ? <Spinner /> : null}
                                    {submitLabel}
                                </Button>
                            ) : undefined
                        }
                    />

                    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                        <Card className="shadow-none">
                            {/* `noValidate` because the messages are ours: the
                                browser's bubble says something else, in a
                                different language, and disappears on the next
                                keystroke. */}
                            <form
                                id={FORM_ID}
                                noValidate
                                className="flex flex-col gap-4 p-4"
                                onSubmit={submit}
                            >
                                {/* The convention, stated once for everyone.
                                    The asterisks are `aria-hidden` — the
                                    controls carry `aria-required`, which is
                                    what is announced. */}
                                <p className="text-xs text-muted-foreground">
                                    {intl.formatMessage(
                                        messages.requiredLegend
                                    )}
                                </p>

                                <Field
                                    data-invalid={
                                        Boolean(labelError) || undefined
                                    }
                                >
                                    <FieldLabel htmlFor="segment-label">
                                        {intl.formatMessage(messages.label)}
                                        <RequiredMark />
                                    </FieldLabel>
                                    <Input
                                        id="segment-label"
                                        value={label}
                                        autoFocus
                                        // `aria-required`, not the HTML
                                        // `required`: the form is `noValidate`,
                                        // so the native attribute would carry
                                        // the semantics of a check that never
                                        // runs.
                                        aria-required
                                        aria-invalid={Boolean(labelError)}
                                        aria-describedby={
                                            labelError
                                                ? 'segment-label-error'
                                                : undefined
                                        }
                                        onBlur={onBlur('label')}
                                        onChange={(event) =>
                                            setLabel(event.target.value)
                                        }
                                    />
                                    {labelError ? (
                                        <FieldError id="segment-label-error">
                                            {labelError}
                                        </FieldError>
                                    ) : null}
                                </Field>

                                <Field
                                    data-invalid={
                                        Boolean(keyError) || undefined
                                    }
                                >
                                    <FieldLabel htmlFor="segment-key">
                                        {intl.formatMessage(messages.key)}
                                        {/* Marked only while it can still be
                                            typed. Editing, it is a fact about
                                            the audience, not an input. */}
                                        {editing ? null : <RequiredMark />}
                                    </FieldLabel>
                                    <Input
                                        id="segment-key"
                                        value={derivedKey}
                                        readOnly={editing}
                                        className={
                                            editing
                                                ? 'bg-muted font-mono shadow-none'
                                                : 'font-mono'
                                        }
                                        aria-required={
                                            editing ? undefined : true
                                        }
                                        aria-invalid={Boolean(keyError)}
                                        aria-describedby={
                                            keyError
                                                ? 'segment-key-error'
                                                : 'segment-key-hint'
                                        }
                                        onBlur={onBlur('key')}
                                        onChange={(event) => {
                                            setKeyTouched(true);
                                            setKey(event.target.value);
                                        }}
                                    />
                                    {keyError ? (
                                        <FieldError id="segment-key-error">
                                            {keyError}
                                        </FieldError>
                                    ) : (
                                        <FieldDescription id="segment-key-hint">
                                            {intl.formatMessage(
                                                editing
                                                    ? messages.keyFixed
                                                    : messages.keyHint
                                            )}
                                        </FieldDescription>
                                    )}
                                </Field>

                                <Field
                                    data-invalid={
                                        Boolean(tagsError) || undefined
                                    }
                                >
                                    <FieldLabel htmlFor="segment-tags">
                                        {intl.formatMessage(messages.tags)}
                                    </FieldLabel>
                                    <ReaderTagsInput
                                        id="segment-tags"
                                        value={tags}
                                        onChange={setTags}
                                        onBlur={onBlur('tags')}
                                        invalid={Boolean(tagsError)}
                                        disabled={submitting}
                                        describedBy={
                                            tagsError
                                                ? 'segment-tags-error'
                                                : 'segment-tags-hint'
                                        }
                                    />
                                    {tagsError ? (
                                        <FieldError id="segment-tags-error">
                                            {tagsError}
                                        </FieldError>
                                    ) : (
                                        <FieldDescription id="segment-tags-hint">
                                            {intl.formatMessage(
                                                messages.tagsHint,
                                                {
                                                    count: tags.length,
                                                    max: SEGMENT_TAGS_MAX
                                                }
                                            )}
                                        </FieldDescription>
                                    )}
                                </Field>

                                <OfferedInField
                                    mode={scope}
                                    onModeChange={setScope}
                                    value={workspaceIds}
                                    onChange={setWorkspaceIds}
                                    error={scopeError}
                                    disabled={submitting}
                                />
                            </form>
                        </Card>

                        <div className="flex flex-col gap-4">
                            {editing && segment ? (
                                <>
                                    <SegmentUsagePanel segment={segment} />
                                    <Card className="border-destructive/30 shadow-none">
                                        <section
                                            aria-labelledby="segment-delete-heading"
                                            className="flex flex-col items-start gap-2 p-4"
                                        >
                                            <h2
                                                id="segment-delete-heading"
                                                className="text-sm font-semibold"
                                            >
                                                {intl.formatMessage(
                                                    messages.deleteHeading
                                                )}
                                            </h2>
                                            <p className="text-xs text-muted-foreground">
                                                {intl.formatMessage(
                                                    messages.deleteBody
                                                )}
                                            </p>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="mt-1 text-destructive shadow-none hover:text-destructive"
                                                onClick={() =>
                                                    setDeleting(segment)
                                                }
                                            >
                                                <Trash2 aria-hidden />
                                                {intl.formatMessage(
                                                    messages.deleteCta
                                                )}
                                            </Button>
                                        </section>
                                    </Card>
                                </>
                            ) : (
                                <ReaderTester
                                    name={label}
                                    tags={effectiveTags(tags, derivedKey)}
                                />
                            )}
                        </div>
                    </div>

                    {editing ? null : (
                        <div className="mt-4 flex items-center gap-2">
                            {/* Not disabled on invalid input: a dead button
                                explains nothing, and pressing it is how
                                somebody with nothing focused finds out which
                                field is wrong. */}
                            <Button
                                type="submit"
                                form={FORM_ID}
                                disabled={submitting}
                            >
                                {submitting ? <Spinner /> : null}
                                {submitLabel}
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                disabled={submitting}
                                onClick={leave}
                            >
                                {intl.formatMessage(messages.cancel)}
                            </Button>
                        </div>
                    )}
                </div>
            </Container>

            <DeleteSegmentDialog
                segment={deleting}
                busy={remove.isPending}
                onOpenChange={(open) => {
                    if (!open) setDeleting(null);
                }}
                onConfirm={confirmDelete}
            />
        </>
    );
}
