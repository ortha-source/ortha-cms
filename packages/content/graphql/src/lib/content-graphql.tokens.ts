import { Inject } from '@nestjs/common';

/**
 * DI tokens for the content GraphQL plugin. A dependency-free module on
 * purpose: providers import it without pulling in the module that binds them,
 * so there is no import cycle.
 */

/** The resolved plugin config (`ResolvedContentGraphqlConfig`). */
export const CONTENT_GRAPHQL_CONFIG = Symbol('CONTENT_GRAPHQL_CONFIG');

/** Injects the resolved plugin config. */
export const InjectGraphqlConfig = (): ParameterDecorator =>
    Inject(CONTENT_GRAPHQL_CONFIG);
