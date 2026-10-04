import type { FieldDoc } from '../document/field-doc';

/** Key order inside a builder call — fixed, so a regenerated file diffs quietly. */
const KEY_ORDER = [
    'required',
    'localized',
    'lang',
    'options',
    'minLength',
    'maxLength',
    'pattern',
    'structure',
    'min',
    'max',
    'integer',
    'multiple',
    'accept',
    'many',
    'unique',
    'onDelete',
    'syncAcrossLocales',
    'admin'
] as const;

type Source = Readonly<Record<string, unknown>>;

/** The defaults the DSL fills in by itself — written out, they would only add noise. */
function isDefault(key: string, value: unknown, spec: Source): boolean {
    if (value === undefined) return true;
    switch (key) {
        case 'required':
        case 'localized':
        case 'integer':
        case 'multiple':
        case 'many':
        case 'unique':
            return value === false;
        case 'onDelete':
            return value === (spec['required'] ? 'cascade' : 'set null');
        case 'syncAcrossLocales':
            return value === !spec['localized'];
        case 'admin':
            return Object.keys(value as object).length === 0;
        default:
            return false;
    }
}

/** The options object a builder call receives, defaults left out. */
export function fieldOptions(spec: FieldDoc): Record<string, unknown> {
    const source = spec as unknown as Source;
    return Object.fromEntries(
        KEY_ORDER.filter((key) => !isDefault(key, source[key], source)).map(
            (key) => [key, source[key]]
        )
    );
}
