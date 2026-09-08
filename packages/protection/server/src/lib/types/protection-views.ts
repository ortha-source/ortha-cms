import type { ProtectionRule } from '@orthacms/protection-domain';

/**
 * One rule as the settings tab reads it.
 *
 * It is the domain's {@link ProtectionRule} — the six fields the decision is
 * made from — plus the addressing and the audit trail the screen shows around
 * it. Spelling the six out again here would be a second definition to keep in
 * step with the kernel, and the kernel is the one the publish gate consults.
 */
export interface ProtectionRuleView extends ProtectionRule {
    /** Row id. Stable across edits; the address is `(kind, slug)`. */
    id: string;
    /** `collection` or `single`. */
    kind: string;
    /** The code-defined content type name. */
    slug: string;
    /** Who last changed the rule, or `null` when that user is gone. */
    updatedBy: string | null;
    /** ISO-8601. */
    createdAt: string;
    /** ISO-8601. */
    updatedAt: string;
}
