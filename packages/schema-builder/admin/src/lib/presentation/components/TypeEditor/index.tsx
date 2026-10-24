import { useState, type ReactNode } from 'react';
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
import { AddFieldFlow } from './AddFieldFlow';
import { GeneralGroupsSheet } from '../GeneralGroupsSheet';
import { GroupSheet } from '../GroupSheet';
import { FieldList } from './FieldList';
import type { FieldListEditing } from './FieldList/fieldListEditing';
import { HandWrittenNotice } from './HandWrittenNotice';
import { TypeIssues } from './TypeIssues';
import { TypeHeader } from './TypeHeader';

type Props = {
    type: TypeDoc;
    capabilities: BuilderCapabilities;
    access: BuilderAccess;
    draft: SchemaDraftState;
    /** A page-wide notice, drawn under the header (why the page is read-only). */
    notice?: ReactNode;
};

/**
 * The selected type: its header (the page's `<h1>`), then its fields first —
 * read-only, or, when this person may change it on this server and the
 * builder owns its file, with the sheets that edit them. Its own settings
 * sit behind the header's Settings button. Every edit lands in the draft at
 * once.
 */
export function TypeEditor({
    type,
    capabilities,
    access,
    draft,
    notice
}: Props) {
    const navigate = useNavigate();
    const editable = typeEditability(type, capabilities, access.canManage).ok;
    const [fieldKey, setFieldKey] = useState<string | null>(null);
    const [groupsOpen, setGroupsOpen] = useState(false);
    const [groupKey, setGroupKey] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
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
              // A dialog for the kind, then the field's own panel.
              onAddField: () => setAdding(true),
              onManageGroups: () => setGroupsOpen(true),
              issuesOf: (field) =>
                  fieldIssues(draft.issues, type.name, field).length
          }
        : undefined;

    return (
        <div className="flex flex-col gap-5">
            <TypeHeader
                type={type}
                editing={
                    editable
                        ? {
                              served: draft.base.types.find(
                                  (candidate) => candidate.name === type.name
                              ),
                              onChange: patchType,
                              onRemove: () => {
                                  draft.dispatch({
                                      type: 'type.remove',
                                      name: type.name
                                  });
                                  navigate('/content-model', { replace: true });
                              }
                          }
                        : undefined
                }
            />
            {notice}
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
            <FieldList type={type} editing={editing} />
            {editable && (
                <>
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
                        onRemove={() => {
                            if (editor)
                                draft.dispatch({
                                    type: 'field.remove',
                                    typeName: type.name,
                                    key: editor.entry.key
                                });
                            setFieldKey(null);
                        }}
                    />
                    {adding && (
                        <AddFieldFlow
                            type={type}
                            document={draft.document}
                            onCancel={() => setAdding(false)}
                            onAdded={(entry) => {
                                draft.dispatch({
                                    type: 'field.add',
                                    typeName: type.name,
                                    entry
                                });
                                setAdding(false);
                            }}
                        />
                    )}
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
