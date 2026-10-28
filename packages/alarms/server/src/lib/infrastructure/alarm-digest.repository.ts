import { Injectable } from '@nestjs/common';
import { and, desc, eq, exists, inArray, isNotNull, sql } from 'drizzle-orm';
import { UnitOfWork } from '@orthacms/database';
import { users } from '@orthacms/identity-server';
import { memberships, workspaces } from '@orthacms/workspaces-server';
import { alarmFindings } from './schema/alarm-findings';
import { alarmRules } from './schema/alarm-rules';
import { alarmDigestRuns, alarmDigestSettings } from './schema/alarm-digest';

/** How often somebody hears from their alarms by mail. */
export type DigestFrequency = 'daily' | 'weekly' | 'off';

/** Somebody a digest could go to: an active person who made an alarm. */
export interface DigestRecipient {
    userId: string;
    email: string;
    name: string | null;
    frequency: DigestFrequency;
}

/** One alarm's line, before it is labelled. */
export interface DigestLineRow {
    ruleId: string;
    ruleName: string;
    severity: 'error' | 'warn';
    contentType: string;
    workspaceId: string;
    workspaceName: string;
    newCount: number;
    openCount: number;
}

function frequencyOf(value: string | null | undefined): DigestFrequency {
    return value === 'weekly' || value === 'off' ? value : 'daily';
}

/** The alarms a digest reports on: enabled, and loud enough to mail about. */
const DIGESTED = and(
    eq(alarmRules.enabled, true),
    inArray(alarmRules.severity, ['error', 'warn'])
);

/**
 * The digest's storage: who may receive one, what is new for them, the
 * per-period claim, and each person's frequency.
 *
 * Everything runs on `UnitOfWork.current()`, so the claim, the reads and the
 * queued message share the digest's one transaction: a message that fails to
 * queue un-claims its period, and the next tick tries again.
 */
@Injectable()
export class AlarmDigestRepository {
    constructor(private readonly uow: UnitOfWork) {}

    private get exec() {
        return this.uow.current();
    }

    async frequency(userId: string): Promise<DigestFrequency> {
        const [row] = await this.exec
            .select({ frequency: alarmDigestSettings.frequency })
            .from(alarmDigestSettings)
            .where(eq(alarmDigestSettings.userId, userId))
            .limit(1);
        return frequencyOf(row?.frequency);
    }

    async setFrequency(
        userId: string,
        frequency: DigestFrequency
    ): Promise<void> {
        await this.exec
            .insert(alarmDigestSettings)
            .values({ userId, frequency })
            .onConflictDoUpdate({
                target: alarmDigestSettings.userId,
                set: { frequency, updatedAt: new Date() }
            });
    }

    /**
     * Active people who made at least one digested alarm, with their
     * frequency. A person who left every workspace still appears here and is
     * simply sent nothing — the lines below read membership.
     */
    async recipients(): Promise<DigestRecipient[]> {
        const rows = await this.exec
            .selectDistinct({
                userId: users.id,
                email: users.email,
                name: users.name,
                frequency: alarmDigestSettings.frequency
            })
            .from(alarmRules)
            .innerJoin(users, eq(users.id, alarmRules.createdBy))
            .leftJoin(
                alarmDigestSettings,
                eq(alarmDigestSettings.userId, users.id)
            )
            .where(
                and(
                    DIGESTED,
                    isNotNull(alarmRules.createdBy),
                    eq(users.status, 'active')
                )
            );
        return rows.map((row) => ({
            userId: row.userId,
            email: row.email,
            name: row.name,
            frequency: frequencyOf(row.frequency)
        }));
    }

    /**
     * Each of the person's digested alarms that opened findings since `since`,
     * in workspaces they still belong to — with the count new and the count
     * open now.
     */
    async lines(userId: string, since: Date): Promise<DigestLineRow[]> {
        const newCount = sql<number>`count(*) filter (where ${alarmFindings.state} = 'open' and ${alarmFindings.firstSeenAt} > ${since})`;
        const openCount = sql<number>`count(*) filter (where ${alarmFindings.state} = 'open')`;
        const rows = await this.exec
            .select({
                ruleId: alarmRules.id,
                ruleName: alarmRules.name,
                severity: alarmRules.severity,
                contentType: alarmRules.contentType,
                workspaceId: alarmRules.workspaceId,
                workspaceName: workspaces.name,
                newCount,
                openCount
            })
            .from(alarmRules)
            .innerJoin(alarmFindings, eq(alarmFindings.ruleId, alarmRules.id))
            .innerJoin(workspaces, eq(workspaces.id, alarmRules.workspaceId))
            .where(
                and(
                    DIGESTED,
                    eq(alarmRules.createdBy, userId),
                    exists(
                        this.exec
                            .select({ one: sql`1` })
                            .from(memberships)
                            .where(
                                and(
                                    eq(memberships.userId, userId),
                                    eq(
                                        memberships.workspaceId,
                                        alarmRules.workspaceId
                                    )
                                )
                            )
                    )
                )
            )
            .groupBy(
                alarmRules.id,
                alarmRules.name,
                alarmRules.severity,
                alarmRules.contentType,
                alarmRules.workspaceId,
                workspaces.name
            )
            .having(sql`${newCount} > 0`);
        return rows.map((row) => ({
            ...row,
            severity: row.severity === 'error' ? 'error' : 'warn',
            newCount: Number(row.newCount),
            openCount: Number(row.openCount)
        }));
    }

    /** When the person's previous digest period was claimed, if ever. */
    async lastRunAt(userId: string): Promise<Date | null> {
        const [row] = await this.exec
            .select({ createdAt: alarmDigestRuns.createdAt })
            .from(alarmDigestRuns)
            .where(eq(alarmDigestRuns.userId, userId))
            .orderBy(desc(alarmDigestRuns.createdAt))
            .limit(1);
        return row?.createdAt ?? null;
    }

    /** Claims one period for one person; `false` when it was already taken. */
    async claim(userId: string, periodKey: string): Promise<boolean> {
        const inserted = await this.exec
            .insert(alarmDigestRuns)
            .values({ userId, periodKey })
            .onConflictDoNothing()
            .returning({ userId: alarmDigestRuns.userId });
        return inserted.length > 0;
    }
}
