/** DI tokens this plugin owns. */

import { Inject } from '@nestjs/common';

/** The validated {@link TransferPluginConfig}, provided by `TransferModule.forRoot`. */
export const TRANSFER_CONFIG = Symbol('TRANSFER_CONFIG');

/** Injects the transfer config. */
export const InjectTransferConfig = (): ParameterDecorator =>
    Inject(TRANSFER_CONFIG);

/** The resolved {@link TransferLimits}, so a consumer never re-merges defaults. */
export const TRANSFER_LIMITS = Symbol('TRANSFER_LIMITS');

/** Injects the resolved limits. */
export const InjectTransferLimits = (): ParameterDecorator =>
    Inject(TRANSFER_LIMITS);
