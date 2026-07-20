import type { EntryFieldSpec } from '@ortha-cms/content-domain';
import type { ContentField } from '../../domain/types/contentType';

/**
 * The one thin adapter mapping the admin's wire {@link ContentField} to the
 * kernel's serialized {@link EntryFieldSpec}. The two are all-but-identical — the
 * only gap is `ContentField.validation`, typed as the opaque wire
 * `Record<string, unknown>`, which we narrow to the kernel's rule shape here so
 * the field feeds `@ortha-cms/content-domain`'s validator without a cast at every
 * call site. Runtime values are unchanged; this is a pure structural bridge so the
 * kernel stays the single source of the validation rules.
 */
export function toFieldSpec(field: ContentField): EntryFieldSpec {
    return {
        type: field.type,
        required: field.required,
        validation: field.validation as EntryFieldSpec['validation'],
        options: field.options,
        relation: field.relation
    };
}
