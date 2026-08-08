import { Injectable } from '@nestjs/common';
import { PERMISSIONS } from '@ortha-cms/identity-server';
import type {
    CopilotToolProvider,
    ProposalChange,
    ProposalDraft,
    ToolContext,
    ToolSpec
} from '@ortha-cms/copilot-domain';
import { InjectContentRegistry } from '../content.tokens';
import type {
    ContentTypeRegistry,
    SerializedField
} from '../registry/content-type-registry';
import { EntryWriterService } from '../entries/infrastructure/persistence/entry-writer.service';
import { WorkspaceGrantsQuery } from '../content-types/queries/workspace-grants.query';
import { CONTENT_PROPOSAL_KINDS } from './proposal-kinds';

/**
 * The content plugin's **write** tools — `content.proposeEntry` and
 * `content.proposeEdit`.
 *
 * Both are `effect: 'propose'`: they compute a change and hand it back, and the
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
 * deliberately no `status` in either tool's schema.
 */
@Injectable()
export class EntryProposalToolProvider implements CopilotToolProvider {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly writer: EntryWriterService,
        private readonly grants: WorkspaceGrantsQuery
    ) {}

    /** The two write tools, in the order the model sees them. */
    tools(): readonly ToolSpec[] {
        return [this.proposeEntry(), this.proposeEdit()];
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
     * Join-backed relations are excluded: their links never travel in the
     * `values` bag, so a value for one would be silently dropped by the writer
     * — a proposal a reviewer accepts and that then does nothing is worse than
     * one that is refused up front.
     */
    private writableFields(typeName: string): Map<string, SerializedField> {
        const schema = this.registry.serialize(typeName);
        const fields = new Map<string, SerializedField>();
        for (const field of schema?.fields ?? []) {
            const joinBacked =
                field.type === 'relation' &&
                !!field.relation &&
                (field.relation.many || !!field.relation.inverse);
            if (!joinBacked) {
                fields.set(field.name, field);
            }
        }
        return fields;
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
                    'Call content.listTypes for this type’s fields. Many-relations and ' +
                    'back-references cannot be set this way.'
            );
        }
        return { values, fields };
    }

    /** `content.proposeEntry` — a new draft entry, for a human to accept. */
    private proposeEntry(): ToolSpec {
        return {
            name: 'content.proposeEntry',
            description:
                'Propose creating a new entry. This does NOT create anything — it drafts the ' +
                'change and asks the user to approve it, and the reply will say so. Call ' +
                'content.listTypes for the type’s fields first; supply only fields you are ' +
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
                            'Field values keyed by field name, as content.listTypes describes ' +
                            'them. Many-relations and back-references cannot be set here.'
                    },
                    locale: {
                        type: 'string',
                        maxLength: 35,
                        description:
                            'Locale to create in, on a localized type. Omitted, the default ' +
                            'locale is used — call i18n.listLocales if unsure.'
                    },
                    localeGroupId: {
                        type: 'string',
                        description:
                            'Join an existing translation group, making this entry that ' +
                            'group’s row in `locale`. From i18n.getTranslations.'
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
            permissions: [PERMISSIONS.CONTENT_CREATE],
            effect: 'propose',
            run: async (input, ctx: ToolContext): Promise<ProposalDraft> => {
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

    /** `content.proposeEdit` — a change to an existing entry, with a real diff. */
    private proposeEdit(): ToolSpec {
        return {
            name: 'content.proposeEdit',
            description:
                'Propose changing fields on an existing entry. This does NOT save anything — ' +
                'it drafts the change and asks the user to approve it, and the reply will say ' +
                'so. Send only the fields you are changing: everything else is left alone. ' +
                'The user sees a before/after for each field, so read the entry first ' +
                '(content.getEntry) and change what actually needs changing.',
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
                            'The entry’s id, as returned by content.searchEntries.'
                    },
                    values: {
                        type: 'object',
                        description:
                            'Only the fields to change, keyed by field name. Omitted fields ' +
                            'keep their current values.'
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
            permissions: [PERMISSIONS.CONTENT_UPDATE],
            effect: 'propose',
            run: async (input, ctx: ToolContext): Promise<ProposalDraft> => {
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
                    .map(
                        ([field, after]): ProposalChange => ({
                            field,
                            ...labelOf(fields.get(field)),
                            before: before[field] ?? null,
                            after
                        })
                    )
                    // A "change" that changes nothing is noise on the card and
                    // invites a reviewer to approve a no-op. The model gets the
                    // error above only when *every* field is unchanged.
                    .filter(
                        (change) =>
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
}

/** The field's admin label, when it has one — for the diff's row heading. */
function labelOf(field: SerializedField | undefined): { label?: string } {
    const label = field?.admin?.['label'];
    return typeof label === 'string' ? { label } : {};
}
