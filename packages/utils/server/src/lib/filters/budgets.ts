/**
 * Every ceiling the filter engine imposes, in one place.
 *
 * The engine's job is to accept a tree a stranger wrote. What stops that tree
 * from being unbounded work is this file — nothing else. Four of these budgets
 * count *structure* (how many rules, how deep, how long an `IN` list); the
 * fifth counts *text*, and it was missing.
 *
 * ## What the DTO cap covers, and what it does not
 *
 * {@link FILTER_MAX_LENGTH} is the cap a caller's DTO puts on the whole
 * serialised filter — `@MaxLength(FILTER_MAX_LENGTH)` on `?filter=`. It lives
 * here rather than in each plugin because it was declared separately in four of
 * them and one copy had drifted to 8192, so "the filter cap" meant two numbers
 * depending on which endpoint you asked.
 *
 * It is a **transport** guard, and it only guards the paths where the filter
 * arrives as a string. It does not reach:
 *
 * - **Alarm rules.** `CreateAlarmRuleDto.filter` is an already-parsed object
 *   (`@IsObject()`), because the authority on a filter tree's shape is this
 *   parser rather than a second copy of the grammar in decorators. `@MaxLength`
 *   is a string decorator and could not be applied to it.
 * - **A stored alarm rule replayed from its `jsonb` column** — by the outbox
 *   subscriber, the periodic sweep, or `POST /rules/:id/rescan`. Nothing
 *   re-serialises it on the way out of the database, so there is no string to
 *   measure.
 * - **The copilot's `admin_content_search` tool.** Its `filter` argument is an
 *   object too, and the registry's input check deliberately ignores `anyOf`, so
 *   the tree's contents reach the parser unexamined.
 * - **GraphQL's entry loader**, which builds an id-`in` tree in code and casts
 *   past the DTO.
 *
 * On those four paths the parser *is* the boundary. That is why
 * {@link DEFAULT_MAX_VALUE_LENGTH} exists: a budget declared on the DTO
 * protects the endpoints that happen to have one, and a budget declared here
 * protects every caller there will ever be.
 */

/**
 * Max length of a serialised filter payload, for the `@MaxLength` a caller
 * puts on its own `?filter=` / `filter` DTO field.
 *
 * A coarse first latch ahead of the engine's own budgets: it refuses an
 * oversized payload before `JSON.parse` sees it. It is deliberately generous —
 * roughly a hundred UUID clauses — because it is not the real bound; the node,
 * depth, list and value budgets below are.
 *
 * **The one number, and every DTO imports it from here.** `activity`,
 * `content` and `users` each declared their own `4096` and `alarms` a `8192`
 * that was applied to nothing at all; four declarations of one rule is three
 * chances to answer a caller differently on two endpoints for the same filter.
 */
export const FILTER_MAX_LENGTH = 4096;

/** Default `schema.maxDepth` — how many dotted relation hops a path may walk. */
export const DEFAULT_MAX_DEPTH = 3;

/** Default `schema.maxNodes` — how many groups + rules one tree may hold. */
export const DEFAULT_MAX_NODES = 50;

/** Default `schema.maxGroupDepth` — how deep `and`/`or` nesting may go. */
export const DEFAULT_MAX_GROUP_DEPTH = 5;

/** Default `schema.maxInListLength` — how many values one `in`/`nin` may name. */
export const DEFAULT_MAX_IN_LIST = 100;

/**
 * Default `schema.maxValueLength` — how long one clause's **string** value may
 * be, applied to each element of an `in` list as well as to a bare scalar.
 *
 * The number is {@link FILTER_MAX_LENGTH} on purpose, and the equality is the
 * argument for it: a filter that arrives as a string is already capped at that
 * length in total, so no value inside one can be longer. This budget therefore
 * cannot refuse anything an HTTP caller could already send — it exists for the
 * paths listed at the top of this file, which never meet the DTO at all, and
 * where the alternative bound was the 1 MB body limit.
 *
 * What it stops is a single arbitrarily long `LIKE` pattern: `~~` is scanned
 * against every candidate row, so the cost of one clause is the pattern's
 * length times the table's, and nothing above the parser was measuring the
 * first factor.
 */
export const DEFAULT_MAX_VALUE_LENGTH = FILTER_MAX_LENGTH;
