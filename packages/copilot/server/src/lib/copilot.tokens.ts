import { Inject } from '@nestjs/common';

/**
 * DI tokens and their inject decorators for the copilot plugin. Kept in a
 * dependency-free module (imports only `@nestjs/common`) so providers and
 * services can reference them without forming an import cycle with
 * `copilot.module.ts`.
 *
 * The model-provider seam's tokens (`MODEL_REGISTRY`, `MODEL_RESOLVER`) live
 * in `@ortha-cms/copilot-domain` alongside the port they bind, so an adapter
 * package never has to import the server.
 */

/** Injection token for the resolved copilot configuration. */
export const COPILOT_CONFIG = Symbol('COPILOT_CONFIG');

/** Parameter decorator that injects the copilot configuration. */
export const InjectCopilotConfig = (): ParameterDecorator =>
    Inject(COPILOT_CONFIG);
