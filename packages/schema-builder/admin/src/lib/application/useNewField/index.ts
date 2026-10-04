import { useMemo, useState } from 'react';
import type {
    FieldAdminDoc,
    FieldEntry,
    SchemaDocument
} from '@orthacms/schema-builder-domain';
import type { SchemaIssue } from '@orthacms/content-domain';
import { catalogEntry } from '../../domain/fieldCatalog';
import { draftIssues, fieldIssues } from '../../domain/draftIssues';
import { newFieldKey, toFieldName } from '../../domain/identifiers';
import { patchAdmin, patchSpec } from '../../domain/fieldPatch';
import { addField } from '../../domain/schemaDraft/addField';
import type { FieldEditor } from '../useFieldEditor';

/** Why the name cannot be used yet. */
export type NameProblem = 'empty' | 'invalid' | 'taken';

const NAME = /^[a-zA-Z][a-zA-Z0-9]*$/;

/** A field being added: held here until the last step, then handed to the draft. */
export type NewField = {
    readonly choice: string;
    readonly choose: (id: string) => void;
    /** The same contract the field sheet edits through, over local state. */
    readonly editor: FieldEditor;
    readonly nameProblem: NameProblem | null;
    /** What the schema rules say about the field, as it would land in the draft. */
    readonly issues: readonly SchemaIssue[];
};

/**
 * The field the "Add a field" page builds. Nothing reaches the draft until
 * it is added — going back to the editor leaves no half-made field behind.
 * The machine name follows the label until it is typed in by hand; choosing
 * another kind starts its spec over, keeping the label and the name.
 */
export function useNewField(
    document: SchemaDocument,
    typeName: string
): NewField {
    const types = document.types.map((type) => type.name);
    const [choice, setChoice] = useState('text');
    const [key] = useState(newFieldKey);
    const [entry, setEntry] = useState<FieldEntry>(() => ({
        key,
        name: '',
        spec: catalogEntry('text').spec(types)
    }));
    const [named, setNamed] = useState(false);

    const editor: FieldEditor = {
        entry,
        setName: (name) => {
            setNamed(true);
            setEntry((current) => ({ ...current, name }));
        },
        setSpec: (patch) =>
            setEntry((current) => ({
                ...current,
                spec: patchSpec(current.spec, patch)
            })),
        setAdmin: (patch: Partial<FieldAdminDoc>) =>
            setEntry((current) => ({
                ...current,
                name:
                    !named && patch.label !== undefined
                        ? toFieldName(patch.label)
                        : current.name,
                spec: patchAdmin(current.spec, patch)
            }))
    };

    const choose = (id: string) => {
        setChoice(id);
        setEntry((current) => {
            const spec = catalogEntry(id).spec(types);
            const label = current.spec.admin?.label;
            return {
                ...current,
                spec: label ? patchAdmin(spec, { label }) : spec
            };
        });
    };

    const type = document.types.find(
        (candidate) => candidate.name === typeName
    );
    const taken = (type?.fields ?? []).map((field) => field.name);
    const nameProblem: NameProblem | null = !entry.name
        ? 'empty'
        : !NAME.test(entry.name)
          ? 'invalid'
          : taken.includes(entry.name)
            ? 'taken'
            : null;

    const issues = useMemo(
        () =>
            entry.name
                ? fieldIssues(
                      draftIssues(
                          addField(document, {
                              type: 'field.add',
                              typeName,
                              entry
                          })
                      ),
                      typeName,
                      entry.name
                  )
                : [],
        [document, typeName, entry]
    );

    return { choice, choose, editor, nameProblem, issues };
}
