import { Injectable, Optional, type OnModuleInit } from '@nestjs/common';
import { PERMISSIONS } from '@orthacms/identity-server';
import { ToolRegistry } from '@orthacms/tools-server';
import type { ToolDefinition, ToolProvider } from '@orthacms/tools-server';
import { ExplainService } from '../../application/explain.service';
import { SegmentCatalogService } from '../../application/segment-catalog.service';

/** Reader tags one `access_explain` call may carry. */
const MAX_TAGS = 50;

/**
 * The segmentation plugin's agent tools — `access_explain` and
 * `access_segment_types`.
 *
 * Both are **reads and nothing else**, and that is a deliberate limit rather
 * than a first instalment. Writing a rule from a chat turn changes what every
 * reader of the site can see, from an actor whose intent was expressed in prose
 * and whose mistake is invisible until someone reports missing content — so
 * `access:manage` stays a thing a person does in the admin, where the change is
 * reviewable before it lands. What an agent is good for here is the opposite
 * job: answering "why can this reader not see the article", which today means a
 * person opening the entry, opening the tab, and pasting tags.
 *
 * Offered to the **copilot only**, and the reason is a fact about the other
 * surface rather than a judgement about it. Both tools require `access:read`,
 * and no API-token scope grants it — `scopePermissions` gives `read` and `full`
 * their content and media permissions and nothing else. Declared for MCP they
 * would be registered, filtered out of every `tools/list` an external agent
 * ever makes, and callable by nobody: a tool that exists and cannot run reads
 * as a broken one.
 *
 * Widening a token scope to reach them would be the wrong fix in the wrong
 * direction. `access:read` is what the six `/api/access` routes check, so a
 * scope holding it would open the whole management API to a bearer token — and
 * even the reads there describe the tenant's business (its plan tiers, how many
 * organisations it has), which a content token has no claim on. If an external
 * agent should ever be able to ask this, it needs a scope of its own, decided
 * deliberately.
 *
 * `access:read` rather than `access:manage`, matching the HTTP route: an editor
 * about to publish behind a rule needs to be able to check it, and the answer
 * concerns content the caller can already read.
 */
@Injectable()
export class AccessToolProvider implements ToolProvider, OnModuleInit {
    constructor(
        private readonly explain: ExplainService,
        private readonly catalog: SegmentCatalogService,
        @Optional() private readonly registry?: ToolRegistry
    ) {}

    /**
     * Register with the shared catalogue once the DI graph is built.
     *
     * `@Optional()` because a deployment may run neither the MCP endpoint nor
     * the copilot, in which case these simply go unregistered — the segmentation
     * plugin itself must still boot, since it is the read path for the whole
     * public API.
     */
    onModuleInit(): void {
        this.registry?.register(this);
    }

    /** The two tools, in the order a caller needs them. */
    tools(): readonly ToolDefinition[] {
        return [this.listTypes(), this.explainAccess()];
    }

    /**
     * `access_segment_types` — the axes this installation decides access on.
     *
     * A separate tool rather than a paragraph in `access_explain`'s description,
     * because the axes are **runtime data**: an administrator creates them, and
     * a description baked at build time would be describing a different
     * installation. It is also what makes the tags argument answerable — without
     * it a model has to guess that the namespace is `org` rather than
     * `organisation`.
     *
     * It lists types and their **segment counts**, never the segments: a
     * four-hundred-organisation list is both a large prompt and a customer
     * roster, and neither belongs in a tool result by default.
     */
    private listTypes(): ToolDefinition {
        return {
            name: 'access_segment_types',
            title: 'List segmentation axes',
            description:
                'List the segment types this CMS decides reader access on — the tag namespace ' +
                'each one owns (the half before the colon in a reader tag like "org:acme"), its ' +
                'label, and how many segments it holds. Call this before access_explain so the ' +
                'tags you pass use namespaces this installation actually has. An empty list ' +
                'means nothing is segmented: every published entry is readable by everyone.',
            inputSchema: {
                type: 'object',
                properties: {},
                additionalProperties: false
            },
            requires: [PERMISSIONS.ACCESS_READ],
            readOnly: true,
            effect: 'read',
            surfaces: ['copilot'],
            handler: async () => {
                const snapshot = this.catalog.snapshot();
                const counts = new Map<string, number>();
                for (const segment of snapshot.segments) {
                    counts.set(
                        segment.typeKey,
                        (counts.get(segment.typeKey) ?? 0) + 1
                    );
                }
                return {
                    // Only the axes that actually decide anything. A draining
                    // type is on its way out of the predicate, and offering it
                    // as something to reason about would invite a rule authored
                    // against an axis that stops applying mid-conversation.
                    segmentTypes: snapshot.types
                        .filter((type) => type.state === 'active')
                        .map((type) => ({
                            key: type.key,
                            label: type.label,
                            segmentCount: counts.get(type.key) ?? 0
                        }))
                };
            }
        };
    }

    /**
     * `access_explain` — why one reader does or does not see one entry.
     *
     * It re-runs the real decision function and reports each check in order,
     * rather than describing what the rule ought to do. A second implementation
     * written to explain the first is a second implementation that can disagree
     * with it, and the explanation is precisely the thing that must not.
     */
    private explainAccess(): ToolDefinition {
        return {
            name: 'access_explain',
            title: 'Explain an access decision',
            description:
                'Answer "would this reader see this entry, and why" for one entry and one set ' +
                'of reader tags. Returns the decision, which condition group admitted them (or ' +
                'what refused them), what a refused reader is served instead, and one step per ' +
                'check in the order the CMS made them: absolute exclusions first, then the date ' +
                'window, then each OR-ed condition group. Pass the tags your entitlement source ' +
                'would produce, e.g. ["org:acme","plan:pro"]; an empty list is an anonymous ' +
                'reader. Use this when an entry you expected is missing from a list — it tells ' +
                'a missing entitlement apart from a missing entry.',
            inputSchema: {
                type: 'object',
                properties: {
                    typeName: {
                        type: 'string',
                        description: 'The entry’s content type.'
                    },
                    id: {
                        type: 'string',
                        description: 'The entry’s id.'
                    },
                    tags: {
                        type: 'array',
                        items: { type: 'string' },
                        maxItems: MAX_TAGS,
                        description:
                            'The reader’s tags. Omit or pass [] for an anonymous reader.'
                    }
                },
                required: ['typeName', 'id'],
                additionalProperties: false
            },
            requires: [PERMISSIONS.ACCESS_READ],
            readOnly: true,
            effect: 'read',
            surfaces: ['copilot'],
            handler: async (input, ctx) => {
                const args = (input ?? {}) as {
                    typeName: string;
                    id: string;
                    tags?: string[];
                };
                // Clamped as well as declared: the schema validator is defence
                // in depth, not the boundary, and the resolver walks this list
                // per segment.
                const tags = (args.tags ?? []).slice(0, MAX_TAGS);
                return this.explain.explain({
                    workspaceId: ctx.workspaceId,
                    typeSlug: args.typeName,
                    entryId: args.id,
                    tags
                });
            }
        };
    }
}
