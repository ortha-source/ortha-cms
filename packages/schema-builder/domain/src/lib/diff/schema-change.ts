import type { FieldDoc } from '../document/field-doc';

export type TypeFlag = 'publishable' | 'paranoid' | 'i18n';
export type TypeMetaKey = 'label' | 'description' | 'path' | 'groups';

/** One difference between two documents, as the classifier and the review list see it. */
export type SchemaChange =
    | { kind: 'type.add'; type: string }
    | { kind: 'type.remove'; type: string }
    | { kind: 'type.meta'; type: string; keys: TypeMetaKey[] }
    | { kind: 'type.flag'; type: string; flag: TypeFlag; to: boolean }
    | { kind: 'field.add'; type: string; field: string; spec: FieldDoc }
    | { kind: 'field.remove'; type: string; field: string; spec: FieldDoc }
    | { kind: 'field.rename'; type: string; from: string; to: string }
    | {
          kind: 'field.retype';
          type: string;
          field: string;
          from: string;
          to: string;
      }
    | {
          kind: 'field.update';
          type: string;
          field: string;
          keys: string[];
          before: FieldDoc;
          after: FieldDoc;
      }
    | { kind: 'field.reorder'; type: string };

export type ChangeKind = SchemaChange['kind'];
export type ChangeOf<K extends ChangeKind> = Extract<SchemaChange, { kind: K }>;
