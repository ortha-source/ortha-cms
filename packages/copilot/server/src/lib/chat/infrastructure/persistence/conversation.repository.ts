import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import type { ModelContentBlock } from '@ortha-cms/copilot-domain';
import { copilotConversations } from '../schema/conversations';
import { copilotMessages } from '../schema/messages';
import { copilotToolCalls } from '../schema/tool-calls';
import { deriveTitle } from './derive-title';

/** A thread as the list and the transcript render it. */
export interface ConversationView {
    id: string;
    title: string | null;
    surface: string;
    archived: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/** One persisted turn. */
export interface MessageView {
    id: string;
    runId: string;
    role: 'user' | 'assistant';
    content: ModelContentBlock[];
    model: string | null;
    provider: string | null;
    stopReason: string | null;
    position: number;
    createdAt: Date;
}

/** What {@link ConversationRepository.recordToolCall} writes. */
export interface ToolCallRecord {
    conversationId: string;
    runId: string;
    callId: string;
    name: string;
    input: unknown;
    outputSummary: string | null;
    ok: boolean;
    error: string | null;
    durationMs: number;
}

/**
 * Reads and writes the copilot's transcript.
 *
 * **Every method takes the owning `userId` and `workspaceId` and filters on
 * both.** Not defence in depth for its own sake: `WorkspaceGuard` proves the
 * caller belongs to the workspace they named, but nothing upstream proves a
 * *conversation id* belongs to that user or that workspace — that check has to
 * live here, or a valid session could pull another member's thread by id.
 */
@Injectable()
export class ConversationRepository {
    constructor(@InjectDatabase() private readonly db: Database) {}

    /**
     * This user's threads in this workspace, most recently used first.
     *
     * `archived` selects **one of two disjoint sets** rather than widening the
     * result: archiving means "hide this from the list", so an archived thread
     * appearing beside its active siblings would defeat the flag entirely.
     */
    async list(
        userId: string,
        workspaceId: string,
        archived = false
    ): Promise<ConversationView[]> {
        return this.db
            .select({
                id: copilotConversations.id,
                title: copilotConversations.title,
                surface: copilotConversations.surface,
                archived: copilotConversations.archived,
                createdAt: copilotConversations.createdAt,
                updatedAt: copilotConversations.updatedAt
            })
            .from(copilotConversations)
            .where(
                and(
                    eq(copilotConversations.userId, userId),
                    eq(copilotConversations.workspaceId, workspaceId),
                    eq(copilotConversations.archived, archived)
                )
            )
            .orderBy(desc(copilotConversations.updatedAt));
    }

    /**
     * Renames a thread and/or files it away, returning the updated row — or
     * `null` when the id is not this user's in this workspace.
     *
     * **`updatedAt` is deliberately not touched.** It means "last used", and the
     * list sorts by it: bumping it here would send a thread you merely renamed
     * to the top of the rail, above conversations you actually had since.
     *
     * The ownership predicate is part of the `UPDATE` rather than a read
     * beforehand, so there is no window between checking and writing — and a
     * miss is reported as `null` for "not yours" and "no such id" alike, so an
     * id cannot be probed for existence.
     */
    async update(
        conversationId: string,
        userId: string,
        workspaceId: string,
        patch: { title?: string; archived?: boolean }
    ): Promise<ConversationView | null> {
        const [row] = await this.db
            .update(copilotConversations)
            .set({
                ...(patch.title !== undefined ? { title: patch.title } : {}),
                ...(patch.archived !== undefined
                    ? { archived: patch.archived }
                    : {})
            })
            .where(
                and(
                    eq(copilotConversations.id, conversationId),
                    eq(copilotConversations.userId, userId),
                    eq(copilotConversations.workspaceId, workspaceId)
                )
            )
            .returning({
                id: copilotConversations.id,
                title: copilotConversations.title,
                surface: copilotConversations.surface,
                archived: copilotConversations.archived,
                createdAt: copilotConversations.createdAt,
                updatedAt: copilotConversations.updatedAt
            });
        return row ?? null;
    }

    /**
     * A thread the caller owns, or `null`. Returns null rather than throwing
     * for "not yours" as well as "no such id" — the two are indistinguishable
     * to a caller, so an id can't be probed for existence.
     */
    async find(
        conversationId: string,
        userId: string,
        workspaceId: string
    ): Promise<ConversationView | null> {
        const [row] = await this.db
            .select({
                id: copilotConversations.id,
                title: copilotConversations.title,
                surface: copilotConversations.surface,
                archived: copilotConversations.archived,
                createdAt: copilotConversations.createdAt,
                updatedAt: copilotConversations.updatedAt
            })
            .from(copilotConversations)
            .where(
                and(
                    eq(copilotConversations.id, conversationId),
                    eq(copilotConversations.userId, userId),
                    eq(copilotConversations.workspaceId, workspaceId)
                )
            )
            .limit(1);
        return row ?? null;
    }

