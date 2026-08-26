import { useEffect, useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Plus, ShieldCheck } from 'lucide-react';
import { PageTopBar } from '@orthacms/shell-admin';
import { useHasPermission } from '@orthacms/identity-admin';
import { useDocumentTitle } from '@orthacms/utils-admin';
import {
    Alert,
    AlertDescription,
    Button,
    Container,
    ContainerHeader,
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
    toast
} from '@orthacms/design-system';
import { MAX_SEGMENT_TYPES } from '@orthacms/segments-domain';
import type { SegmentType } from '../../../domain/types/segmentType';
import type { Segment } from '../../../domain/types/segment';
import { useSegmentTypes } from '../../../application/useSegmentTypes';
import {
    useCreateSegmentType,
    useRetireSegmentType,
    useUpdateSegmentType
} from '../../../application/useSegmentTypeMutations';
import {
    useCreateSegment,
    useDeleteSegment,
    useUpdateSegment
} from '../../../application/useSegmentMutations';
import { SegmentTypesTable } from '../../components/SegmentTypesTable';
import { SegmentsPanel } from '../../components/SegmentsPanel';
import { AccessTableSkeleton } from '../../components/AccessSkeleton';
import { AccessNoAccess } from '../../components/AccessNoAccess';
import {
    SegmentTypeDialog,
    type SegmentTypeDraft
} from '../../components/SegmentTypeDialog';
import {
    SegmentDialog,
    type SegmentDraft
} from '../../components/SegmentDialog';

const messages = defineMessages({
    title: { id: 'segments.types.title', defaultMessage: 'Segmentation' },
    subtitle: {
        id: 'segments.types.subtitle',
        defaultMessage:
            'The axes reader access is decided on, and the segments each one holds.'
    },
    create: { id: 'segments.types.create', defaultMessage: 'New type' },
    slotsFull: {
        id: 'segments.types.slotsFull',
        defaultMessage:
            'All {max} projection slots are held. Retire a type to free one.'
    },
    error: {
        id: 'segments.types.error',
        defaultMessage: 'Couldn’t load segment types. Please try again.'
    },
    retry: { id: 'segments.types.retry', defaultMessage: 'Retry' },
    emptyTitle: {
        id: 'segments.types.emptyTitle',
        defaultMessage: 'Nothing is segmented yet'
    },
    emptyBody: {
        id: 'segments.types.emptyBody',
        defaultMessage:
            'Until a segment type exists, every published entry is readable by everyone — nothing about your content API changes. Create an axis to start deciding who sees what.'
    },
    typeCreated: {
        id: 'segments.types.typeCreated',
        defaultMessage: '“{name}” created on slot {slot}'
    },
    typeRetired: {
        id: 'segments.types.typeRetired',
        defaultMessage: '“{name}” retired; everything it was hiding is readable'
    },
    writeError: {
        id: 'segments.types.writeError',
        defaultMessage: 'Couldn’t save that. Please try again.'
    },
    results: {
        id: 'segments.types.results',
        defaultMessage:
            '{count, plural, one {# segment type} other {# segment types}}'
    }
});

/**
 * The installation-wide segmentation directory at `/access`.
 *
 * Two levels on one page: the segment types, and — under the selected one — its
 * segments. Not two routes, because a type is meaningless without its segments
 * and there are at most eight of them; a navigation between two lists that
 * short is friction with nothing on the other side of it.
 *
 * The whole page is gated on `access:read`, and every write control on
 * `access:manage`. That split is the point of having two permissions: an editor
 * needs to *see* that content is restricted — one who cannot will publish an
 * article believing it is public — while changing an axis changes what every
 * reader of the site can see.
 */
