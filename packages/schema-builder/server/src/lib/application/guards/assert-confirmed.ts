import type { ClassifiedChange } from '@orthacms/schema-builder-domain';
import { UnconfirmedChangesError } from '../../domain/errors';

/** [schema-builder:I-07] Every destructive change is confirmed by its own id — there is no "confirm all". */
export function assertConfirmed(
    changes: readonly ClassifiedChange[],
    confirmed: readonly string[]
): void {
    const given = new Set(confirmed);
    const missing = changes
        .filter(
            (change) => change.safety === 'destructive' && !given.has(change.id)
        )
        .map((change) => change.id);
    if (missing.length) throw new UnconfirmedChangesError(missing);
}
