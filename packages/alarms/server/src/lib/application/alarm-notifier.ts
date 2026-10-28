import { Inject, Injectable, Optional } from '@nestjs/common';
import {
    InjectContentRegistry,
    type ContentTypeRegistry
} from '@orthacms/content-server';
import {
    INBOX_KINDS,
    INBOX_WRITER,
    type InboxWriter
} from '@orthacms/inbox-domain';
import type { AlarmRuleRecord } from '../infrastructure/alarm-rule.repository';

/**
 * Puts "Alarm “Author is not published” flagged 3 records" in the inbox of the
 * person who made the alarm, when a scan opens new findings on it
 * (ADR-0023).
 *
 * **Errors and warnings only.** `info` is an alarm saying something without
 * asking anybody to act; an inbox item is exactly that ask. **The creator
 * only**: an alarm is somebody's decision to keep watching, and they are the
 * one who asked to be told — the rest of the workspace sees the count in the
 * navigation. **New findings only**: a finding that was already open is not
 * news, which is what `ReconcileResult.opened` already counts.
 *
 * The writer is optional — without the inbox plugin nothing is bound and this
 * is a no-op — and a failure here must never fail the scan that called it.
 */
@Injectable()
export class AlarmNotifier {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        @Optional()
        @Inject(INBOX_WRITER)
        private readonly inbox?: InboxWriter
    ) {}

    async flagged(rule: AlarmRuleRecord, opened: number): Promise<void> {
        if (!this.inbox || opened <= 0 || !rule.createdBy) return;
        if (rule.severity === 'info') return;
        await this.inbox.deliver([
            {
                kind: INBOX_KINDS.ALARM_FLAGGED,
                userId: rule.createdBy,
                workspaceId: rule.workspaceId,
                payload: {
                    ruleId: rule.id,
                    ruleName: rule.name,
                    severity: rule.severity,
                    contentType: rule.contentType,
                    contentTypeLabel:
                        this.registry.get(rule.contentType)?.label ??
                        rule.contentType,
                    newCount: opened
                },
                link: `workspaces/${rule.workspaceId}/alarms`,
                // Every scan that opens findings is its own news; a retried
                // event re-reconciles to `opened: 0` and never reaches here.
                dedupeKey: `alarm.flagged:${rule.id}:${globalThis.crypto.randomUUID()}`
            }
        ]);
    }
}
