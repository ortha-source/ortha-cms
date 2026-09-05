import {
    addErrorResponse,
    setSuccessResponse,
    type Operation
} from './openapi-writer';

/** What a written response carries, past the literal type of the fixture. */
function written(
    operation: Operation,
    code: string
): { content?: Record<string, unknown>; headers?: Record<string, unknown> } {
    return (operation.responses?.[code] ?? {}) as {
        content?: Record<string, unknown>;
        headers?: Record<string, unknown>;
    };
}

/**
 * The writer's own rules.
 *
 * This plugin serves no `204` at all, so the guard below is unreachable through
 * the pass and a mutation deleting it would leave every pass-level assertion
 * green. It is here because the writer is the thing being claimed correct, not
 * the five routes that happen to use it today.
 */
describe('setSuccessResponse', () => {
    it('writes onto whichever 2xx key the scanner emitted', () => {
        const operation = { responses: { '200': { description: '' } } };
        setSuccessResponse(
            operation,
            { 'application/json': { type: 'object' } },
            'OK.'
        );

        expect(Object.keys(operation.responses)).toEqual(['200']);
    });

    it('offers every media type a download can answer with', () => {
        const operation: Operation = {
            responses: { '200': { description: '' } }
        };
        setSuccessResponse(
            operation,
            {
                'application/zip': { type: 'string', format: 'binary' },
                'text/csv': { type: 'string', format: 'binary' }
            },
            'A file.',
            { 'X-Transfer-Records': { schema: { type: 'integer' } } }
        );

        const response = written(operation, '200');
        expect(Object.keys(response.content ?? {})).toEqual([
            'application/zip',
            'text/csv'
        ]);
        expect(Object.keys(response.headers ?? {})).toEqual([
            'X-Transfer-Records'
        ]);
    });

    it('gives a 204 no body — it sends none', () => {
        const operation = { responses: { '204': { description: 'Gone.' } } };
        setSuccessResponse(
            operation,
            { 'application/json': { type: 'object' } },
            'Ignored.'
        );

        expect(operation.responses['204']).toEqual({ description: 'Gone.' });
    });

    it('invents no key when the scanner emitted no 2xx at all', () => {
        const operation = { responses: { '404': { description: '' } } };
        setSuccessResponse(
            operation,
            { 'application/json': { type: 'object' } },
            'Ignored.'
        );

        expect(Object.keys(operation.responses)).toEqual(['404']);
    });
});

describe('addErrorResponse', () => {
    it('leaves an existing description alone', () => {
        const operation = {
            responses: { '404': { description: 'Already said.' } }
        };
        addErrorResponse(operation, '404', 'Overwritten?');

        expect(operation.responses['404'].description).toBe('Already said.');
    });
});
