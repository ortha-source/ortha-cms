import { canonicalJson } from '../diff/canonical';
import type { SchemaDocument } from '../document/schema-document';
import { fnv1a } from './fnv1a';

const hex = (n: number) => n.toString(16).padStart(8, '0');

/**
 * A short, stable hash of a document — the optimistic-concurrency token a plan
 * or an apply carries. Two FNV-1a passes with different bases: no crypto
 * dependency, identical in the browser and on the server, and collisions far
 * too unlikely to matter for "did the schema change under you".
 */
export function fingerprint(document: SchemaDocument): string {
    const text = canonicalJson(document);
    return hex(fnv1a(text, 0x811c9dc5)) + hex(fnv1a(text, 0x01000193));
}
