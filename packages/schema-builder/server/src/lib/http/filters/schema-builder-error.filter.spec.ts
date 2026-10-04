import type { ArgumentsHost } from '@nestjs/common';
import {
    EditingDisabledError,
    InvalidDocumentError,
    MigrationAmbiguityError,
    MigrationGenerateError,
    NotBuilderOwnedError,
    SchemaInvalidError,
    StaleDocumentError
} from '../../domain/errors';
import { SchemaBuilderErrorFilter } from './schema-builder-error.filter';

function answer(error: Parameters<SchemaBuilderErrorFilter['catch']>[0]) {
    const sent: { status?: number; body?: unknown } = {};
    const response = {
        status(code: number) {
            sent.status = code;
            return this;
        },
        json(body: unknown) {
            sent.body = body;
        }
    };
    const host = {
        switchToHttp: () => ({ getResponse: () => response })
    } as unknown as ArgumentsHost;
    new SchemaBuilderErrorFilter().catch(error, host);
    return sent;
}

describe('SchemaBuilderErrorFilter', () => {
    it.each([
        [new EditingDisabledError('production'), 403],
        [new InvalidDocumentError(['x']), 400],
        [new StaleDocumentError('abc'), 409],
        [new SchemaInvalidError([]), 422],
        [new NotBuilderOwnedError(['article']), 422],
        [new MigrationAmbiguityError('…'), 422],
        [new MigrationGenerateError('…'), 500]
    ])('answers %p with %i', (error, status) => {
        expect(answer(error).status).toBe(status);
    });

    it('carries the code, the sentence and the details', () => {
        expect(answer(new StaleDocumentError('abc')).body).toEqual({
            statusCode: 409,
            code: 'schema-builder.stale',
            message: expect.stringContaining('changed since you opened it'),
            details: { currentFingerprint: 'abc' }
        });
    });
});
