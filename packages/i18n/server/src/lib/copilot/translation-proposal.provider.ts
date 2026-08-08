import { Injectable } from '@nestjs/common';
import { PERMISSIONS } from '@ortha-cms/identity-server';
import {
    InjectContentRegistry,
    WorkspaceGrantsQuery,
    type ContentTypeRegistry
} from '@ortha-cms/content-server';
import type {
    CopilotToolProvider,
    ProposalChange,
    ProposalDraft,
    ToolContext,
    ToolSpec
} from '@ortha-cms/copilot-domain';
import { LocaleRegistryService } from '../locales/services/locale-registry.service';
import { LocaleGroupService } from '../content/services/locale-group.service';

/** The proposal kind this plugin declares and applies. */
export const I18N_PROPOSAL_KINDS = {
    /** Create a sibling row of an entry in another locale. */
    createTranslation: 'i18n.entry.translate'
} as const;

/**
 * `i18n.proposeTranslation` — drafts an entry's translation into another
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
export class TranslationProposalToolProvider implements CopilotToolProvider {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly locales: LocaleRegistryService,
        private readonly groups: LocaleGroupService,
        private readonly grants: WorkspaceGrantsQuery
    ) {}

    /** The one i18n write tool. */
    tools(): readonly ToolSpec[] {
        return [this.proposeTranslation()];
    }

    private proposeTranslation(): ToolSpec {
        return {
            name: 'i18n.proposeTranslation',
            description:
                'Propose a translation of an entry into another locale, creating that locale’s ' +
                'row in the same translation group. This does NOT save anything — it drafts ' +
                'the change for the user to approve, and the reply will say so. Read the ' +
                'source entry first (content.getEntry) and translate its text yourself; only ' +
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
                            'The locale slug to create, from i18n.listLocales. It must not ' +
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
            permissions: [PERMISSIONS.CONTENT_UPDATE],
            effect: 'propose',
            run: async (input, ctx: ToolContext): Promise<ProposalDraft> => {
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
                        `Unknown locale "${args.locale}". Call i18n.listLocales for the ` +
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
                            'content.proposeEdit on that row instead.'
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
