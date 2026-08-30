import { Inject } from '@nestjs/common';

/** DI token for the plugin's resolved configuration. */
export const WEBHOOKS_CONFIG = Symbol('WEBHOOKS_CONFIG');

/** Injects the resolved webhooks configuration. */
export const InjectWebhooksConfig = (): ParameterDecorator =>
    Inject(WEBHOOKS_CONFIG);
