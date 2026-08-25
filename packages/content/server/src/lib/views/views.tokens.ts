import { Inject } from '@nestjs/common';

/**
 * The content-type registry, as the **views** module provides it.
 *
 * A token of its own rather than reusing `CONTENT_REGISTRY`: both modules are
 * `global: true`, and two global modules providing the same token put one in
 * the position of silently shadowing the other in Nest's global registry. The
 * value is the same registry instance either way, so nothing would break today
 * — but "which module wins" is not a question a reader of either file can
 * answer, and the answer would change with registration order.
 *
 * Dependency-free by design, so providers reference it without an import cycle
 * with the module.
 */
export const VIEW_CONTENT_REGISTRY = Symbol('VIEW_CONTENT_REGISTRY');

/** Injects the registry the views module was constructed with. */
export const InjectViewContentRegistry = (): ParameterDecorator =>
    Inject(VIEW_CONTENT_REGISTRY);