export function SegmentTypesPage() {
    const intl = useIntl();
    useDocumentTitle(intl.formatMessage(messages.title));
    const canRead = useHasPermission('access:read');
    const canManage = useHasPermission('access:manage');

    const { data, isPending, isError, refetch } = useSegmentTypes(canRead);
    const types = useMemo(() => data ?? [], [data]);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [typeDialog, setTypeDialog] = useState<{
        open: boolean;
        editing: SegmentType | null;
    }>({ open: false, editing: null });
    const [segmentDialog, setSegmentDialog] = useState<{
        open: boolean;
        editing: Segment | null;
    }>({ open: false, editing: null });

    const createType = useCreateSegmentType();
    const updateType = useUpdateSegmentType();
    const retireType = useRetireSegmentType();
    const createSegment = useCreateSegment();
    const updateSegment = useUpdateSegment();
    const deleteSegment = useDeleteSegment();

    // Select the first live type once the list lands, and let go of a selection
    // whose type has since been retired — otherwise the segments panel below
    // renders against a type that no longer decides anything.
    const selected = types.find((type) => type.id === selectedId) ?? null;
    useEffect(() => {
        if (selected || types.length === 0) return;
        const first = types.find((type) => type.state === 'active');
        setSelectedId(first?.id ?? null);
    }, [selected, types]);

    if (!canRead) {
        return (
            <>
                <PageTopBar
                    icon={ShieldCheck}
                    crumbs={[
                        {
                            key: 'access',
                            label: intl.formatMessage(messages.title)
                        }
                    ]}
                />
                <Container>
                    <ContainerHeader
                        title={intl.formatMessage(messages.title)}
                    />
                    <AccessNoAccess />
                </Container>
            </>
        );
    }

    const held = types.filter((type) => type.state !== 'free').length;
    const slotsFull = held >= MAX_SEGMENT_TYPES;

    const failed = () => toast.error(intl.formatMessage(messages.writeError));

    const submitType = (draft: SegmentTypeDraft) => {
        const editing = typeDialog.editing;
        if (editing) {
            updateType.mutate(
                {
                    id: editing.id,
                    label: draft.label,
                    cardinality: draft.cardinality
                },
                {
                    onSuccess: () =>
                        setTypeDialog({ open: false, editing: null }),
                    onError: failed
                }
            );
            return;
        }
        createType.mutate(draft, {
            onSuccess: (created) => {
                setTypeDialog({ open: false, editing: null });
                setSelectedId(created.id);
                toast.success(
                    intl.formatMessage(messages.typeCreated, {
                        name: created.label,
                        slot: created.slot
                    })
                );
            },
            onError: failed
        });
    };

    const retire = (type: SegmentType) => {
        retireType.mutate(type.id, {
            onSuccess: () =>
                toast.success(
                    intl.formatMessage(messages.typeRetired, {
                        name: type.label
                    })
                ),
            onError: failed
        });
    };

    const submitSegment = (draft: SegmentDraft) => {
        if (!selected) return;
        const editing = segmentDialog.editing;
        if (editing) {
            updateSegment.mutate(
                {
                    typeKey: selected.key,
                    id: editing.id,
                    label: draft.label,
                    tags: draft.tags
                },
                {
                    onSuccess: () =>
                        setSegmentDialog({ open: false, editing: null }),
                    onError: failed
                }
            );
            return;
        }
        createSegment.mutate(
            {
                typeKey: selected.key,
                key: draft.key,
                label: draft.label,
                // An empty list means "use the canonical tag", which the server
                // fills in — sending `[]` would be a segment matching nobody.
                ...(draft.tags.length ? { tags: draft.tags } : {})
            },
            {
                onSuccess: () =>
                    setSegmentDialog({ open: false, editing: null }),
                onError: failed
            }
        );
    };

    return (
        <>
            <PageTopBar
                icon={ShieldCheck}
                crumbs={[
                    { key: 'access', label: intl.formatMessage(messages.title) }
                ]}
            />
            <Container>
                <ContainerHeader
                    title={intl.formatMessage(messages.title)}
                    subtitle={intl.formatMessage(messages.subtitle)}
                    actions={
                        canManage ? (
                            <Button
                                disabled={slotsFull}
                                title={
                                    slotsFull
                                        ? intl.formatMessage(
                                              messages.slotsFull,
                                              { max: MAX_SEGMENT_TYPES }
                                          )
                                        : undefined
                                }
                                onClick={() =>
                                    setTypeDialog({
                                        open: true,
                                        editing: null
                                    })
                                }
                            >
                                <Plus aria-hidden />
                                {intl.formatMessage(messages.create)}
                            </Button>
                        ) : undefined
                    }
                />

                {/* Creating and retiring change the table without a navigation
                    and without a heading change, so announce the count. */}
                {!isPending && !isError ? (
                    <p role="status" aria-live="polite" className="sr-only">
                        {intl.formatMessage(messages.results, {
                            count: types.length
                        })}
                    </p>
                ) : null}

                {slotsFull && canManage ? (
                    <Alert className="mb-4">
                        <AlertDescription>
                            {intl.formatMessage(messages.slotsFull, {
                                max: MAX_SEGMENT_TYPES
                            })}
                        </AlertDescription>
                    </Alert>
                ) : null}

                {isPending ? (
                    <AccessTableSkeleton />
                ) : isError ? (
                    <Alert variant="destructive" role="alert" className="mt-4">
                        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                            <span>{intl.formatMessage(messages.error)}</span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="shadow-none"
                                onClick={() => refetch()}
                            >
                                {intl.formatMessage(messages.retry)}
                            </Button>
                        </AlertDescription>
                    </Alert>
                ) : types.length === 0 ? (
                    <Empty>
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <ShieldCheck aria-hidden />
                            </EmptyMedia>
                            <EmptyTitle>
                                {intl.formatMessage(messages.emptyTitle)}
                            </EmptyTitle>
                            <EmptyDescription>
                                {intl.formatMessage(messages.emptyBody)}
                            </EmptyDescription>
                        </EmptyHeader>
                        {canManage ? (
                            <EmptyContent>
                                <Button
                                    onClick={() =>
                                        setTypeDialog({
                                            open: true,
                                            editing: null
                                        })
                                    }
                                >
                                    <Plus aria-hidden />
                                    {intl.formatMessage(messages.create)}
                                </Button>
                            </EmptyContent>
                        ) : null}
                    </Empty>
                ) : (
                    <>
                        <SegmentTypesTable
                            types={types}
                            selectedId={selected?.id ?? null}
                            onSelect={(type) => setSelectedId(type.id)}
                            canManage={canManage}
                            onRename={(type) =>
                                setTypeDialog({ open: true, editing: type })
                            }
                            onRetire={retire}
                            retiringId={
                                retireType.isPending
                                    ? (retireType.variables ?? null)
                                    : null
                            }
                        />
                        {selected ? (
                            <SegmentsPanel
                                type={selected}
                                canManage={canManage}
                                onCreate={() =>
                                    setSegmentDialog({
                                        open: true,
                                        editing: null
                                    })
                                }
                                onEdit={(segment) =>
                                    setSegmentDialog({
                                        open: true,
                                        editing: segment
                                    })
                                }
                                onDelete={(segment) =>
                                    deleteSegment.mutate(
                                        {
                                            typeKey: selected.key,
                                            id: segment.id
                                        },
                                        { onError: failed }
                                    )
                                }
                                deletingId={
                                    deleteSegment.isPending
                                        ? (deleteSegment.variables?.id ?? null)
                                        : null
                                }
                            />
                        ) : null}
                    </>
                )}
            </Container>

            <SegmentTypeDialog
                open={typeDialog.open}
                onOpenChange={(open) =>
                    setTypeDialog((current) => ({ ...current, open }))
                }
                editing={typeDialog.editing}
                onSubmit={submitType}
                submitting={createType.isPending || updateType.isPending}
            />
            {selected ? (
                <SegmentDialog
                    open={segmentDialog.open}
                    onOpenChange={(open) =>
                        setSegmentDialog((current) => ({ ...current, open }))
                    }
                    type={selected}
                    editing={segmentDialog.editing}
                    onSubmit={submitSegment}
                    submitting={
                        createSegment.isPending || updateSegment.isPending
                    }
                />
            ) : null}
        </>
    );
}
