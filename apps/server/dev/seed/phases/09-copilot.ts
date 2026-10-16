/**
 * Copilot history: conversations from several surfaces, an archived one, a
 * failed tool call, proposals in every status, and skills in every mode.
 *
 * The host always registers the copilot plugin, so this is seeded either way;
 * the admin shows it once `COPILOT_ENABLED=true` and a provider is configured.
 * "Working" and "waiting for you" are not seeded: they are live-run state held
 * in memory and in the browser, never stored.
 *
 * Conversations and messages go through `ConversationRepository`, which is
 * what the run engine itself writes with. Proposals are inserted directly: they
 * are only ever decided inside a live run, and there is no route to do it.
 */
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
    ConversationRepository,
    SkillRepository
} from '@orthacms/copilot-server';
import { copilotConversations } from '../../../../../packages/copilot/server/src/lib/chat/infrastructure/schema/conversations';
import { copilotProposals } from '../../../../../packages/copilot/server/src/lib/chat/infrastructure/schema/proposals';
import type { SeedContext } from '../context';

const text = (value: string) => [{ type: 'text' as const, text: value }];

export async function seedCopilot(ctx: SeedContext): Promise<void> {
    let conversations: ConversationRepository;
    let skills: SkillRepository;
    try {
        conversations = ctx.get(ConversationRepository);
        skills = ctx.get(SkillRepository);
    } catch {
        ctx.section('Copilot', [
            'Skipped: the copilot plugin is not registered in `src/plugins.ts`.'
        ]);
        return;
    }
    const main = ctx.workspace('main').id;
    const admin = ctx.user('admin');

    const chat = async (
        as: string,
        surface: string,
        question: string,
        answer: string
    ) => {
        const conversation = await conversations.create(
            ctx.user(as).id,
            main,
            surface,
            question
        );
        const runId = randomUUID();
        await conversations.appendMessage({
            conversationId: conversation.id,
            runId,
            role: 'user',
            content: text(question)
        });
        await conversations.appendMessage({
            conversationId: conversation.id,
            runId,
            role: 'assistant',
            content: text(answer),
            model: 'seeded',
            provider: 'seed',
            stopReason: 'end_turn',
            inputTokens: 120,
            outputTokens: 48
        });
        return { id: conversation.id, runId };
    };

    await chat(
        'admin',
        'chat',
        'What content types does this workspace have?',
        'Main has 28 types: field_*, rel_*, flags_*, i18n_*, scenario_* and two singles.'
    );
    await chat(
        'admin',
        'palette',
        'Find drafts in flags_publishable',
        'There are several drafts; the "Drafts" saved view lists them.'
    );
    await chat(
        'editor',
        'entry',
        'Summarise this entry',
        'It is a published entry with an unpublished edit (Modified).'
    );

    const archived = await chat(
        'admin',
        'chat',
        'An old question',
        'An old answer — this conversation is archived.'
    );
    await ctx.db
        .update(copilotConversations)
        .set({ archived: true })
        .where(eq(copilotConversations.id, archived.id));

    const failed = await chat(
        'admin',
        'records',
        'Search media for a logo',
        'The search failed; see the tool call.'
    );
    await conversations.recordToolCall({
        conversationId: failed.id,
        runId: failed.runId,
        callId: 'seed-call-1',
        name: 'media_assets_search',
        input: { search: 'logo' },
        outputSummary: null,
        ok: false,
        error: 'Seeded failure: the storage provider did not answer.',
        durationMs: 1840
    });
    await conversations.allowTool(failed.id, 'media_assets_search');

    const proposing = await chat(
        'admin',
        'create',
        'Retitle three drafts',
        'I proposed three changes; one was accepted, one rejected, one is waiting.'
    );
    const proposal = (
        status: 'pending' | 'accepted' | 'rejected',
        entryKey: string,
        title: string
    ) => {
        const entry = ctx.entry(entryKey);
        return {
            conversationId: proposing.id,
            runId: proposing.runId,
            toolCallId: `seed-${status}`,
            toolName: 'content_propose_update',
            kind: 'content.entry.update',
            workspaceId: main,
            createdBy: admin.id,
            target: { typeName: entry.type, entryId: entry.id },
            patch: { values: { title } },
            summary: `Retitle to "${title}"`,
            status,
            ...(status === 'pending'
                ? {}
                : { decidedBy: admin.id, decidedAt: new Date() })
        };
    };
    await ctx.db
        .insert(copilotProposals)
        .values([
            proposal(
                'pending',
                'flags_pub_draft',
                'Draft — retitled by the copilot (pending)'
            ),
            proposal(
                'accepted',
                'flags_pub_published',
                'Published (accepted proposal)'
            ),
            proposal('rejected', 'flags_pub_incomplete', 'Rejected title')
        ]);

    const skill = (
        name: string,
        title: string,
        mode: 'manual' | 'always',
        enabled: boolean
    ) =>
        skills.create({
            workspaceId: main,
            name,
            title,
            description: `Seeded ${mode} skill${enabled ? '' : ' (disabled)'}.`,
            instructions: `When asked, ${title.toLowerCase()}. Keep answers short.`,
            mode,
            enabled,
            createdBy: admin.id
        } as Parameters<SkillRepository['create']>[0]);
    await skill('house-style', 'Follow the house style', 'always', true);
    await skill('translate-de', 'Translate into German', 'manual', true);
    await skill('legacy-tone', 'Use the old tone of voice', 'manual', false);

    ctx.section('Copilot (Main)', [
        'Conversations from the chat, palette, entry, records and create surfaces; one archived; one with a failed tool call;',
        'one with a pending, an accepted and a rejected proposal. Skills: `house-style` (always), `translate-de` (manual), `legacy-tone` (disabled).',
        'Visible once `COPILOT_ENABLED=true` and a provider is configured.'
    ]);
}
