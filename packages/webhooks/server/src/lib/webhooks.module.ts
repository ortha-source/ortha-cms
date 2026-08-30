import { Module, type DynamicModule } from '@nestjs/common';
import { WEBHOOKS_CONFIG } from './webhooks.tokens';
import { WebhookEndpointsService } from './application/webhook-endpoints.service';
import { WebhookDeliveryRepository } from './infrastructure/webhook-delivery.repository';
import { WebhookDeliveryWorker } from './infrastructure/webhook-delivery.worker';
import { WebhookEndpointRepository } from './infrastructure/webhook-endpoint.repository';
import { WebhookFanoutSubscriber } from './infrastructure/webhook-fanout.subscriber';
import { WebhookHttpClient } from './infrastructure/webhook-http.client';
import { WebhookDeliveriesController } from './http/controllers/webhook-deliveries.controller';
import { WebhookEndpointsController } from './http/controllers/webhook-endpoints.controller';
import { WebhookEventsController } from './http/controllers/webhook-events.controller';
import {
    resolveWebhooksConfig,
    type WebhooksPluginConfig
} from './types/webhooks-config';

/**
 * The webhooks plugin's one dynamic module.
 *
 * `global: true` like every other plugin here, so a future surface — an MCP
 * tool that lists endpoints, a copilot read tool — injects these services
 * rather than growing its own queries over the same three tables.
 *
 * Route order matters: `webhooks/:id/deliveries` is registered **before**
 * `webhooks/:id`, so the literal segment is matched before the parameter that
 * would otherwise swallow it. The same reason content registers `bulk` ahead of
 * `:id`.
 */
@Module({})
export class WebhooksModule {
    static forRoot(config: WebhooksPluginConfig = {}): DynamicModule {
        return {
            module: WebhooksModule,
            global: true,
            controllers: [
                WebhookEventsController,
                WebhookDeliveriesController,
                WebhookEndpointsController
            ],
            providers: [
                {
                    provide: WEBHOOKS_CONFIG,
                    useValue: resolveWebhooksConfig(config)
                },
                WebhookEndpointRepository,
                WebhookDeliveryRepository,
                WebhookHttpClient,
                WebhookEndpointsService,
                // Registers itself with the outbox dispatcher on bootstrap and
                // does nothing but queue rows.
                WebhookFanoutSubscriber,
                // Arms the sender. The only place this plugin touches the
                // network, and it never holds a transaction while it does.
                WebhookDeliveryWorker
            ],
            exports: [
                WEBHOOKS_CONFIG,
                WebhookEndpointsService,
                WebhookEndpointRepository,
                WebhookDeliveryRepository
            ]
        };
    }
}
