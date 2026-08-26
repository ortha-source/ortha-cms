import { Param, type SQL } from 'drizzle-orm';
import { uuidArray } from './uuid-array';

/** The chunks the fragment is built from, whatever their kind. */
function chunksOf(fragment: SQL): unknown[] {
    return (fragment as unknown as { queryChunks: unknown[] }).queryChunks;
}

/** Every bind parameter the fragment declares, in order. */
function paramsOf(fragment: SQL): unknown[] {
    return chunksOf(fragment)
        .filter((chunk): chunk is Param => chunk instanceof Param)
        .map((param) => param.value);
}

/**
 * The one thing about this helper worth pinning, and the one an assertion about
 * the *emitted SQL* cannot see: how many placeholders it declares.
 *
 * `` sql`${ids}::uuid[]` `` produces the same-looking fragment and a different
 * number of parameters per call — none, one, or one per id — which is a syntax
 * error, a `malformed array literal`, and a row constructor respectively. Every
 * one of those is a 500 on a public read, and the shape assertions in
 * `segment-read-scope.spec.ts` pass through all three.
 */
describe('uuidArray', () => {
    it('binds the whole list as a single parameter', () => {
        const ids = [
            '11111111-1111-4111-8111-111111111111',
            '22222222-2222-4222-8222-222222222222'
        ];
        expect(paramsOf(uuidArray(ids))).toEqual([ids]);
    });

    it('binds an empty list as one empty-array parameter, not as nothing', () => {
        // The anonymous reader. Expanded inline this is `()::uuid[]` — a syntax
        // error on every unauthenticated request the moment a segment exists.
        expect(paramsOf(uuidArray([]))).toEqual([[]]);
    });

    it('binds a single id as a one-element array, not as a scalar', () => {
        // A scalar here reaches Postgres as `malformed array literal: "<uuid>"`,
        // which is what a reader in exactly one segment used to get.
        const id = '11111111-1111-4111-8111-111111111111';
        expect(paramsOf(uuidArray([id]))).toEqual([[id]]);
    });

    it('copies the list, so a caller’s Set-derived array cannot mutate under it', () => {
        const ids = ['11111111-1111-4111-8111-111111111111'];
        const fragment = uuidArray(ids);
        ids.push('22222222-2222-4222-8222-222222222222');
        expect(paramsOf(fragment)).toEqual([
            ['11111111-1111-4111-8111-111111111111']
        ]);
    });
});
