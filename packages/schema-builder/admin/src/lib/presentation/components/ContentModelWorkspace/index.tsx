import { useEffect, useState } from 'react';
import {
    useLocation,
    useNavigate,
    useParams,
    useSearchParams
} from 'react-router-dom';
import type { SchemaDocumentEnvelope } from '@orthacms/schema-builder-domain';
import { useUnsavedChanges } from '@orthacms/utils-admin';
import { useApplyFlow } from '../../../application/useApplyFlow';
import { useBuilderAccess } from '../../../application/useBuilderAccess';
import { useSchemaDraft } from '../../../application/useSchemaDraft';
import { newTypeDoc } from '../../../domain/newTypeDoc';
import { typeEditability } from '../../../domain/typeEditability';
import { AddFieldPage } from '../AddFieldPage';
import { ChangesReview } from '../ChangesReview';
import { ContentModelChrome } from '../ContentModelChrome';
import { ContentModelEmpty } from '../ContentModelEmpty';
import { ContentModelLayout } from '../ContentModelLayout';
import { DraftActions } from '../DraftActions';
import { GrantNewTypeDialog } from '../GrantNewTypeDialog';
import { ReadOnlyNotice } from '../ReadOnlyNotice';
import { ReviewChangesButton } from '../ReviewChangesButton';
import { TypeEditor } from '../TypeEditor';
import { TypeRail } from '../TypeRail';
import { NewTypeDialog } from '../TypeRail/NewTypeDialog';

/**
 * The loaded document and the draft over it: why it is read-only, or the
 * draft's account in the header; the rail; the selected type. The type comes
 * from the URL; an unknown name falls back to the first type. Leaving the
 * page with unsaved changes asks first — moving between types does not.
 * Review is a state of this page (`?review`): a page with steps over the
 * same draft, so going back finds it untouched. An apply runs to the
 * restart, and a type it created is offered to workspaces.
 */
export function ContentModelWorkspace({
    envelope
}: {
    envelope: SchemaDocumentEnvelope;
}) {
    const { typeName } = useParams();
    const navigate = useNavigate();
    const access = useBuilderAccess(envelope.capabilities);
    const draft = useSchemaDraft(envelope.document, envelope.bootId);
    const flow = useApplyFlow(envelope, draft);
    const [creating, setCreating] = useState(false);
    const location = useLocation();
    const [params] = useSearchParams();
    const reviewing = access.canEdit && params.has('review');
    const hasChanges = draft.changes.length > 0;
    // While an apply runs the draft is on its way to disk: leaving is fine.
    useUnsavedChanges(
        draft.changes.length > 0 && flow.stage === 'idle',
        'schema-builder.draft'
    );
    const { review: requestPlan, stage } = flow;
    const planStatus = flow.plan.status;
    // Reached by Back/Forward or a link rather than the button: ask for the
    // plan here. With nothing to review, there is no review to show.
    useEffect(() => {
        if (!reviewing || stage !== 'idle') return;
        if (!hasChanges) {
            navigate(location.pathname, { replace: true });
            return;
        }
        if (planStatus === 'idle') requestPlan();
    }, [
        reviewing,
        stage,
        hasChanges,
        planStatus,
        requestPlan,
        navigate,
        location.pathname
    ]);

    const openReview = () => {
        flow.review();
        navigate({ search: '?review' }, { state: { fromEditor: true } });
    };
    // Back to the editor from a page this one opened: pop that history entry
    // rather than stack a second editor on top of it.
    const backToEditor = () => {
        if ((location.state as { fromEditor?: boolean } | null)?.fromEditor)
            navigate(-1);
        else navigate(location.pathname, { replace: true });
    };
    const finishReview = () => {
        backToEditor();
        flow.dismiss();
    };

    if (reviewing) {
        return (
            <>
                <ChangesReview
                    flow={flow}
                    editorHref={location.pathname}
                    onFinish={finishReview}
                />
                {/* Mounted only when there is something to grant: it reads the workspaces. */}
                {flow.created.length > 0 && (
                    <GrantNewTypeDialog
                        types={flow.created}
                        onClose={flow.dismissGrant}
                    />
                )}
            </>
        );
    }

    const { types } = draft.document;
    const selected = types.find((type) => type.name === typeName) ?? types[0];

    // Adding a field: a page with steps over the same draft, for a type this
    // person may change. Anything else — no such type, a hand-written one —
    // has no field to add, and the editor simply shows.
    if (
        params.has('addField') &&
        selected &&
        typeEditability(selected, envelope.capabilities, access.canManage).ok
    ) {
        return (
            <AddFieldPage
                type={selected}
                draft={draft}
                editorHref={location.pathname}
                onAdded={(entry) => {
                    draft.dispatch({
                        type: 'field.add',
                        typeName: selected.name,
                        entry
                    });
                    backToEditor();
                }}
            />
        );
    }

    return (
        <ContentModelChrome
            actions={
                access.canEdit && (
                    <>
                        <DraftActions
                            changes={draft.changes.length}
                            issues={draft.issues.length}
                            onDiscard={draft.discard}
                        />
                        <ReviewChangesButton
                            changes={draft.changes.length}
                            issues={draft.issues.length}
                            onClick={openReview}
                        />
                    </>
                )
            }
        >
            <ReadOnlyNotice reason={access.reason} />
            {types.length === 0 && !access.canEdit ? (
                <ContentModelEmpty />
            ) : (
                <ContentModelLayout
                    rail={
                        <TypeRail
                            types={types}
                            selected={selected?.name}
                            dirty={draft.dirtyTypes}
                            onCreate={
                                access.canEdit
                                    ? () => setCreating(true)
                                    : undefined
                            }
                        />
                    }
                    editor={
                        selected && (
                            <TypeEditor
                                key={selected.name}
                                type={selected}
                                capabilities={envelope.capabilities}
                                access={access}
                                draft={draft}
                            />
                        )
                    }
                />
            )}
            {access.canEdit && (
                <NewTypeDialog
                    open={creating}
                    onOpenChange={setCreating}
                    taken={types.map((type) => type.name)}
                    onCreate={(name, label, kind) => {
                        draft.dispatch({
                            type: 'type.add',
                            doc: newTypeDoc(name, label, kind)
                        });
                        setCreating(false);
                        navigate(`/content-model/${name}`);
                    }}
                />
            )}
        </ContentModelChrome>
    );
}
