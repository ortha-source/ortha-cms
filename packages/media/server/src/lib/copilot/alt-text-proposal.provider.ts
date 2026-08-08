import { Injectable } from '@nestjs/common';
import { PERMISSIONS } from '@ortha-cms/identity-server';
import type {
    CopilotToolProvider,
    ProposalDraft,
    ToolContext,
    ToolSpec
} from '@ortha-cms/copilot-domain';
import { AssetViewQuery } from '../infrastructure/queries/asset-view.query';

/** The proposal kind this plugin declares and applies. */
export const MEDIA_PROPOSAL_KINDS = {
    /** Set an asset's alternative text. */
    setAltText: 'media.asset.setAlt'
} as const;

/**
 * `media.proposeAltText` — the alt-text tool ADR-0005 §6 names as the
 * motivating case for auto-apply ("a team that trusts alt-text generation
 * should not click twice a hundred times a day").
 *
 * Like every propose tool it **writes nothing**: it reads the asset, drafts the
 * change, and the run engine records it for a human — or applies it directly,
 * if this workspace opted this specific tool in.
 *
 * The tool deliberately does not generate the text itself. The model already
 * has the asset's name, kind and MIME type from `media.searchAssets`, and
 * asking it to describe an image it has not seen would produce confident
 * fiction. What this does is carry the model's proposed text to a reviewer with
 * the current value beside it.
 */
@Injectable()
export class AltTextProposalToolProvider implements CopilotToolProvider {
    constructor(private readonly assets: AssetViewQuery) {}

    /** The one media write tool. */
    tools(): readonly ToolSpec[] {
        return [this.proposeAltText()];
    }

    private proposeAltText(): ToolSpec {
        return {
            name: 'media.proposeAltText',
            description:
                'Propose alternative text for a media asset. This does NOT save anything — it ' +
                'drafts the change for the user to approve, and the reply will say so. Find ' +
                'the asset with media.searchAssets first; assets with no alt text report ' +
                '`alt: null`. Describe what the image conveys in context, not what file it is.',
            inputSchema: {
                type: 'object',
                properties: {
                    assetId: {
                        type: 'string',
                        description:
                            'The asset’s id, as returned by media.searchAssets.'
                    },
                    alt: {
                        type: 'string',
                        maxLength: 1000,
                        description:
                            'The alternative text to set. Send an empty string only for a ' +
                            'genuinely decorative image.'
                    },
                    summary: {
                        type: 'string',
                        maxLength: 200,
                        description:
                            'One line for the approval card, written for a person, ' +
                            'e.g. “Alt text for hero.jpg”.'
                    }
                },
                required: ['assetId', 'alt', 'summary'],
                additionalProperties: false
            },
            permissions: [PERMISSIONS.MEDIA_UPDATE],
            effect: 'propose',
            run: async (input, ctx: ToolContext): Promise<ProposalDraft> => {
                const args = (input ?? {}) as {
                    assetId: string;
                    alt: string;
                    summary: string;
                };

                // Workspace-scoped, so an id from another workspace reads as
                // absent — and the failure lands here rather than after a human
                // has approved something that cannot be applied.
                const asset = await this.assets.byId(
                    args.assetId,
                    ctx.workspaceId
                );
                if (!asset) {
                    throw new Error(`No asset "${args.assetId}".`);
                }
                if ((asset.alt ?? '') === args.alt) {
                    throw new Error(
                        `"${asset.name}" already has exactly that alt text.`
                    );
                }

                return {
                    kind: MEDIA_PROPOSAL_KINDS.setAltText,
                    target: { assetId: asset.id, name: asset.name },
                    patch: { alt: args.alt },
                    summary: args.summary,
                    changes: [
                        {
                            field: 'alt',
                            label: 'Alternative text',
                            before: asset.alt,
                            after: args.alt
                        }
                    ]
                };
            }
        };
    }
}
