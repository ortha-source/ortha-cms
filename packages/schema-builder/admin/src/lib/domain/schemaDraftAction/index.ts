import type {
    FieldDoc,
    FieldEntry,
    GroupDoc,
    SchemaDocument,
    TypeDoc
} from '@orthacms/schema-builder-domain';

/** The type options a person edits in the type's settings. */
export type TypePatch = Partial<
    Pick<
        TypeDoc,
        | 'name'
        | 'label'
        | 'description'
        | 'path'
        | 'publishable'
        | 'paranoid'
        | 'i18n'
    >
>;

/** Everything the editor can do to the draft — one reducer handler per kind. */
export type SchemaDraftAction =
    | { type: 'reset'; document: SchemaDocument }
    | { type: 'type.add'; doc: TypeDoc }
    | { type: 'type.update'; name: string; patch: TypePatch }
    | { type: 'type.remove'; name: string }
    | { type: 'field.add'; typeName: string; entry: FieldEntry }
    | {
          type: 'field.update';
          typeName: string;
          key: string;
          name: string;
          spec: FieldDoc;
      }
    | { type: 'field.remove'; typeName: string; key: string }
    | { type: 'field.move'; typeName: string; key: string; before: string }
    | { type: 'groups.set'; typeName: string; groups: GroupDoc[] };
