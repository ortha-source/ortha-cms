import { WIRE_OP, type JsonFilterNode } from '@ortha-cms/query-builder-admin';
import type { EntryRecord } from '../../types/contentType';

/** Pull the value a filter rule targets off a record (`status` is the envelope). */
function fieldValue(record: EntryRecord, field: string): unknown {
    if (field === 'status') return record.status;
    if (field === 'createdAt') return record.createdAt;
    if (field === 'updatedAt') return record.updatedAt;
    return record.values[field];
}

/** Convert a SQL ILIKE pattern (`%foo\_bar%`) to a case-insensitive RegExp. */
function likeToRegExp(pattern: string): RegExp {
    let out = '';
    for (let i = 0; i < pattern.length; i++) {
        const ch = pattern[i];
        if (ch === '\\' && i + 1 < pattern.length) {
            out += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        } else if (ch === '%') {
            out += '.*';
        } else if (ch === '_') {
            out += '.';
        } else {
            out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
    }
    return new RegExp(`^${out}$`, 'i');
}

/** Compare two scalars numerically when both parse as numbers, else as strings. */
function compare(a: unknown, b: unknown): number {
    const an = Number(a);
    const bn = Number(b);
    if (!Number.isNaN(an) && !Number.isNaN(bn) && a !== '' && b !== '') {
        return an - bn;
    }
    return String(a).localeCompare(String(b));
}

/** Evaluate one leaf rule against a record. */
function matchesRule(
    record: EntryRecord,
    rule: { field: string; op: string; value: unknown }
): boolean {
    const value = fieldValue(record, rule.field);
    switch (rule.op) {
        case WIRE_OP.Eq:
            return String(value) === String(rule.value);
        case WIRE_OP.Ne:
            return String(value) !== String(rule.value);
        case WIRE_OP.Ilike:
            return (
                value != null &&
                likeToRegExp(String(rule.value)).test(String(value))
            );
        case WIRE_OP.In:
            return (
                Array.isArray(rule.value) &&
                rule.value.some((v) => String(v) === String(value))
            );
        case WIRE_OP.Null: {
            const empty = value == null || value === '';
            return rule.value === true ? empty : !empty;
        }
        case WIRE_OP.Gt:
            return value != null && compare(value, rule.value) > 0;
        case WIRE_OP.Gte:
            return value != null && compare(value, rule.value) >= 0;
        case WIRE_OP.Lt:
            return value != null && compare(value, rule.value) < 0;
        case WIRE_OP.Lte:
            return value != null && compare(value, rule.value) <= 0;
        default:
            return true;
    }
}

/** Evaluate a wire node (group or leaf) against a record. */
function matchesNode(record: EntryRecord, node: JsonFilterNode): boolean {
    if ('and' in node) return node.and.every((c) => matchesNode(record, c));
    if ('or' in node) return node.or.some((c) => matchesNode(record, c));
    return matchesRule(record, node);
}

/**
 * Filter mock entries by the query-builder's **wire JSON** filter (the same
 * `?filter=` payload the server's `parseFilterTree` consumes), so the filter
 * drawer is genuinely functional against mock data. Supports `and`/`or` groups
 * and the leaf ops the UI emits (`eq`/`ne`/`ilike`/`in`/`null`/`gt`/`gte`/`lt`/
 * `lte`). A `null`/empty filter passes everything through. When the real entry
 * API lands, the server filters instead and this util goes away with the mock.
 */
export function applyFilterTree(
    rows: EntryRecord[],
    filter: string
): EntryRecord[] {
    if (!filter) return rows;
    let node: JsonFilterNode;
    try {
        node = JSON.parse(filter) as JsonFilterNode;
    } catch {
        return rows;
    }
    return rows.filter((row) => matchesNode(row, node));
}
