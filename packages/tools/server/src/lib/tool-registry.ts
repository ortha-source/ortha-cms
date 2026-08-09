import {
    ForbiddenException,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import type {
    ResourceContents,
    ResourceDefinition,
    ToolContext,
    ToolDefinition,
    ToolOutput,
    ToolSurface
} from './tool';
import type { ToolProvider } from './tool-provider';

/**
 * The shared, transport-neutral catalogue of everything an agent can do to this
 * CMS — and the **single place** a tool call is authorized.
 *
 * Two consumers, one registry: the MCP endpoint exposes it to external clients
 * (Claude Desktop, Cursor, an agent framework), and the copilot's in-process
 * tool loop will inject the very same instance. That is the whole reason
 * nothing on {@link ToolDefinition} or {@link ToolContext} mentions HTTP or
 * JSON-RPC — a tool added for one consumer is automatically available to the
 * other, and neither can end up with a private set of rules.
 *
 * **The authorization invariant.** `call()` checks `requires` before dispatch,
 * and `visibleTo()` merely *hides* what the actor could not call anyway.
 * Filtering a list is a usability nicety; the check in `call()` is the security
 * boundary, and it must stay that way — an MCP client is free to invoke a tool
 * name it was never shown, and the copilot may hallucinate one outright.
 */
@Injectable()
export class ToolRegistry {
    private readonly providers: ToolProvider[] = [];

    /**
     * Add a provider's contributions. Called by each capability plugin from
     * `onModuleInit`; see {@link ToolProvider} for why this is a call rather
     * than a DI multi-binding.
     */
    register(provider: ToolProvider): void {
        this.providers.push(provider);
    }

    /**
     * Every registered tool, in registration order.
     *
     * A duplicate name is a **wiring bug** — two plugins claiming one tool name
     * would make which implementation runs depend on registration order — so it
     * fails loudly here rather than resolving silently.
     */
    all(): readonly ToolDefinition[] {
        const tools: ToolDefinition[] = [];
        const seen = new Set<string>();
        for (const provider of this.providers) {
            for (const tool of provider.tools()) {
                if (seen.has(tool.name)) {
                    throw new Error(
                        `Duplicate tool name "${tool.name}" — two providers registered it. Tool names must be unique across plugins.`
                    );
                }
                seen.add(tool.name);
                tools.push(tool);
            }
        }
        return tools;
    }

    /**
     * Every tool offered to one **surface** — the MCP endpoint or the copilot.
     *
     * A tool that names no surfaces is offered to both, so this narrows only
     * the ones that declared a reason to be narrowed (see {@link ToolSurface}).
     */
    forSurface(surface: ToolSurface): readonly ToolDefinition[] {
        return this.all().filter(
            (tool) => !tool.surfaces || tool.surfaces.includes(surface)
        );
    }

    /**
     * The tools `context`'s actor holds the permissions for, on one surface.
     * What a client is shown — a read-only token never learns that
     * `content_create` exists, which is a far better experience than
     * discovering it via a refusal, and keeps a model from burning turns on
     * calls that cannot succeed.
     */
    visibleTo(
        context: ToolContext,
        surface: ToolSurface
    ): readonly ToolDefinition[] {
        return this.forSurface(surface).filter((tool) =>
            this.permits(tool, context)
        );
    }

    /**
     * Authorize and run one tool.
     *
     * An unknown name and a name the actor may not call are deliberately
     * **different** answers: the tool set is not secret (it is the same for
     * every actor of a given scope, and documented), so conflating them would
     * only make a legitimate permission problem undiagnosable. What is never
     * revealed is *data* — that distinction lives in the handlers, where an
     * ungranted content type 404s exactly like an unknown one.
     */
    async call(
        name: string,
        input: Record<string, unknown>,
        context: ToolContext,
        surface: ToolSurface
    ): Promise<ToolOutput> {
        // Scoped to the surface, so a caller cannot invoke a tool the *other*
        // consumer's rules were written for — an MCP client naming
        // `content_propose_edit` gets "unknown tool", not a proposal it has no
        // way to accept.
        const tool = this.forSurface(surface).find(
            (candidate) => candidate.name === name
        );
        if (!tool) {
            throw new NotFoundException(`Unknown tool "${name}".`);
        }
        if (!this.permits(tool, context)) {
            throw new ForbiddenException(
                `"${name}" requires ${tool.requires.join(', ')}, which this ${
                    context.actor.kind === 'token' ? 'token' : 'user'
                } does not hold.`
            );
        }
        return tool.handler(input, context);
    }

    /** Every resource visible to the actor, across providers. */
    async resources(
        context: ToolContext
    ): Promise<readonly ResourceDefinition[]> {
        const perProvider = await Promise.all(
            this.providers.map(
                (provider) => provider.resources?.(context) ?? []
            )
        );
        return perProvider.flat();
    }

    /**
     * Read one resource. Providers are asked in registration order and the
     * first that claims the URI wins; nobody claiming it is a 404.
     */
    async readResource(
        uri: string,
        context: ToolContext
    ): Promise<ResourceContents> {
        for (const provider of this.providers) {
            const contents = await provider.readResource?.(uri, context);
            if (contents) {
                return contents;
            }
        }
        throw new NotFoundException(`Unknown resource "${uri}".`);
    }

    /** Whether the actor holds every permission the tool requires. */
    private permits(tool: ToolDefinition, context: ToolContext): boolean {
        return tool.requires.every((permission) => context.can(permission));
    }
}
