import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
    BuilderCapabilities,
    GroupDoc,
    TypeDoc
} from '@orthacms/schema-builder-domain';
import type { BuilderAccess } from '../../../application/useBuilderAccess';
import { useFieldEditor } from '../../../application/useFieldEditor';
import type { SchemaDraftState } from '../../../application/useSchemaDraft';
import { fieldIssues, typeIssues } from '../../../domain/draftIssues';
import { moveGroup } from '../../../domain/moveGroup';
import type { TypePatch } from '../../../domain/schemaDraftAction';
import { typeEditability } from '../../../domain/typeEditability';
import { FieldSheet } from '../FieldSheet';
import { GeneralGroupsSheet } from '../GeneralGroupsSheet';
import { GroupSheet } from '../GroupSheet';
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
    const [groupsOpen, setGroupsOpen] = useState(false);
    const [groupKey, setGroupKey] = useState<string | null>(null);
    const setGroups = (groups: GroupDoc[]) =>
        draft.dispatch({ type: 'groups.set', typeName: type.name, groups });
    const group = type.groups.find((candidate) => candidate.key === groupKey);
    const issues = typeIssues(draft.issues, type.name);
    const editor = useFieldEditor(draft, type.name, fieldKey);

    const patchType = (patch: TypePatch) => {
        draft.dispatch({ type: 'type.update', name: type.name, patch });
        if (patch.name !== undefined && patch.name !== type.name)
            navigate(`/content-model/${patch.name}`, { replace: true });
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
              onRegroup: (key, group, before) =>
                  draft.dispatch({
                      type: 'field.regroup',
                      typeName: type.name,
                      key,
                      group,
                      before
                  }),
              onMoveGroup: (key, over) =>
                  setGroups(moveGroup(type.groups, key, over)),
              onEditGroup: setGroupKey,
              onRemoveGroup: (key) =>
                  setGroups(type.groups.filter((entry) => entry.key !== key)),
              // Adding a field is a page with steps over the same draft (`?addField`).
              onAddField: () =>
                  navigate(
                      { search: '?addField' },
                      { state: { fromEditor: true } }
                  ),
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
            {editable && (
                <TypeIssues
                    // "Defines no fields" is what the empty state below says.
                    issues={issues.filter(
                        (issue) => issue.code !== 'type.no-fields'
                    )}
                />
            )}
            {editable ? (
                <TypeSettings
                    type={type}
                    served={draft.base.types.find(
                        (candidate) => candidate.name === type.name
                    )}
                    onChange={patchType}
                />
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
                        onChange={setGroups}
                        onClose={() => setGroupsOpen(false)}
                    />
                    <GroupSheet
                        group={group ?? null}
                        onChange={(next) =>
                            setGroups(
                                type.groups.map((entry) =>
                                    entry.key === next.key ? next : entry
                                )
                            )
                        }
                        onRemove={() => {
                            setGroups(
                                type.groups.filter(
                                    (entry) => entry.key !== groupKey
                                )
                            );
                            setGroupKey(null);
                        }}
                        onClose={() => setGroupKey(null)}
                    />
                </>
            )}
        </div>
    );
}
