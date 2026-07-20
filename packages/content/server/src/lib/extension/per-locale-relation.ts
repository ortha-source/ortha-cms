import { CONTENT_FIELD_TYPE, type AnyFieldSpec } from '../types/fields';
import type { AnyContentType } from '../types/content-type';

/**
 * Whether a field is a **per-locale relation** — a *single owning* relation
 * (`!many`, `!inverse`) on an **i18n** owner whose **target type is also i18n**.
 *
 * Such a relation can't be shared across a translation group: a shared FK would
 * point at one specific locale's row, i.e. a cross-locale link. So the platform
 * treats it as `localized` — not synced onto siblings, not copied into a
 * translation draft, and the picker offers only same-locale candidates. Both the
 * schema serializer (which stamps `localized` for the admin) and the i18n
 * sibling-sync consult this, so the rule lives in one place.
 *
 * The target's i18n-ness is read via the resolved thunk `spec.relation.to()` —
 * safe because the registry resolves every relation target at boot.
 */
export function isPerLocaleRelation(
    owner: AnyContentType,
    spec: AnyFieldSpec
): boolean {
    return (
        owner.i18n &&
        spec.type === CONTENT_FIELD_TYPE.Relation &&
        !spec.relation?.many &&
        !spec.relation?.inverse &&
        !!spec.relation?.to().i18n
    );
}
