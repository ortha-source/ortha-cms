import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { SchemaDocumentEnvelope } from '@orthacms/schema-builder-domain';
import { useUnsavedChanges } from '@orthacms/utils-admin';
import { useBuilderAccess } from '../../../application/useBuilderAccess';
import { useSchemaDraft } from '../../../application/useSchemaDraft';
import { newTypeDoc } from '../../../domain/newTypeDoc';
import { ContentModelChrome } from '../ContentModelChrome';
import { ContentModelEmpty } from '../ContentModelEmpty';
import { ContentModelLayout } from '../ContentModelLayout';
import { DraftActions } from '../DraftActions';
import { ReadOnlyNotice } from '../ReadOnlyNotice';
import { TypeEditor } from '../TypeEditor';
import { TypeRail } from '../TypeRail';
import { NewTypeDialog } from '../TypeRail/NewTypeDialog';

/**
 * The loaded document and the draft over it: why it is read-only, or the
 * draft's account in the header; the rail; the selected type. The type comes
 * from the URL; an unknown name falls back to the first type. Leaving the
 * page with unsaved changes asks first — moving between types does not.
 */
export function ContentModelWorkspace({
    envelope
}: {
    envelope: SchemaDocumentEnvelope;
}) {
    const { typeName } = useParams();
    const navigate = useNavigate();
    const access = useBuilderAccess(envelope.capabilities);
    const draft = useSchemaDraft(envelope.document);
    const [creating, setCreating] = useState(false);
    useUnsavedChanges(draft.changes.length > 0, 'schema-builder.draft');
    const { types } = draft.document;
    const selected = types.find((type) => type.name === typeName) ?? types[0];

    return (
        <ContentModelChrome
            actions={
                access.canEdit && (
                    <DraftActions
                        changes={draft.changes.length}
                        issues={draft.issues.length}
                        onDiscard={draft.discard}
                    />
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
