import { Module, type DynamicModule } from '@nestjs/common';
import { ALARMS_CONFIG } from './alarms.tokens';
import { AlarmRulesService } from './application/alarm-rules.service';
import { AlarmEvaluator } from './infrastructure/alarm-evaluator.service';
import { AlarmFindingStore } from './infrastructure/alarm-finding.store';
import { AlarmRuleRepository } from './infrastructure/alarm-rule.repository';
import { AlarmSweepService } from './infrastructure/alarm-sweep.service';
import { AlarmsWorkspacePurger } from './infrastructure/purge/alarms-workspace.purger';
import { EntryEventSubscriber } from './infrastructure/entry-event.subscriber';
import { AlarmsCopilotToolProvider } from './copilot/alarms-tool.provider';
import { AlarmFindingsController } from './http/controllers/alarm-findings.controller';
import { AlarmRulesController } from './http/controllers/alarm-rules.controller';
import {
    resolveAlarmsConfig,
    type AlarmsPluginConfig
} from './types/alarms-config';

/**
 * The alarms plugin's one dynamic module.
 *
 * `global: true` like every other plugin here, so its services are injectable
 * from anywhere — which matters for the tools a future surface (MCP, the
 * copilot) would bind over the same findings.
 *
 * Route order: the findings controller declares its literal `by-entry` and
 * `summary` segments, and both sit under a different prefix from the rules
 * controller, so there is no wildcard to shadow them. The two controllers are
 * registered findings-first anyway, matching how content orders `bulk` ahead of
 * `:id`.
 */
@Module({})
export class AlarmsModule {
    static forRoot(config: AlarmsPluginConfig = {}): DynamicModule {
        return {
            module: AlarmsModule,
            global: true,
            controllers: [AlarmFindingsController, AlarmRulesController],
            providers: [
                {
                    provide: ALARMS_CONFIG,
                    useValue: resolveAlarmsConfig(config)
                },
                AlarmRuleRepository,
                AlarmFindingStore,
                // Removes this workspace's rules and findings when the
                // workspace itself is deleted. Neither table carries an FK to
                // `workspaces`, and an orphaned rule is not inert: the sweep
                // reads `allActive()` without checking the workspace still
                // exists, so it would be re-evaluated forever while being
                // unreachable from an editor that no longer opens.
                AlarmsWorkspacePurger,
                AlarmEvaluator,
                AlarmRulesService,
                // Registers itself with the outbox dispatcher on bootstrap.
                EntryEventSubscriber,
                // Arms the periodic rescan — the only path that covers rules
                // about entries nobody is touching.
                AlarmSweepService,
                // Contributes the one alarms read tool to the shared registry,
                // narrowed to the copilot surface. Registers itself from
                // `onModuleInit` against an optionally-injected registry, so a
                // deployment running neither consumer simply skips it.
                AlarmsCopilotToolProvider
            ],
            exports: [
                ALARMS_CONFIG,
                // Exported for the surfaces that will read findings without
                // going through HTTP: an MCP tool, a copilot tool, a future
                // webhook subscriber. All three want the same store rather than
                // their own queries over the same two tables.
                AlarmFindingStore,
                AlarmEvaluator,
                AlarmRulesService
            ]
        };
    }
}
