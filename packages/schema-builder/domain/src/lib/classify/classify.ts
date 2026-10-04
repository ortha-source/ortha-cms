import type { SchemaChange } from '../diff/schema-change';
import type { ClassifyContext } from './change-facts';
import type { ClassifiedChange } from './classified-change';
import { CLASSIFIERS, type Classifier } from './classifiers';

/** Every change with its verdict, in the diff's order. */
export function classify(
    changes: readonly SchemaChange[],
    ctx: ClassifyContext
): ClassifiedChange[] {
    return changes.map((change) =>
        (CLASSIFIERS[change.kind] as Classifier<SchemaChange['kind']>)(
            change as never,
            ctx
        )
    );
}

/** True when any verdict blocks the apply. */
export const isBlocked = (changes: readonly ClassifiedChange[]): boolean =>
    changes.some((change) => change.safety === 'blocked');

/** True when the apply needs a migration at all. */
export const needsMigration = (changes: readonly ClassifiedChange[]): boolean =>
    changes.some((change) => change.storage);
