import {
    checkDocumentShape,
    type SchemaDocument
} from '@orthacms/schema-builder-domain';
import { InvalidDocumentError } from '../../domain/errors';

/** The body is a schema document — before anything diffs, checks or renders it. */
export function assertShape(value: unknown): asserts value is SchemaDocument {
    const problems = checkDocumentShape(value);
    if (problems.length) throw new InvalidDocumentError(problems);
}
