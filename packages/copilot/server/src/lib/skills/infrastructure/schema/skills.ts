import {
    boolean,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid
} from 'drizzle-orm/pg-core';
import {
    users,
    workspaces
} from '../../../chat/infrastructure/schema/external-refs';

/** Whether a skill applies to every run or only when someone attaches it. */
export const copilotSkillMode = pgEnum('copilot_skill_mode', [
    'manual',
    'always'
]);

/**
 * One CMS-authored skill — a reusable instruction packet the copilot can run
 * with, scoped to the workspace it was written in.
 *
 * **Workspace-scoped, not deployment-wide.** A skill is editorial guidance
 * about a particular body of content, which is exactly what a workspace
 * bounds; the deployment-wide case is served by the host's code-defined skills,
 * which are reviewed in git and identical everywhere. That split also keeps the
 * blast radius of the write permission inside one workspace.
 *
 * `instructions` is **prompt text, not content**. Writing here is authoring
 * part of the system prompt for everyone in the workspace, which is why the
 * write routes require `copilot:skills:manage` (admin-only) rather than a
 * content permission — see ADR-0010.
 */
export const copilotSkills = pgTable(
    'copilot_skills',
    {
        /** Primary key. */
        id: uuid('id').primaryKey().defaultRandom(),
        /** The workspace this skill belongs to. */
        workspaceId: uuid('workspace_id')
            .notNull()
            .references(() => workspaces.id, { onDelete: 'cascade' }),
        /**
         * Machine name, unique within the workspace and refused if a
         * code-defined skill already holds it. What a run request names.
         */
        name: text('name').notNull(),
        /** What a person reads in the picker and on a chip. */
        title: text('title').notNull(),
        /**
         * When to use it, written for the model. In the prompt for **every**
         * enabled skill in the workspace, whether or not it is in force — which
         * is what lets the model recommend one it has not been given.
         */
        description: text('description').notNull(),
        /** The body. Reaches the model only when the skill is in force. */
        instructions: text('instructions').notNull(),
        /** `always` puts it in force on every run in this workspace. */
        mode: copilotSkillMode('mode').notNull().default('manual'),
        /**
         * Off without deleting. A disabled skill is absent from the catalogue
         * rather than greyed out in it: the picker's job is to show what can be
         * used, and the manage page reads the disabled ones separately.
         */
        enabled: boolean('enabled').notNull().default(true),
        /**
         * Who wrote it — attribution only. `set null` rather than `cascade`,
         * unlike the conversation tables: a thread is personal and goes with
         * its owner, while a skill is workspace configuration that must survive
         * the admin who happened to type it.
         */
        createdBy: uuid('created_by').references(() => users.id, {
            onDelete: 'set null'
        }),
        /** Row creation timestamp. */
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        /** Last edit. Bumped on every write, unlike a conversation's. */
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [
        // The uniqueness the resolver depends on: a run names a skill by
        // `name`, so two rows sharing one in a workspace would make which
        // instructions the model receives a matter of row order.
        uniqueIndex('copilot_skills_workspace_name_idx').on(
            table.workspaceId,
            table.name
        )
    ]
);
