import {
    isBlocked,
    type ClassifiedChange
} from '@orthacms/schema-builder-domain';
import { SchemaBlockedError } from '../../domain/errors';

/** Apply refuses what plan only reports: a change this version does not apply. */
export function assertNotBlocked(changes: readonly ClassifiedChange[]): void {
    if (isBlocked(changes))
        throw new SchemaBlockedError(
            changes.filter((change) => change.safety === 'blocked')
        );
}
