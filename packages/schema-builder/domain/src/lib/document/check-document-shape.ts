import { CONTENT_FIELD_TYPE } from '@orthacms/content-domain';

const FIELD_TYPES = new Set<string>(Object.values(CONTENT_FIELD_TYPE));
const KINDS = new Set(['collection', 'single']);
const ORIGINS = new Set(['builder', 'code', 'new']);

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string =>
    typeof value === 'string' && value.length > 0;

/** One field entry's structural problems. */
function fieldProblems(entry: unknown, at: string): string[] {
    if (!isObject(entry)) return [`${at} is not an object`];
    const problems: string[] = [];
    if (!isString(entry['key'])) problems.push(`${at}.key is missing`);
    if (!isString(entry['name'])) problems.push(`${at}.name is missing`);
    const spec = entry['spec'];
    if (!isObject(spec) || !FIELD_TYPES.has(spec['type'] as string)) {
        return [...problems, `${at}.spec.type is not a field type`];
    }
    if (
        (spec['type'] === 'select' || spec['type'] === 'multiselect') &&
        !Array.isArray(spec['options'])
    ) {
        problems.push(`${at}.spec.options is not a list`);
    }
    if (spec['type'] === 'relation' && !isString(spec['to']))
        problems.push(`${at}.spec.to is missing`);
    if (spec['admin'] !== undefined && !isObject(spec['admin']))
        problems.push(`${at}.spec.admin is not an object`);
    return problems;
}

/** One type's structural problems, its fields' included. */
function typeProblems(type: unknown, at: string): string[] {
    if (!isObject(type)) return [`${at} is not an object`];
    const problems: string[] = [];
    if (!isString(type['name'])) problems.push(`${at}.name is missing`);
    if (!KINDS.has(type['kind'] as string))
        problems.push(`${at}.kind is not collection or single`);
    if (!ORIGINS.has(type['origin'] as string))
        problems.push(`${at}.origin is not builder, code or new`);
    for (const flag of ['publishable', 'paranoid', 'i18n']) {
        if (typeof type[flag] !== 'boolean')
            problems.push(`${at}.${flag} is not a boolean`);
    }
    const groups = type['groups'];
    if (
        !Array.isArray(groups) ||
        groups.some(
            (group) =>
                !isObject(group) ||
                !isString(group['key']) ||
                typeof group['label'] !== 'string'
        )
    ) {
        problems.push(`${at}.groups is not a list of { key, label }`);
    }
    const fields = type['fields'];
    if (!Array.isArray(fields))
        return [...problems, `${at}.fields is not a list`];
    const keys = fields.map((entry) =>
        isObject(entry) ? entry['key'] : undefined
    );
    if (new Set(keys).size !== keys.length)
        problems.push(`${at}.fields repeats a key`);
    return [
        ...problems,
        ...fields.flatMap((entry, index) =>
            fieldProblems(entry, `${at}.fields[${index}]`)
        )
    ];
}

/**
 * Whether an untrusted value is shaped like a `SchemaDocument` — before the
 * diff, the rules or the code generator see it. Structure only: the meaning
 * (names, relation targets, option values) is the schema rules' job.
 */
export function checkDocumentShape(value: unknown): string[] {
    if (!isObject(value)) return ['document is not an object'];
    const problems: string[] = [];
    if (value['version'] !== 1) problems.push('document.version is not 1');
    const types = value['types'];
    if (!Array.isArray(types))
        return [...problems, 'document.types is not a list'];
    return [
        ...problems,
        ...types.flatMap((type, index) => typeProblems(type, `types[${index}]`))
    ];
}
