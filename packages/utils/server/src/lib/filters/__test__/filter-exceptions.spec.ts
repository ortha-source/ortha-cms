import {
    FilterErrorCode,
    FilterException,
    FilterSchemaException
} from '../filter-exceptions';

describe('FilterException', () => {
    it('carries the code, the prefixed message and a 400', () => {
        const e = new FilterException(
            FilterErrorCode.UnknownField,
            'unknown field "secretField"',
            { path: 'secretField' }
        );
        expect(e.getStatus()).toBe(400);
        expect(e.code).toBe('FILTER_UNKNOWN_FIELD');
        expect(e.getResponse()).toEqual({
            statusCode: 400,
            error: 'Bad Request',
            code: 'FILTER_UNKNOWN_FIELD',
            message: 'filter: unknown field "secretField"',
            path: 'secretField'
        });
    });

    it('flattens context onto the body so clients read `maxNodes` directly', () => {
        const e = new FilterException(
            FilterErrorCode.MaxNodesExceeded,
            'filter exceeds max node count 50',
            { maxNodes: 50 }
        );
        expect(e.getResponse()).toMatchObject({ maxNodes: 50 });
        expect(e.context).toEqual({ maxNodes: 50 });
    });

    it('does not let context overwrite the four reserved keys [utils:I-32]', () => {
        // The class exists so a client can branch on `code` instead of
        // string-matching the message. `...context` used to be spread LAST, so
        // a context key named `code` / `statusCode` / `error` / `message`
        // silently rewrote the field the class guarantees — a 400 whose body
        // claimed 200, with the wrong machine-readable code. Today the only
        // context key that comes close is `InvalidJson`'s `reason`, but the
        // trap is one rename away for whoever adds the next one.
        const e = new FilterException(FilterErrorCode.UnknownField, 'x', {
            statusCode: 200,
            error: 'OK',
            code: 'nope',
            message: 'pwned'
        });
        expect(e.getStatus()).toBe(400);
        expect(e.getResponse()).toEqual({
            statusCode: 400,
            error: 'Bad Request',
            code: 'FILTER_UNKNOWN_FIELD',
            message: 'filter: x'
        });
    });
});

describe('FilterSchemaException', () => {
    it('is a typed 500 — the client did nothing wrong', () => {
        const e = new FilterSchemaException('column "ghost" not on table');
        expect(e.getStatus()).toBe(500);
        expect(e.code).toBe('FILTER_SCHEMA_INVALID');
        expect(e.getResponse()).toEqual({
            statusCode: 500,
            error: 'Internal Server Error',
            code: 'FILTER_SCHEMA_INVALID',
            message: 'filter schema: column "ghost" not on table'
        });
    });

    it('is not a FilterException, so a 400 handler cannot swallow it', () => {
        expect(new FilterSchemaException('x')).not.toBeInstanceOf(
            FilterException
        );
    });
});
