import type { OpenApiSchema } from './openapi-writer';

/** Component name for one stored rule. */
export const PROTECTION_RULE_SCHEMA = 'ProtectionRule';

/** Component name for one entry's whole review state. */
export const ENTRY_REVIEW_SCHEMA = 'EntryReview';

/** Component name for the records column's batched status map. */
export const REVIEW_STATUS_MAP_SCHEMA = 'EntryReviewStatusMap';

/** Component name for the Insights card's figures. */
export const PROTECTION_INSIGHTS_SCHEMA = 'ProtectionInsights';

/** Component name for a page of the reviewer queue. */
export const REVIEW_QUEUE_SCHEMA = 'ReviewQueue';

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
        },

        [ENTRY_REVIEW_SCHEMA]: {
            type: 'object',
            required: [
                'protected',
                'required',
                'given',
                'stale',
                'changesRequested',
                'blocked',
                'bypassable',
                'headRevisionId',
                'headRevisionNumber',
                'callerWroteHead',
                'approvals',
                'request'
            ],
            properties: {
                protected: {
                    type: 'boolean',
                    description:
                        'Whether a rule is in force for this content type.'
                },
                required: {
                    type: 'integer',
                    description:
                        'Approvals the rule wants. 0 when the type is unprotected.'
                },
                given: {
                    type: 'integer',
                    description:
                        'Distinct people whose approval counts right now — on the current revision, unless the rule counts stale ones, and never the author of that revision when the four-eyes switch is on.'
                },
                stale: {
                    type: 'integer',
                    description:
                        'Distinct people whose only approval sits on an earlier revision. This is why the count moved after a save; the votes themselves are still listed, struck through.'
                },
                changesRequested: {
                    type: 'integer',
                    description:
                        'How many people asked for changes on the current revision. Never lowers `given`: requesting changes is zero votes plus an explanation, not a veto.'
                },
                blocked: {
                    type: 'boolean',
                    description:
                        'Whether publication is currently held. Always false on an unprotected type.'
                },
                bypassable: {
                    type: 'boolean',
                    description:
                        'Whether the caller could publish past the rule. Reported, never applied — taking a bypass costs a mandatory reason, which only the publish route can demand.'
                },
                headRevisionId: {
                    type: 'string',
                    format: 'uuid',
                    description:
                        'The entry’s current version — what an approval would be bound to.'
                },
                headRevisionNumber: { type: 'integer', example: 7 },
                callerWroteHead: {
                    type: 'boolean',
                    description:
                        'Whether the caller wrote the current version, and so cannot approve it while the four-eyes switch is on.'
                },
                approvals: {
                    type: 'array',
                    description:
                        'Every vote on the entry, stale ones included — a counter that silently rolls back after a save is unexplainable without them.',
                    items: {
                        type: 'object',
                        required: [
                            'userId',
                            'decision',
                            'note',
                            'revisionId',
                            'revisionNumber',
                            'isStale',
                            'createdAt'
                        ],
                        properties: {
                            userId: { type: 'string', format: 'uuid' },
                            decision: {
                                type: 'string',
                                enum: ['approved', 'changes_requested']
                            },
                            note: { type: 'string', nullable: true },
                            revisionId: { type: 'string', format: 'uuid' },
                            revisionNumber: {
                                type: 'integer',
                                nullable: true,
                                description:
                                    'The version the vote was given on, or null when that revision is no longer in the entry’s recent timeline.'
                            },
                            isStale: {
                                type: 'boolean',
                                description:
                                    'The vote is off the current version, and is struck through in the editor.'
                            },
                            createdAt: {
                                type: 'string',
                                format: 'date-time'
                            }
                        }
                    }
                },
                request: {
                    type: 'object',
                    nullable: true,
                    description:
                        'The open ask, or null. It survives later saves — what a save invalidates is an approval, not the request.',
                    required: [
                        'id',
                        'requestedBy',
                        'note',
                        'revisionId',
                        'createdAt'
                    ],
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        requestedBy: { type: 'string', format: 'uuid' },
                        note: { type: 'string', nullable: true },
                        revisionId: {
                            type: 'string',
                            format: 'uuid',
                            description:
                                'The head at the moment of asking. Kept for the trail only.'
                        },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                }
            }
        },

        [REVIEW_STATUS_MAP_SCHEMA]: {
            type: 'object',
            required: ['byEntry'],
            properties: {
                byEntry: {
                    type: 'object',
                    description:
                        'Keyed by entry id. An id with no revision in this workspace under this content type is **absent** rather than reported as unprotected — the two are different facts, and telling them apart would let a caller probe another workspace’s ids.',
                    additionalProperties: {
                        type: 'object',
                        required: [
                            'protected',
                            'required',
                            'given',
                            'stale',
                            'changesRequested',
                            'requested',
                            'blocked'
                        ],
                        properties: {
                            protected: {
                                type: 'boolean',
                                description:
                                    'Whether a rule applies to this entry’s type at all.'
                            },
                            required: {
                                type: 'integer',
                                description:
                                    'Approvals the rule asks for; 0 when unprotected.'
                            },
                            given: {
                                type: 'integer',
                                description:
                                    'Approvals counting toward the head revision, from the same kernel function the publish gate obeys.'
                            },
                            stale: {
                                type: 'integer',
                                description:
                                    'People whose only approval sits on an earlier revision.'
                            },
                            changesRequested: {
                                type: 'boolean',
                                description:
                                    'Whether somebody asked for changes on the current version. It never lowers `given`.'
                            },
                            requested: {
                                type: 'boolean',
                                description:
                                    'Whether a review has been asked for and not yet resolved.'
                            },
                            blocked: {
                                type: 'boolean',
                                description:
                                    'Whether publishing is currently held by the rule.'
                            }
                        }
                    }
                }
            }
        },
        [PROTECTION_INSIGHTS_SCHEMA]: {
            type: 'object',
            required: ['open', 'overdue', 'overdueAfterDays'],
            properties: {
                open: {
                    type: 'integer',
                    description:
                        'Open review requests across every protected type in the workspace.'
                },
                overdue: {
                    type: 'integer',
                    description:
                        'How many of those have waited longer than `overdueAfterDays`.'
                },
                overdueAfterDays: {
                    type: 'integer',
                    description:
                        'The threshold `overdue` was counted against, reported so a caller cannot restate it and drift.'
                }
            }
        },
        [REVIEW_QUEUE_SCHEMA]: {
            type: 'object',
            required: ['items', 'total'],
            properties: {
                total: { type: 'integer' },
                items: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: [
                            'id',
                            'contentType',
                            'entryId',
                            'requestedBy',
                            'note',
                            'required',
                            'given',
                            'createdAt'
                        ],
                        properties: {
                            id: { type: 'string', format: 'uuid' },
                            contentType: {
                                type: 'string',
                                example: 'article'
                            },
                            entryId: { type: 'string', format: 'uuid' },
                            requestedBy: { type: 'string', format: 'uuid' },
                            note: { type: 'string', nullable: true },
                            required: {
                                type: 'integer',
                                description:
                                    'Approvals the type’s rule wants; 0 when unprotected.'
                            },
                            given: {
                                type: 'integer',
                                description:
                                    'Distinct approvals on the entry’s current revision. A hint for the list — the entry route runs the decision the publish button obeys, including the four-eyes exclusion this count omits.'
                            },
                            createdAt: {
                                type: 'string',
                                format: 'date-time',
                                description:
                                    'When the review was asked for — the age the page sorts and colours by.'
                            }
                        }
                    }
                }
            }
        }
    };
}