    /** Like {@link find}, but 404s — for routes that need the thread present. */
    async findOrFail(
        conversationId: string,
        userId: string,
        workspaceId: string
    ): Promise<ConversationView> {
        const found = await this.find(conversationId, userId, workspaceId);
        if (!found) {
            throw new NotFoundException('Conversation not found.');
        }
        return found;
    }

    /**
     * Tool names this thread has been told to stop asking about.
     *
     * Read **per run**, never cached, for the same reason the capability
     * profile is: the list can grow mid-thread (the user answers "allow for
     * this chat" on turn three), and a run holding a snapshot from turn one
     * would ask again for something already answered.
     */
    async allowedTools(conversationId: string): Promise<string[]> {
        const [row] = await this.db
            .select({ allowedTools: copilotConversations.allowedTools })
            .from(copilotConversations)
            .where(eq(copilotConversations.id, conversationId))
            .limit(1);
        return row?.allowedTools ?? [];
    }

    /**
     * Adds a tool to this thread's allow list.
     *
     * The append happens **in the database**, not by reading and writing back:
     * two calls in one turn can both be answered "allow for this chat" while
     * the run is parked, and a read-modify-write would lose one of them.
     */
    async allowTool(conversationId: string, toolName: string): Promise<void> {
        await this.db
            .update(copilotConversations)
            .set({
                allowedTools: sql`(
                    select coalesce(jsonb_agg(distinct value), '[]'::jsonb)
                    from jsonb_array_elements(
                        ${copilotConversations.allowedTools} || ${JSON.stringify([toolName])}::jsonb
                    ) as value
                )`
            })
            .where(eq(copilotConversations.id, conversationId));
    }

    /** Starts a thread owned by `userId` in `workspaceId`. */
    async create(
        userId: string,
        workspaceId: string,
        surface: string,
        firstMessage: string
    ): Promise<ConversationView> {
        const [row] = await this.db
            .insert(copilotConversations)
            .values({
                userId,
                workspaceId,
                surface,
                title: deriveTitle(firstMessage)
            })
            .returning();
        return row;
    }

    /** One thread's turns, in transcript order. */
    async messages(conversationId: string): Promise<MessageView[]> {
        return this.db
            .select({
                id: copilotMessages.id,
                runId: copilotMessages.runId,
                role: copilotMessages.role,
                content: copilotMessages.content,
                model: copilotMessages.model,
                provider: copilotMessages.provider,
                stopReason: copilotMessages.stopReason,
                position: copilotMessages.position,
                createdAt: copilotMessages.createdAt
            })
            .from(copilotMessages)
            .where(eq(copilotMessages.conversationId, conversationId))
            .orderBy(asc(copilotMessages.position));
    }

    /**
     * Appends a turn and bumps the thread's `updatedAt`.
     *
     * The position comes from `max(position) + 1` **computed in SQL**, inside
     * the same statement as the insert, rather than read into JS and written
     * back. Two runs in one thread can overlap (a second question asked while
     * the first is still streaming), and a read-then-write would hand both the
     * same position.
     */
    async appendMessage(input: {
        conversationId: string;
        runId: string;
        role: 'user' | 'assistant';
        content: ModelContentBlock[];
        model?: string | null;
        provider?: string | null;
        stopReason?: string | null;
        inputTokens?: number | null;
        outputTokens?: number | null;
    }): Promise<{ id: string; position: number }> {
        const nextPosition = sql<number>`(
            select coalesce(max(${copilotMessages.position}), 0) + 1
            from ${copilotMessages}
            where ${copilotMessages.conversationId} = ${input.conversationId}
        )`;

        const [row] = await this.db
            .insert(copilotMessages)
            .values({
                conversationId: input.conversationId,
                runId: input.runId,
                role: input.role,
                content: input.content,
                model: input.model ?? null,
                provider: input.provider ?? null,
                stopReason: input.stopReason ?? null,
                inputTokens: input.inputTokens ?? null,
                outputTokens: input.outputTokens ?? null,
                position: nextPosition
            })
            .returning({
                id: copilotMessages.id,
                position: copilotMessages.position
            });

        await this.db
            .update(copilotConversations)
            .set({ updatedAt: new Date() })
            .where(eq(copilotConversations.id, input.conversationId));

        return row;
    }

    /** Writes the audit row for one attempted tool call. */
    async recordToolCall(record: ToolCallRecord): Promise<void> {
        await this.db.insert(copilotToolCalls).values(record);
    }

    /** One run's tool calls, oldest first — the UI's step list. */
    async toolCalls(runId: string) {
        return this.db
            .select()
            .from(copilotToolCalls)
            .where(eq(copilotToolCalls.runId, runId))
            .orderBy(asc(copilotToolCalls.createdAt));
    }
}
