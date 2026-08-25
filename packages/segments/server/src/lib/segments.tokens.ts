import { Inject } from '@nestjs/common';

/**
 * DI tokens for the segmentation plugin.
 *
 * A dependency-free module on purpose: providers reference the tokens without
 * importing the module that binds them, so there is no cycle between the two.
 */

/** The plugin's validated configuration. */
export const SEGMENTS_CONFIG = Symbol('SEGMENTS_CONFIG');

/** Injects {@link SEGMENTS_CONFIG}. */
export const InjectSegmentsConfig = (): ParameterDecorator =>
    Inject(SEGMENTS_CONFIG);
