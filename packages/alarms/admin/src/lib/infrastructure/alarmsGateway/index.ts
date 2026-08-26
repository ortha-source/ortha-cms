import type {
    AlarmFinding,
    AlarmFindingList,
    AlarmRule,
    AlarmRulePreview,
    AlarmScanResult,
    AlarmSeverity,
    AlarmSummary
} from '../../types/alarm';
import type { FindingsListParams } from '../alarmsKeys';

/** Body of a rule create. */
export type CreateAlarmRuleInput = {
    contentType: string;
    name: string;
    findingTitle: string;
    description?: string;
    severity: AlarmSeverity;
    filter: Record<string, unknown>;
    enabled?: boolean;
};

/** Body of a rule update — every field optional, PATCH semantics. */
export type UpdateAlarmRuleInput = Partial<
    Omit<CreateAlarmRuleInput, 'contentType'>
>;

/**
 * The transport port the presentation layer depends on.
 *
 * An interface rather than the axios calls directly, so a component never
 * imports `apiClient` and the whole surface is stubbable in one object for a
 * test or a story.
 */
export type AlarmsGateway = {
    /** Every rule in the open workspace, with live counts. */
    listRules(): Promise<AlarmRule[]>;
    /** Creates a rule; the server scans the collection before answering. */
    createRule(
        input: CreateAlarmRuleInput
    ): Promise<{ rule: AlarmRule; scan: AlarmScanResult }>;
    /** Applies a partial update; a changed filter is rescanned server-side. */
    updateRule(id: string, input: UpdateAlarmRuleInput): Promise<AlarmRule>;
    /** Deletes a rule and, with it, its findings. */
    deleteRule(id: string): Promise<void>;
    /** Re-runs one rule over its whole collection. */
    rescanRule(id: string): Promise<AlarmScanResult>;
    /** How many entries a candidate filter matches, without saving it. */
    previewRule(
        contentType: string,
        filter: Record<string, unknown>
    ): Promise<AlarmRulePreview>;
    /** One page of the workspace's findings. */
    listFindings(params: FindingsListParams): Promise<AlarmFindingList>;
    /** Live findings for a batch of entries, keyed by entry id. */
    findingsByEntry(
        entryIds: readonly string[]
    ): Promise<Record<string, AlarmFinding[]>>;
    /** Open counts for the workspace. */
    summary(): Promise<AlarmSummary>;
    /** Silences one finding. */
};
