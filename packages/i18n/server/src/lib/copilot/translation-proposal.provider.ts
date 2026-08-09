import { Injectable, Optional, type OnModuleInit } from '@nestjs/common';
import { PERMISSIONS } from '@ortha-cms/identity-server';
import {
    InjectContentRegistry,
    WorkspaceGrantsQuery,
    type ContentTypeRegistry
} from '@ortha-cms/content-server';
import type { ProposalChange, ProposalDraft } from '@ortha-cms/copilot-domain';
import { ToolRegistry } from '@ortha-cms/tools-server';
import type { ToolDefinition, ToolProvider } from '@ortha-cms/tools-server';
import { LocaleRegistryService } from '../locales/services/locale-registry.service';
import { LocaleGroupService } from '../content/services/locale-group.service';

/** The proposal kind this plugin declares and applies. */
export const I18N_PROPOSAL_KINDS = {
    /** Create a sibling row of an entry in another locale. */
    createTranslation: 'i18n.entry.translate'
} as const;

/**
 * `i18n_propose_translation` — drafts an entry's translation into another
 * locale, for a human to accept.
 *
 * Like every propose tool it **writes nothing**. What it does do is the part a
 * model cannot be trusted to get right on its own: resolve the locale slug
 * against the configured set, confirm the target locale does not already exist
 * in the group (a duplicate would be a 409 at apply time, long after approval),
 * and carry the source values alongside the translated ones so the reviewer
 * sees what was translated *from*.
 *
 * Only **localized** fields are translated. A field the type declares as shared
 * is one value across the whole group by definition — writing a per-locale
 * version of it would either be ignored or silently overwrite every sibling,
 * and neither is something to hand a reviewer.
 */
@Injectable()
export class TranslationProposalToolProvider
    implements ToolProvider, OnModuleInit
{
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly locales: LocaleRegistryService,
        private readonly groups: LocaleGroupService,
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

    /** The one i18n write tool. */
    tools(): readonly ToolDefinition[] {
        return [this.proposeTranslation()];
    }

    private proposeTranslation(): ToolDefinition {
        return {
            name: 'i18n_propose_translation',
            title: 'Propose a translation',
            description:
                'Propose a translation of an entry into another locale, creating that locale’s ' +
                'row in the same translation group. This does NOT save anything — it drafts ' +
                'the change for the user to approve, and the reply will say so. Read the ' +
                'source entry first (admin_content_get) and translate its text yourself; only ' +
                'fields the type marks as localized can differ per locale.',
            inputSchema: {
                type: 'object',
                properties: {
                    typeName: {
                        type: 'string',
                        description:
                            'The entry’s content type. It must be localized.'
                    },
                    id: {
                        type: 'string',
                        description:
                            'The id of the source entry — the row you translated from.'
                    },
                    locale: {
                        type: 'string',
                        maxLength: 35,
                        description:
                            'The locale slug to create, from i18n_locales_list. It must not ' +
                            'already exist in this entry’s translation group.'
                    },
                    values: {
                        type: 'object',
                        description:
                            'The translated values, keyed by field name. Only localized ' +
                            'fields are accepted; shared fields are copied by the CMS.'
                    },
                    summary: {
                        type: 'string',
                        maxLength: 200,
                        description:
                            'One line for the approval card, e.g. “German translation of ' +
                            'Spring launch”.'
                    }
                },
                required: ['typeName', 'id', 'locale', 'values', 'summary'],
                additionalProperties: false
            },
            // `content:update` rather than `content:create`: the design's v1
            // catalogue says so, and it is the right key — a translation is a
            // change to an existing piece of content, not a new one, which is
            // exactly how an editor thinks about it.
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
                    locale: string;
                    values: Record<string, unknown>;
                    summary: string;
                };

                const type = this.registry.get(args.typeName);
                const granted = await this.grants.grantedSlugs(ctx.workspaceId);
                if (!type || !granted.has(type.name)) {
                    throw new Error(
                        `Unknown content type "${args.typeName}" in this workspace.`
                    );
                }
                if (!type.i18n) {
                    throw new Error(
                        `Content type "${type.name}" is not localized, so it cannot be translated.`
                    );
                }

                const target = this.locales.get(args.locale);
                if (!target) {
                    throw new Error(
                        `Unknown locale "${args.locale}". Call i18n_locales_list for the ` +
                            'configured slugs.'
                    );
                }

                // The group read doubles as the existence check on the source
                // entry: it 404s a missing or soft-deleted row, workspace-scoped.
                const group = await this.groups.entryLocales(
                    type,
                    args.id,
                    ctx.workspaceId
                );
                const existing = group.items.find(
                    (item) => item.locale === target.slug
                );
                if (existing?.entry) {
                    throw new Error(
                        `This entry already has a "${target.slug}" translation. Use ` +
                            'content_propose_update on that row instead.'
                    );
                }

                const schema = this.registry.serialize(type.name);
                const localized = new Map(
                    (schema?.fields ?? [])
                        .filter((field) => field.localized)
                        .map((field) => [field.name, field])
                );
                const values = args.values ?? {};
                const rejected = Object.keys(values).filter(
                    (name) => !localized.has(name)
                );
                if (rejected.length > 0) {
                    throw new Error(
                        `These fields are shared across locales and cannot be translated: ` +
                            `${rejected.join(', ')}. Only ${[...localized.keys()].join(', ')} ` +
                            'vary per locale on this type.'
                    );
                }
                if (Object.keys(values).length === 0) {
                    throw new Error('No translated values were supplied.');
                }

                return {
                    kind: I18N_PROPOSAL_KINDS.createTranslation,
                    target: {
                        typeName: type.name,
                        sourceId: args.id,
                        localeGroupId: group.localeGroupId,
                        locale: target.slug
                    },
                    patch: { values },
                    summary: args.summary,
                    changes: Object.entries(values).map(
                        ([field, after]): ProposalChange => {
                            const label =
                                localized.get(field)?.admin?.['label'];
                            return {
                                field,
                                ...(typeof label === 'string' ? { label } : {}),
                                after
                            };
                        }
                    )
                };
            }
        };
    }
}
