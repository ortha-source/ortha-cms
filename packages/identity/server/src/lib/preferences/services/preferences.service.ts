import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@orthacms/database';
import { userPreferences } from '../../schema';
import type { UpdatePreferencesDto } from '../dto/update-preferences.dto';
import { MAX_STORED_PANELS } from '../dto/panel-layout.validator';

/** A user's appearance preferences as exposed over the wire (no `userId`). */
export type UserPreferences = Pick<
    typeof userPreferences.$inferSelect,
    'theme' | 'layout'
>;

/**
 * The defaults a brand-new user renders with before they have ever saved a
 * preference (no row exists yet). Kept in sync with the schema column default
 * so `get` can synthesise a response without writing a row on read.
 *
 * Frozen, and always returned via {@link defaultPreferences} rather than by
 * reference: it is process-wide shared state, so handing the same object to
 * every user would let one mutation downstream redefine the default for all of
 * them.
 */
export const DEFAULT_PREFERENCES: Readonly<UserPreferences> = Object.freeze({
    theme: 'system',
    layout: Object.freeze({})
});

/** A fresh copy of {@link DEFAULT_PREFERENCES}, safe to hand to one caller. */
function defaultPreferences(): UserPreferences {
    return { theme: DEFAULT_PREFERENCES.theme, layout: {} };
}

/** The columns projected into a {@link UserPreferences} response. */
const PREFERENCE_COLUMNS = {
    theme: userPreferences.theme,
    layout: userPreferences.layout
} as const;

/**
 * Reads and writes the current user's appearance preferences. A thin service
 * over the single `user_preferences` row a user owns: `get` returns the stored
 * row or a copy of {@link DEFAULT_PREFERENCES} when none exists yet, and
 * `save` upserts a partial patch, creating the row on first write.
 */
@Injectable()
export class PreferencesService {
    constructor(@InjectDatabase() private readonly db: Database) {}

    /** The user's stored preferences, or the defaults if they have none yet. */
    async get(userId: string): Promise<UserPreferences> {
        const [row] = await this.db
            .select(PREFERENCE_COLUMNS)
            .from(userPreferences)
            .where(eq(userPreferences.userId, userId));
        return row ?? defaultPreferences();
    }

    /**
     * Upserts a partial patch and returns the stored preferences. One statement
     * — the insert seeds the row on first save, and on conflict it updates only
     * what the patch names. No check-then-write race.
     *
     * `layout` is **merged per panel** in SQL (`layout || patch`): a panel the
     * patch names replaces its stored entry, every other panel keeps its own.
     * Two tabs resizing different panels therefore cannot undo each other, which
     * a read-modify-write in the admin could. The merged map is bounded in the
     * same statement — the update's `WHERE` refuses a merge that would hold more
     * than {@link MAX_STORED_PANELS} panels, so the row cannot be grown without
     * limit one save at a time; refused, it returns no row and the caller gets a
     * 422.
     */
    async save(
        userId: string,
        patch: UpdatePreferencesDto
    ): Promise<UserPreferences> {
        const layoutPatch = patch.layout ?? {};
        // Qualified by hand: inside `ON CONFLICT DO UPDATE` a bare `layout`
        // is ambiguous with `excluded.layout`.
        const merged = sql`${sql.identifier('user_preferences')}.${sql.identifier('layout')} || ${JSON.stringify(layoutPatch)}::jsonb`;

        const [row] = await this.db
            .insert(userPreferences)
            .values({
                userId,
                ...(patch.theme ? { theme: patch.theme } : {}),
                layout: layoutPatch
            })
            .onConflictDoUpdate({
                target: userPreferences.userId,
                set: {
                    ...(patch.theme ? { theme: patch.theme } : {}),
                    ...(patch.layout ? { layout: merged } : {}),
                    updatedAt: new Date()
                },
                setWhere: sql`(select count(*) from jsonb_object_keys(${merged})) <= ${MAX_STORED_PANELS}`
            })
            .returning(PREFERENCE_COLUMNS);

        if (!row) {
            throw new UnprocessableEntityException(
                `At most ${MAX_STORED_PANELS} panel layouts can be stored.`
            );
        }
        return row;
    }
}
