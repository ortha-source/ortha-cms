import { Injectable, Optional, type OnModuleInit } from '@nestjs/common';
import { PERMISSIONS } from '@ortha-cms/identity-server';
import type { ProposalChange, ProposalDraft } from '@ortha-cms/copilot-domain';
import { ToolRegistry } from '@ortha-cms/tools-server';
import type { ToolDefinition, ToolProvider } from '@ortha-cms/tools-server';
import { InjectContentRegistry } from '../content.tokens';
import type {
    ContentTypeRegistry,
    SerializedField
} from '../registry/content-type-registry';
import { EntryWriterService } from '../entries/infrastructure/persistence/entry-writer.service';
import { WorkspaceGrantsQuery } from '../content-types/queries/workspace-grants.query';
import { BULK_MAX_SAVE_ITEMS } from '../entries/entries.constants';
import { CONTENT_PROPOSAL_KINDS } from './proposal-kinds';

/**
 * The content plugin's **write** tools — `content_propose_create`,
 * `content_propose_update`, and `content_propose_bulk_save` for the batch.
 *
 * All three are `effect: 'propose'`: they compute a change and hand it back, and the
 * run engine persists it as a `copilot_proposals` row for a human to accept
 * ([ADR-0005](../../../../../../docs/adr/0005-copilot-authority-model.md) §5).
 * **Nothing here writes to the database.** That is the whole point of the split
 * — the tool is a pure function of the model's arguments plus the current
 * entry, so a prompt-injected instruction to "just save it" has nowhere to
 * land, and the actual write happens later through the ordinary use-case with a
 * person as actor.
 *
 * Two things they *do* touch the database for, both reads: resolving the
 * workspace's content grants, and loading the entry an edit would change — the
 * latter so the proposal carries a real before/after diff rather than a patch a
 * reviewer has to mentally apply.
 *
 * **`content:publish` is not exposed at any role** (ADR-0005 §7). The copilot
 * may prepare a publishable draft; a person presses publish. There is
 * deliberately no `status` in any of their schemas — and no bulk publish or
 * bulk delete either, however convenient: batching is a way of *asking*, not a
 * route to authority a single-entry tool was not given.
 */
