import type { OpenApiSchema } from './openapi-writer';

/** Component name for one stored rule. */
export const PROTECTION_RULE_SCHEMA = 'ProtectionRule';

/**
 * The schema for `ProtectionRuleView`.
 *
 * Written by hand because the view is an `interface` — and kept next to the
 * type rather than derived from it, because the descriptions are the point:
 * this is the one place a reader of the API reference is told that a
 * switched-off rule behaves as no rule at all, and that an omitted field on a
 * write takes its default rather than its previous value.
 */
export function buildProtectionSchemas(): Record<string, OpenApiSchema> {
    return {
        [PROTECTION_RULE_SCHEMA]: {
            type: 'object',
            required: [
                'id',
                'kind',
                'slug',
                'enabled',
                'requiredApprovals',
                'requireOtherPerson',
                'countStaleApprovals',
                'adminBypass',
                'allowTokenPublish',
                'updatedBy',
                'createdAt',
                'updatedAt'
            ],
            properties: {
                id: { type: 'string', format: 'uuid' },
                kind: {
                    type: 'string',
                    enum: ['collection', 'single'],
                    description: 'Which half of the content model `slug` names.'
                },
                slug: {
                    type: 'string',
                    example: 'article',
                    description: 'The code-defined content type name.'
                },
                enabled: {
                    type: 'boolean',
                    description:
                        'Off behaves exactly as a type with no rule at all, a bearer token included.'
                },
                requiredApprovals: {
                    type: 'integer',
                    minimum: 1,
                    example: 2,
                    description:
                        'Approvals needed on the entry’s current revision.'
                },
                requireOtherPerson: {
                    type: 'boolean',
                    description:
                        'The four-eyes switch: the author of the current revision cannot approve it, administrators included.'
                },
                countStaleApprovals: {
                    type: 'boolean',
                    description:
                        'Count approvals given on earlier revisions. Not recommended.'
                },
                adminBypass: {
                    type: 'boolean',
                    description:
                        'Whether an administrator may publish past the rule with a mandatory reason.'
                },
                allowTokenPublish: {
                    type: 'boolean',
                    description:
                        'Whether a bearer token may publish this type at all.'
                },
                updatedBy: {
                    type: 'string',
                    format: 'uuid',
                    nullable: true,
                    description:
                        'Who last changed the rule, or null once that user is gone.'
                },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' }
            }
        }
    };
}
