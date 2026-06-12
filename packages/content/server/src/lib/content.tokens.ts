import { Inject } from '@nestjs/common';

/** DI token under which the {@link ContentTypeRegistry} is provided. */
export const CONTENT_REGISTRY = Symbol('CONTENT_REGISTRY');

/** Injects the content-type registry. */
export const InjectContentRegistry = (): ParameterDecorator =>
    Inject(CONTENT_REGISTRY);
