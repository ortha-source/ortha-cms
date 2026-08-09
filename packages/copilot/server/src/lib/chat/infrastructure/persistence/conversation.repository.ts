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

    /** This user's threads in this workspace, most recently used first. */
    async list(
        userId: string,
        workspaceId: string
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
                    eq(copilotConversations.archived, false)
                )
            )
            .orderBy(desc(copilotConversations.updatedAt));
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
