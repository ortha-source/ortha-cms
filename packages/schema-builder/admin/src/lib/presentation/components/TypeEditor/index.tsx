import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
    BuilderCapabilities,
    FieldDocType,
    TypeDoc
} from '@orthacms/schema-builder-domain';
import type { BuilderAccess } from '../../../application/useBuilderAccess';
import { useFieldEditor } from '../../../application/useFieldEditor';
import type { SchemaDraftState } from '../../../application/useSchemaDraft';
import { fieldIssues, typeIssues } from '../../../domain/draftIssues';
import { FIELD_CATALOG } from '../../../domain/fieldCatalog';
import { newFieldKey } from '../../../domain/identifiers';
import type { TypePatch } from '../../../domain/schemaDraftAction';
import { typeEditability } from '../../../domain/typeEditability';
import { AddFieldDialog } from '../AddFieldDialog';
import { FieldSheet } from '../FieldSheet';
import { GeneralGroupsSheet } from '../GeneralGroupsSheet';
import { FieldList } from './FieldList';
import type { FieldListEditing } from './FieldList/fieldListEditing';
import { HandWrittenNotice } from './HandWrittenNotice';
import { RemoveTypeButton } from './RemoveTypeButton';
import { TypeIssues } from './TypeIssues';
import { TypeSettings } from './TypeSettings';
import { TypeSummary } from './TypeSummary';

type Props = {
    type: TypeDoc;
    capabilities: BuilderCapabilities;
    access: BuilderAccess;
    draft: SchemaDraftState;
};

/**
 * The selected type: read-only, or — when this person may change it on this
 * server and the builder owns its file — its settings, its fields and the
 * sheets that edit them. Every edit lands in the draft at once.
 */
export function TypeEditor({ type, capabilities, access, draft }: Props) {
    const navigate = useNavigate();
    const editable = typeEditability(type, capabilities, access.canManage).ok;
    const [fieldKey, setFieldKey] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [groupsOpen, setGroupsOpen] = useState(false);
    const issues = typeIssues(draft.issues, type.name);
    const editor = useFieldEditor(draft, type.name, fieldKey);

    const patchType = (patch: TypePatch) => {
        draft.dispatch({ type: 'type.update', name: type.name, patch });
        if (patch.name !== undefined && patch.name !== type.name)
            navigate(`/content-model/${patch.name}`, { replace: true });
    };
    const addField = (fieldType: FieldDocType, name: string, label: string) => {
        const catalog =
            FIELD_CATALOG.find((entry) => entry.type === fieldType) ??
            FIELD_CATALOG[0];
        const spec = catalog.spec(
            draft.document.types.map((candidate) => candidate.name)
        );
        const key = newFieldKey();
        draft.dispatch({
            type: 'field.add',
            typeName: type.name,
            entry: {
                key,
                name,
                spec: label ? { ...spec, admin: { label } } : spec
            }
        });
        setAdding(false);
        setFieldKey(key);
    };
    const editing: FieldListEditing | undefined = editable
        ? {
              onEdit: setFieldKey,
              onRemove: (key) =>
                  draft.dispatch({
                      type: 'field.remove',
                      typeName: type.name,
                      key
                  }),
              onMove: (key, before) =>
                  draft.dispatch({
                      type: 'field.move',
                      typeName: type.name,
                      key,
                      before
                  }),
              onAddField: () => setAdding(true),
              onManageGroups: () => setGroupsOpen(true),
              issuesOf: (field) =>
                  fieldIssues(draft.issues, type.name, field).length
          }
        : undefined;

    return (
        <div className="flex flex-col gap-4">
            {capabilities.editable && type.origin === 'code' && (
                <HandWrittenNotice type={type} />
            )}
            {editable && <TypeIssues issues={issues} />}
            {editable ? (
                <TypeSettings type={type} onChange={patchType} />
            ) : (
                <TypeSummary type={type} />
            )}
            <FieldList type={type} editing={editing} />
            {editable && (
                <>
                    <div className="flex justify-end">
                        <RemoveTypeButton
                            type={type}
                            onRemove={() => {
                                draft.dispatch({
                                    type: 'type.remove',
                                    name: type.name
                                });
                                navigate('/content-model', { replace: true });
                            }}
                        />
                    </div>
                    <AddFieldDialog
                        open={adding}
                        onOpenChange={setAdding}
                        taken={type.fields.map((entry) => entry.name)}
                        onAdd={addField}
                    />
                    <FieldSheet
                        editor={editor}
                        type={type}
                        document={draft.document}
                        issues={
                            editor
                                ? fieldIssues(
                                      draft.issues,
                                      type.name,
                                      editor.entry.name
                                  )
                                : []
                        }
                        onClose={() => setFieldKey(null)}
                    />
                    <GeneralGroupsSheet
                        type={groupsOpen ? type : null}
                        onChange={(groups) =>
                            draft.dispatch({
                                type: 'groups.set',
                                typeName: type.name,
                                groups
                            })
                        }
                        onClose={() => setGroupsOpen(false)}
                    />
                </>
            )}
        </div>
    );
}
