import type {
    SchemaChange,
    SchemaDocument
} from '@orthacms/schema-builder-domain';
import { NotBuilderOwnedError } from '../../domain/errors';

/**
 * [schema-builder:I-02] The builder writes only files it generated. A change to
 * a hand-written type — or a draft that claims a type is builder-owned when its
 * file says otherwise — is refused.
 */
export function assertOwned(
    current: SchemaDocument,
    draft: SchemaDocument,
    changes: readonly SchemaChange[]
): void {
    const origin = new Map(
        current.types.map((type) => [type.name, type.origin])
    );
    const touched = new Set(changes.map((change) => change.type));
    const claimed = draft.types.filter(
        (type) => origin.has(type.name) && type.origin !== origin.get(type.name)
    );
    const foreign = new Set([
        ...current.types
            .filter((type) => type.origin === 'code' && touched.has(type.name))
            .map((type) => type.name),
        ...claimed.map((type) => type.name)
    ]);
    if (foreign.size) throw new NotBuilderOwnedError([...foreign]);
}
