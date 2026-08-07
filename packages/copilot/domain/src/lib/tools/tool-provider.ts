import type { ToolSpec } from './tool-spec';

/**
 * A plugin's contribution to the copilot's tool catalogue. Bound by
 * `content-server`, `media-server`, `i18n-server`, … — never implemented by
 * the copilot itself.
 *
 * `tools()` is called per run rather than once at boot because a workspace's
 * content types drive the generated input schemas, and those differ per
 * workspace.
 */
export interface CopilotToolProvider {
    /** The tools this plugin offers for a run in `workspaceId`. */
    tools(workspaceId: string): Promise<readonly ToolSpec[]> | readonly ToolSpec[];
}

/**
 * DI token every tool-binding plugin provides (multi-bound: each plugin adds
 * its own entry).
 *
 * It lives in `domain/` rather than in `copilot/server` — a deliberate
 * departure from the sketch in `docs/design/copilot.md` §3, and the same call
 * phase 0 made for `MODEL_REGISTRY`. The whole point of the port is that
 * `copilot/server` must not import `content-server`; putting the token in the
 * server would just invert that dependency, forcing `content-server` to import
 * `copilot-server` to bind it. In `domain/` a tool binder depends on the
 * framework-free core and on nothing else.
 */
export const COPILOT_TOOL_PROVIDER = Symbol('COPILOT_TOOL_PROVIDER');
