import {
    addErrorResponse,
    setSuccessResponse,
    setSuccessResponseVariants,
    type Operation
} from './openapi-writer';

/** The media types a written response offers, in insertion order. */
function mediaTypes(operation: Operation, code: string): string[] {
    return Object.keys(
        (operation.responses?.[code]?.content ?? {}) as Record<string, unknown>
    );
}

/**
 * The writer's own rules, tested here rather than through either pass.
 *
 * Through a pass they cannot fail: a `204` route is either absent from the
 * route table or listed with no payload, so the guard below is never reached
 * and deleting it changes nothing a pass-level assertion can see. Verified by
 * mutation — dropping `key === '204'` left the suite green. These are the cases
 * that bite.
 */
describe('setSuccessResponse', () => {
    it('writes onto whichever 2xx key the scanner emitted', () => {
        const operation = { responses: { '201': { description: '' } } };
        setSuccessResponse(operation, { type: 'object' }, 'Created.');

        expect(Object.keys(operation.responses)).toEqual(['201']);
        expect(operation.responses['201']).toEqual({
            description: 'Created.',
            content: { 'application/json': { schema: { type: 'object' } } }
        });
    });

    it('gives a 204 no body — it sends none', () => {
        const operation = { responses: { '204': { description: 'Deleted.' } } };
        setSuccessResponse(operation, { type: 'object' }, 'Ignored.');

        expect(operation.responses['204']).toEqual({ description: 'Deleted.' });
    });

    it('invents no key when the scanner emitted no 2xx at all', () => {
        const operation = { responses: { '404': { description: '' } } };
        setSuccessResponse(operation, { type: 'object' }, 'Ignored.');

        expect(Object.keys(operation.responses)).toEqual(['404']);
    });

    it('carries a non-JSON media type when told to', () => {
        const operation: Operation = {
            responses: { '200': { description: '' } }
        };
        setSuccessResponse(
            operation,
            { type: 'string' },
            'A file.',
            'text/csv'
        );

        expect(mediaTypes(operation, '200')).toEqual(['text/csv']);
    });
});

describe('setSuccessResponseVariants', () => {
    it('offers every media type the route can answer with', () => {
        const operation: Operation = {
            responses: { '200': { description: '' } }
        };
        setSuccessResponseVariants(
            operation,
            {
                'application/zip': { type: 'string', format: 'binary' },
                'text/csv': { type: 'string' }
            },
            'A download.'
        );

        expect(mediaTypes(operation, '200')).toEqual([
            'application/zip',
            'text/csv'
        ]);
    });

    it('leaves a 204 alone here too', () => {
        const operation = { responses: { '204': { description: 'Gone.' } } };
        setSuccessResponseVariants(
            operation,
            { 'text/csv': { type: 'string' } },
            'Ignored.'
        );

        expect(operation.responses['204']).toEqual({ description: 'Gone.' });
    });
});

describe('addErrorResponse', () => {
    it('leaves an existing description alone', () => {
        const operation = {
            responses: { '422': { description: 'Already said.' } }
        };
        addErrorResponse(operation, '422', 'Overwritten?');

        expect(operation.responses['422'].description).toBe('Already said.');
    });
});
