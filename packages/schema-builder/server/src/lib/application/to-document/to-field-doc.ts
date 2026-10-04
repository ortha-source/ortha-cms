import type { AnyFieldSpec } from '@orthacms/content-server';
import type {
    FieldAdminDoc,
    FieldDoc,
    MediaAcceptDoc
} from '@orthacms/schema-builder-domain';
import { toRelationDoc } from './to-relation-doc';

/** Validation keys each type carries in the document — what its builder accepts. */
const RULE_KEYS: Readonly<Record<string, readonly string[]>> = {
    text: ['minLength', 'maxLength', 'pattern'],
    richtext: ['minLength', 'maxLength', 'structure'],
    number: ['min', 'max', 'integer'],
    // `integer` is the DSL's own (money is minor units), not an author's choice.
    money: ['min', 'max']
};

/** A media field's `accept`, as mutable JSON. */
function toAcceptDoc(
    accept: NonNullable<AnyFieldSpec['accept']>
): MediaAcceptDoc {
    return {
        ...(accept.kinds ? { kinds: [...accept.kinds] } : {}),
        ...(accept.mimeTypes ? { mimeTypes: [...accept.mimeTypes] } : {})
    };
}

/**
 * A registered field spec → the document's `FieldDoc`. Read from the **raw**
 * spec rather than the serialized one: the serializer reports a computed
 * `localeSync` where the declaration says `syncAcrossLocales`, and the
 * document must regenerate the declaration.
 */
export function toFieldDoc(spec: AnyFieldSpec): FieldDoc {
    const validation = spec.validation as Record<string, unknown>;
    const rules = Object.fromEntries(
        (RULE_KEYS[spec.type] ?? [])
            .filter((key) => validation[key] !== undefined)
            .map((key) => [key, validation[key]])
    );
    const admin = spec.admin as FieldAdminDoc;
    return {
        type: spec.type,
        ...(spec.required ? { required: true } : {}),
        ...(spec.localized ? { localized: true } : {}),
        ...(spec.lang !== undefined ? { lang: spec.lang } : {}),
        ...rules,
        ...(spec.options ? { options: [...spec.options] } : {}),
        ...(spec.type === 'media' && spec.multiple ? { multiple: true } : {}),
        ...(spec.accept ? { accept: toAcceptDoc(spec.accept) } : {}),
        ...(spec.relation ? toRelationDoc(spec, spec.relation) : {}),
        ...(Object.keys(admin).length ? { admin: structuredClone(admin) } : {})
    } as FieldDoc;
}
