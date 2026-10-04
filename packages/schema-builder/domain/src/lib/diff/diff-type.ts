import type { TypeDoc } from '../document/type-doc';
import { diffFieldOrder } from './diff-field-order';
import { diffFields } from './diff-fields';
import { diffTypeFlags } from './diff-type-flags';
import { diffTypeMeta } from './diff-type-meta';
import type { SchemaChange } from './schema-change';

/** Every part of a type that can change, in the order the review lists them. */
const PARTS = [
    diffTypeMeta,
    diffTypeFlags,
    diffFields,
    diffFieldOrder
] as const;

export const diffType = (a: TypeDoc, b: TypeDoc): SchemaChange[] =>
    PARTS.flatMap((part) => part(a, b));