@Injectable()
export class EntryProposalToolProvider implements ToolProvider, OnModuleInit {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly writer: EntryWriterService,
        private readonly grants: WorkspaceGrantsQuery,
        @Optional() private readonly toolRegistry?: ToolRegistry
    ) {}

    /**
     * Register with the shared tool registry once the DI graph is built —
     * the same catalogue the MCP endpoint serves, narrowed to the `copilot`
     * surface by each tool's `surfaces`. `@Optional()` because a deployment
     * may run neither consumer, in which case these simply go unregistered.
     */
    onModuleInit(): void {
        this.toolRegistry?.register(this);
    }

    /** The three write tools, in the order the model sees them. */
    tools(): readonly ToolDefinition[] {
        return [this.proposeEntry(), this.proposeEdit(), this.proposeBulk()];
    }

    /** Resolves a granted, registered type — the same uniform message as the reads. */
    private async resolveGranted(typeName: string, workspaceId: string) {
        const type = this.registry.get(typeName);
        const granted = await this.grants.grantedSlugs(workspaceId);
        if (!type || !granted.has(type.name)) {
            throw new Error(
                `Unknown content type "${typeName}" in this workspace.`
            );
        }
        return type;
    }

    /**
     * The type's writable fields, keyed by name.
     *
     * **Back-references are excluded and owning many-relations are not.** The
     * exclusion used to cover both, on the stated grounds that join-backed
     * links "never travel in the `values` bag" — which is not true of the
     * owning side: `RelationLinkService.writeLinks` performs a whole-set write
     * for any owning many-relation submitted as an **array**, on create and on
     * update alike, and the appliers already merge the patch straight into the
     * values they hand the writer. So refusing `article.tags` refused something
     * that works, which is how "Unknown or non-writable field(s): tags" came to
     * be the answer to a perfectly ordinary request.
     *
     * An **inverse** relation genuinely cannot be written from this side —
     * `writeLinks` skips it (`ownCol !== 'sourceId'`) — so a value for one
     * really would be silently dropped, and a proposal that does nothing is
     * worse than one refused up front.
     */
    private writableFields(typeName: string): Map<string, SerializedField> {
        const schema = this.registry.serialize(typeName);
        const fields = new Map<string, SerializedField>();
        for (const field of schema?.fields ?? []) {
            const backReference =
                field.type === 'relation' && !!field.relation?.inverse;
            if (!backReference) {
                fields.set(field.name, field);
            }
        }
        return fields;
    }

    /**
     * Whether a field is written as a **whole set** of target ids.
     *
     * These have no `before` in the diff: the current links are not part of the
     * entry's `values` (`toRecord` drops join-backed fields), so the honest card
     * shows what the set is being made into rather than a fabricated `null`
     * before that reads as "it had no tags".
     */
    private isWholeSetRelation(field?: SerializedField): boolean {
        return (
            field?.type === 'relation' &&
            !!field.relation?.many &&
            !field.relation.inverse
        );
    }

    /**
     * Narrows model-supplied values to the type's writable fields, rejecting a
     * name that isn't one.
     *
     * Unlike the read tools' `fields`, an unknown name here is an **error**.
     * There the cost of a mis-remembered name is a missing column in a result
     * the model can see; here it is a change a human approves believing it
     * writes a field that does not exist.
     */
    private narrowValues(
        typeName: string,
        values: Record<string, unknown>
    ): {
        values: Record<string, unknown>;
        fields: Map<string, SerializedField>;
    } {
        const fields = this.writableFields(typeName);
        const unknown = Object.keys(values).filter((key) => !fields.has(key));
        if (unknown.length > 0) {
            throw new Error(
                `Unknown or non-writable field(s) on "${typeName}": ${unknown.join(', ')}. ` +
                    'Call admin_content_types for this type’s fields. Many-relations and ' +
                    'back-references cannot be set this way.'
            );
        }
        return { values, fields };
    }

    /** `content_propose_create` — a new draft entry, for a human to accept. */
    private proposeEntry(): ToolDefinition {
        return {
            name: 'content_propose_create',
            title: 'Propose a new entry',
            description:
                'Propose creating a new entry. This does NOT create anything — it drafts the ' +
                'change and asks the user to approve it, and the reply will say so. Call ' +
                'admin_content_types for the type’s fields first; supply only fields you are ' +
                'confident about, since the user reviews exactly what you send. The entry is ' +
                'always created as a draft: you cannot publish.',
            inputSchema: {
                type: 'object',
                properties: {
                    typeName: {
                        type: 'string',
                        description: 'The content type to create an entry of.'
                    },
                    values: {
                        type: 'object',
                        description:
                            'Field values keyed by field name, as admin_content_types describes ' +
                            'them. A many-relation (e.g. tags) takes an array of target entry ' +
                            'ids — find them with admin_content_search. Back-references cannot ' +
                            'be set here.'
                    },
                    locale: {
                        type: 'string',
                        maxLength: 35,
                        description:
                            'Locale to create in, on a localized type. Omitted, the default ' +
                            'locale is used — call i18n_locales_list if unsure.'
                    },
                    localeGroupId: {
                        type: 'string',
                        description:
                            'Join an existing translation group, making this entry that ' +
                            'group’s row in `locale`. From i18n_translations_get.'
                    },
                    summary: {
                        type: 'string',
                        maxLength: 200,
                        description:
                            'One line describing the change, shown to the user on the approval ' +
                            'card. Write it for a person, e.g. “New article: Spring launch”.'
                    }
                },
                required: ['typeName', 'values', 'summary'],
                additionalProperties: false
            },
            requires: [PERMISSIONS.CONTENT_CREATE],
            readOnly: false,
            effect: 'propose',
            // Copilot-only: it reads the admin services (a viewer must see
            // drafts) or writes through propose-then-apply with the human as
            // actor. MCP's content tools are the public-API set.
            surfaces: ['copilot'],
            handler: async (input, ctx): Promise<ProposalDraft> => {
                const args = (input ?? {}) as {
                    typeName: string;
                    values: Record<string, unknown>;
                    locale?: string;
                    localeGroupId?: string;
                    summary: string;
                };
                const type = await this.resolveGranted(
                    args.typeName,
                    ctx.workspaceId
                );
                const { values, fields } = this.narrowValues(
                    type.name,
                    args.values ?? {}
                );

                return {
                    kind: CONTENT_PROPOSAL_KINDS.createEntry,
                    target: {
                        typeName: type.name,
                        ...(args.locale ? { locale: args.locale } : {}),
                        ...(args.localeGroupId
                            ? { localeGroupId: args.localeGroupId }
                            : {})
                    },
                    patch: { values },
                    summary: args.summary,
                    // No `before` on a create — there is nothing to replace, and
                    // an explicit `undefined` reads better in the diff than a
                    // fabricated `null` that looks like a cleared field.
                    changes: Object.entries(values).map(
                        ([field, after]): ProposalChange => ({
                            field,
                            ...labelOf(fields.get(field)),
                            after
                        })
                    )
                };
            }
        };
    }

    /** `content_propose_update` — a change to an existing entry, with a real diff. */
    private proposeEdit(): ToolDefinition {
        return {
            name: 'content_propose_update',
            title: 'Propose an entry edit',
            description:
                'Propose changing fields on an existing entry. This does NOT save anything — ' +
                'it drafts the change and asks the user to approve it, and the reply will say ' +
                'so. Send only the fields you are changing: everything else is left alone. ' +
                'The user sees a before/after for each field, so read the entry first ' +
                '(admin_content_get) and change what actually needs changing.',
            inputSchema: {
                type: 'object',
                properties: {
                    typeName: {
                        type: 'string',
                        description: 'The entry’s content type.'
                    },
                    id: {
                        type: 'string',
                        description:
                            'The entry’s id, as returned by admin_content_search.'
                    },
                    values: {
                        type: 'object',
                        description:
                            'Only the fields to change, keyed by field name. Omitted fields ' +
                            'keep their current values. A many-relation (e.g. tags) takes an ' +
                            'array of target entry ids and REPLACES the whole set, so include ' +
                            'the ids it already has as well as the new ones — read them with ' +
                            'admin_content_get first, and find new ones with ' +
                            'admin_content_search.'
                    },
                    summary: {
                        type: 'string',
                        maxLength: 200,
                        description:
                            'One line describing the change, shown on the approval card. ' +
                            'Write it for a person, e.g. “Fix the typo in the headline”.'
                    }
                },
                required: ['typeName', 'id', 'values', 'summary'],
                additionalProperties: false
            },
            requires: [PERMISSIONS.CONTENT_UPDATE],
            readOnly: false,
            effect: 'propose',
            // Copilot-only: it reads the admin services (a viewer must see
            // drafts) or writes through propose-then-apply with the human as
            // actor. MCP's content tools are the public-API set.
            surfaces: ['copilot'],
            handler: async (input, ctx): Promise<ProposalDraft> => {
                const args = (input ?? {}) as {
                    typeName: string;
                    id: string;
                    values: Record<string, unknown>;
                    summary: string;
                };
                const type = await this.resolveGranted(
                    args.typeName,
                    ctx.workspaceId
                );
                const { values, fields } = this.narrowValues(
                    type.name,
                    args.values ?? {}
                );
                if (Object.keys(values).length === 0) {
                    throw new Error(
                        'Nothing to change — `values` named no fields.'
                    );
                }

                // Read the live entry so the proposal carries a real diff. It
                // also fails here, at propose time, if the entry is gone or
                // outside the workspace — which is a far better moment for the
                // model to find out than after a human has approved.
                const current = await this.writer.getOne(
                    type,
                    args.id,
                    ctx.workspaceId
                );
                const before = current.values ?? {};

                const changes = Object.entries(values)
                    .map(([field, after]): ProposalChange => {
                        // A whole-set relation has no readable `before` here —
                        // its links are not in the entry's values — so the card
                        // shows only what the set becomes.
                        if (this.isWholeSetRelation(fields.get(field))) {
                            return {
                                field,
                                ...labelOf(fields.get(field)),
                                after
                            };
                        }
                        return {
                            field,
                            ...labelOf(fields.get(field)),
                            before: before[field] ?? null,
                            after
                        };
                    })
                    // A "change" that changes nothing is noise on the card and
                    // invites a reviewer to approve a no-op. The model gets the
                    // error above only when *every* field is unchanged. A
                    // whole-set relation has nothing to compare against, so it
                    // always counts as a change.
                    .filter(
                        (change) =>
                            !('before' in change) ||
                            JSON.stringify(change.before ?? null) !==
                                JSON.stringify(change.after ?? null)
                    );
                if (changes.length === 0) {
                    throw new Error(
                        'That entry already has these values — nothing would change.'
                    );
                }

                return {
                    kind: CONTENT_PROPOSAL_KINDS.updateEntry,
                    target: { typeName: type.name, entryId: args.id },
                    // Only the genuinely-changed fields are carried, so an
                    // accepted proposal writes exactly what the reviewer saw.
                    patch: {
                        values: Object.fromEntries(
                            changes.map((change) => [
                                change.field,
                                change.after
                            ])
                        )
                    },
                    summary: args.summary,
                    changes
                };
            }
        };
    }
    /**
     * `content_propose_bulk_save` — many creates and edits as **one** change.
     *
     * It exists because the single-entry pair scales badly in the one direction
     * users actually push it: "translate these eight posts", "retag everything
     * from last month". Each entry was a tool call, so a run spent its step
     * budget on round trips and the transcript grew a card per record — eight
     * receipts for one instruction, none of which said what the other seven
     * were.
     *
     * **Still `effect: 'propose'`, and still writes nothing here.** The batch is
     * computed from the model's arguments plus the entries as they are now, and
     * handed back for the engine to record and apply. One proposal row, one
     * card, one diff listing every field of every entry — which is also what
     * makes the batch reviewable after the fact instead of merely fast.
     *
     * The per-item addressing is the smaller half of the public API's: an `id`
     * updates, no `id` creates. There is deliberately no group-addressed update
     * (the ambiguity the REST `op` field resolves), because the admin tools hand
     * the model entry ids and nothing here would produce a bare group id.
     */
    private proposeBulk(): ToolDefinition {
        return {
            name: 'content_propose_bulk_save',
            title: 'Propose several entry changes',
            description:
                'Propose creating and/or changing SEVERAL entries of one content type in a ' +
                'single change. Use this instead of calling content_propose_create or ' +
                'content_propose_update repeatedly — the user sees one approval card listing ' +
                'every entry, and you spend one step instead of one per record. An item with ' +
                'an `id` changes that entry (send only the fields you are changing); an item ' +
                'without one creates a new draft. Read the entries first with ' +
                'admin_content_search / admin_content_get so the diff is real. If any entry ' +
                'fails to save, the change stops there and the reply says how many landed — ' +
                'do not claim the whole batch saved without reading it.',
            inputSchema: {
                type: 'object',
                properties: {
                    typeName: {
                        type: 'string',
                        description: 'The content type every item belongs to.'
                    },
                    items: {
                        type: 'array',
                        minItems: 1,
                        maxItems: BULK_MAX_SAVE_ITEMS,
                        description: `The entries to save (1…${BULK_MAX_SAVE_ITEMS}), applied in order.`,
                        items: {
                            type: 'object',
                            properties: {
                                id: {
                                    type: 'string',
                                    description:
                                        'The entry to change, as returned by admin_content_search. ' +
                                        'Omit to create a new entry instead.'
                                },
                                values: {
                                    type: 'object',
                                    description:
                                        'Field values keyed by field name. On an item with an `id`, ' +
                                        'only the fields to change — omitted fields keep their current ' +
                                        'values. A many-relation takes an array of target entry ids and ' +
                                        'REPLACES the whole set.'
                                },
                                locale: {
                                    type: 'string',
                                    maxLength: 35,
                                    description:
                                        'Locale to create in, on a localized type. Create-only — an ' +
                                        'entry id already names its own locale.'
                                },
                                localeGroupId: {
                                    type: 'string',
                                    description:
                                        'Join an existing translation group, making the new entry that ' +
                                        'group’s row in `locale`. Create-only.'
                                }
                            },
                            required: ['values'],
                            additionalProperties: false
                        }
                    },
                    summary: {
                        type: 'string',
                        maxLength: 200,
                        description:
                            'One line describing the whole batch, shown to the user on the approval ' +
                            'card. Write it for a person, e.g. “Translate 8 posts into German”.'
                    }
                },
                required: ['typeName', 'items', 'summary'],
                additionalProperties: false
            },
            requires: [PERMISSIONS.CONTENT_CREATE, PERMISSIONS.CONTENT_UPDATE],
            readOnly: false,
            effect: 'propose',
            surfaces: ['copilot'],
            handler: async (input, ctx): Promise<ProposalDraft> => {
                const args = (input ?? {}) as {
                    typeName: string;
                    items?: BulkProposalItem[];
                    summary: string;
                };
                const type = await this.resolveGranted(
                    args.typeName,
                    ctx.workspaceId
                );
                const items = args.items ?? [];
                if (items.length === 0) {
                    throw new Error(
                        'Nothing to save — `items` was empty. Send at least one entry.'
                    );
                }
                if (items.length > BULK_MAX_SAVE_ITEMS) {
                    throw new Error(
                        `Too many entries in one change: ${items.length}, and the limit is ` +
                            `${BULK_MAX_SAVE_ITEMS}. Split it into smaller batches.`
                    );
                }

                const changes: ProposalChange[] = [];
                const patched: BulkProposalItem[] = [];

                for (const [index, item] of items.entries()) {
                    const { values, fields } = this.narrowValues(
                        type.name,
                        item.values ?? {}
                    );
                    if (Object.keys(values).length === 0) {
                        throw new Error(
                            `Item ${index + 1} names no fields to write. Every item needs \`values\`.`
                        );
                    }

                    // A create has no `before`; an edit reads the live entry so
                    // the card carries a real diff — and so a missing or
                    // out-of-workspace id fails HERE, before the user is told
                    // anything is happening, rather than halfway through the
                    // write.
                    const before = item.id
                        ? ((
                              await this.writer.getOne(
                                  type,
                                  item.id,
                                  ctx.workspaceId
                              )
                          ).values ?? {})
                        : undefined;

                    // Fields that would not actually change are dropped, and
                    // an item left with none of them is dropped whole — the
                    // batch equivalent of `proposeEdit`'s no-op guard, and here
                    // it is more than card hygiene: writing an entry its own
                    // current values still appends a revision and, on a
                    // publishable type, takes a live entry back to draft. A
                    // model re-sending twenty unchanged records would
                    // unpublish twenty live pages.
                    const changed: Record<string, unknown> = {};
                    for (const [field, after] of Object.entries(values)) {
                        const wholeSet = this.isWholeSetRelation(
                            fields.get(field)
                        );
                        // A whole-set relation has no readable `before` here,
                        // so it always counts as a change.
                        const hasBefore = before !== undefined && !wholeSet;
                        if (
                            hasBefore &&
                            JSON.stringify(before[field] ?? null) ===
                                JSON.stringify(after ?? null)
                        ) {
                            continue;
                        }
                        changed[field] = after;
                        changes.push({
                            // Prefixed by position, because the card keys its
                            // rows on `field` and eight entries editing `title`
                            // would otherwise collapse into one row.
                            field: `items[${index}].${field}`,
                            label: `#${index + 1} ${labelOf(fields.get(field)).label ?? field}`,
                            ...(hasBefore
                                ? { before: before[field] ?? null }
                                : {}),
                            after
                        });
                    }
                    if (Object.keys(changed).length === 0) {
                        continue;
                    }

                    patched.push({
                        ...(item.id ? { id: item.id } : {}),
                        values: changed,
                        ...(item.locale ? { locale: item.locale } : {}),
                        ...(item.localeGroupId
                            ? { localeGroupId: item.localeGroupId }
                            : {})
                    });
                }

                if (patched.length === 0) {
                    throw new Error(
                        'Those entries already have these values — nothing would change.'
                    );
                }

                return {
                    kind: CONTENT_PROPOSAL_KINDS.bulkSaveEntries,
                    target: { typeName: type.name },
                    patch: { items: patched },
                    summary: args.summary,
                    changes
                };
            }
        };
    }
}

/** One entry in a proposed batch, as the model sends it and the applier reads it. */
interface BulkProposalItem {
    /** The entry to change. Absent on a create. */
    id?: string;
    /** The fields to write. */
    values: Record<string, unknown>;
    /** Locale of a created row. */
    locale?: string;
    /** Translation group a created row joins. */
    localeGroupId?: string;
}

/** The field's admin label, when it has one — for the diff's row heading. */
function labelOf(field: SerializedField | undefined): { label?: string } {
    const label = field?.admin?.['label'];
    return typeof label === 'string' ? { label } : {};
}
