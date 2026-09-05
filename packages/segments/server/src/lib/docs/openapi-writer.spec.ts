import { addErrorResponse, setSuccessResponse } from './openapi-writer';

/**
 * The writer's own rules, tested here rather than through the pass.
 *
 * Through the pass they cannot fail: a `204` route is simply absent from the
 * route table, so the guard below is never reached and deleting it changes
 * nothing any pass-level assertion can see. Verified by mutation — dropping
 * `key === '204'` from the writer left the whole suite green. These are the
 * cases that bite.
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
});

describe('addErrorResponse', () => {
    it('leaves an existing description alone', () => {
        const operation = {
            responses: { '400': { description: 'Already said.' } }
        };
        addErrorResponse(operation, '400', 'Overwritten?');

        expect(operation.responses['400'].description).toBe('Already said.');
    });
});
