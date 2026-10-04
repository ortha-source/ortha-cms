import type { SchemaDocumentEnvelope } from '@orthacms/schema-builder-domain';
import { StaleDocumentError } from '../../domain/errors';

/** [schema-builder:I-06] The draft was made against the content model this process serves. */
export function assertFresh(
    current: SchemaDocumentEnvelope,
    baseFingerprint: string
): void {
    if (current.fingerprint !== baseFingerprint)
        throw new StaleDocumentError(current.fingerprint);
}
