import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { SchemaDocumentEnvelope } from '@orthacms/schema-builder-domain';
import { useUnsavedChanges } from '@orthacms/utils-admin';
import { useApplyFlow } from '../../../application/useApplyFlow';
import { useBuilderAccess } from '../../../application/useBuilderAccess';
import { useSchemaDraft } from '../../../application/useSchemaDraft';
import { newTypeDoc } from '../../../domain/newTypeDoc';
import { ApplyProgress } from '../ApplyProgress';
import { ChangesDrawer } from '../ChangesDrawer';
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
 * Review opens the plan; an apply runs to the restart, and a type it created
 * is offered to workspaces.
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
    // While an apply runs the draft is on its way to disk: leaving is fine.
    useUnsavedChanges(
        draft.changes.length > 0 && flow.stage === 'idle',
        'schema-builder.draft'
    );
    const { types } = draft.document;
    const selected = types.find((type) => type.name === typeName) ?? types[0];

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
                            onClick={flow.review}
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
            {access.canEdit && (
                <>
                    <ChangesDrawer flow={flow} />
                    <ApplyProgress
                        stage={flow.stage}
                        failure={flow.failure}
                        onClose={flow.dismiss}
                    />
                    {/* Mounted only when there is something to grant: it reads the workspaces. */}
                    {flow.created.length > 0 && (
                        <GrantNewTypeDialog
                            types={flow.created}
                            onClose={flow.dismissGrant}
                        />
                    )}
                </>
            )}
        </ContentModelChrome>
    );
}
