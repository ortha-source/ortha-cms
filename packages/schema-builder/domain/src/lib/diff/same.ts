import { canonicalJson } from './canonical';

/** Structural equality over JSON data — key order and `undefined` keys do not count. */
export const same = (a: unknown, b: unknown): boolean =>
    canonicalJson(a) === canonicalJson(b);
