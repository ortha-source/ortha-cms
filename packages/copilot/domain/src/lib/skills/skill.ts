/**
 * How a skill enters a run.
 *
 * `manual` is the ordinary case: the person picks it in the composer for the
 * turn they are about to send. `always` is house style — the skill is in force
 * for every run in its workspace and nobody has to remember it.
 *
 * There is deliberately no third mode for "the model decides". Every channel a
 * skill can arrive through is one a human either configured or clicked, which
 * is what makes "why did it answer like that?" answerable from the transcript.
 */
export type SkillMode = 'manual' | 'always';

/**
 * Where a skill's definition comes from.
 *
 * `code` is declared by the host in `plugins.ts`, reviewed as code and shipped
 * with a deploy; `cms` is a row an admin authored in the admin UI. Derived
 * rather than stored on the code side, and **never** editable — the badge in
 * the picker and the read-only form both key off it.
 */
export type SkillSource = 'code' | 'cms';

/**
 * A reusable instruction packet the copilot can run with.
 *
 * The split that matters is {@link description} against {@link instructions}.
 * The description is short and appears in the system prompt for **every**
 * enabled skill in the workspace, so the model knows what exists and can
 * recommend one; the body is long and reaches the model only when the skill is
 * actually in force. That is the same trade the prompt already makes with
 * content-type summaries against full field schemas — bounded cost up front,
 * detail on the runs that need it.
 */
export interface Skill {
    /** Machine name, unique per workspace. What a run refers to. */
    name: string;
    /** What a person reads in the picker and on a chip. */
    title: string;
    /** When to use it, written for the model. Always in the prompt. */
    description: string;
    /** The body. Reaches the model only when the skill is in force. */
    instructions: string;
    /** Whether it applies to every run, or only when attached. */
    mode: SkillMode;
    /** Where it was defined. Derived, never authored. */
    source: SkillSource;
}

/**
 * What the host declares in `plugins.ts`. The same shape as a {@link Skill}
 * minus the parts the host does not get to assert: `source` is always `code`
 * here, and `mode` defaults to `manual`.
 */
export interface SkillDefinition {
    /** Machine name — see {@link SKILL_NAME_PATTERN}. */
    name: string;
    /** What a person reads in the picker. */
    title: string;
    /** When to use it, written for the model. */
    description: string;
    /** The body, usually read from a `.md` file next to the config. */
    instructions: string;
    /** Defaults to `manual`. */
    mode?: SkillMode;
}

/**
 * A skill as a transcript records it — a **snapshot**, taken when the turn ran.
 *
 * Name, title and source rather than a foreign key, for the reason every audit
 * row here holds a copy: a skill can be renamed or deleted, and a thread read
 * six months later still has to be able to say what shaped the answer. The body
 * is not snapshotted — see the note in `docs/design/copilot.md`; versioning a
 * skill is a separate feature and this is not a half-built version of it.
 */
export interface SkillRef {
    /** The skill's machine name at the time of the turn. */
    name: string;
    /** Its title at the time of the turn. */
    title: string;
    /** Where it was defined at the time of the turn. */
    source: SkillSource;
}

/**
 * Slug shape for a skill name: lowercase alphanumerics in hyphen-separated
 * words. Narrow on purpose — the name appears in a run request, in the prompt's
 * skill list, and in the transcript, and a name carrying whitespace or markup
 * would need escaping in three places instead of being unable to occur.
 */
export const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Longest skill name. */
export const MAX_SKILL_NAME_LENGTH = 64;

/** Longest skill title. */
export const MAX_SKILL_TITLE_LENGTH = 80;

/**
 * Longest description. Short because **every** enabled skill's description is
 * in the prompt on every run: this bound times the skill count is the standing
 * cost of having skills at all.
 */
export const MAX_SKILL_DESCRIPTION_LENGTH = 240;

/**
 * Longest instruction body. Generous, but a ceiling: a body is spent from the
 * same context window the conversation and the tool results come out of, and
 * an unbounded one turns "attach three skills" into a run that cannot answer.
 */
export const MAX_SKILL_INSTRUCTIONS_LENGTH = 8_000;

/**
 * How many skills one turn may attach.
 *
 * Three rather than none for the reason attachments are capped at eight: each
 * one costs prompt budget before the model is called, and a request naming
 * twenty would spend it all on instructions about how to answer instead of on
 * the material to answer from.
 */
export const MAX_RUN_SKILLS = 3;

/**
 * How many skill descriptions the prompt may list before it truncates.
 * Mirrors `MAX_TYPE_SUMMARIES` and, like it, the truncation is **stated** to
 * the model rather than silent.
 */
export const MAX_SKILL_SUMMARIES = 25;

/**
 * Checks one skill's shape, returning every problem rather than the first.
 *
 * Every problem, because both callers report to a human who would otherwise fix
 * one and rerun: the host's eager validation fails boot with a list, and the
 * write routes turn it into a 400 naming each field. Pure and total, so the
 * server and the admin can share one definition of "valid" without either one
 * owning it.
 */
export function validateSkillShape(
    skill: Pick<
        Skill,
        'name' | 'title' | 'description' | 'instructions' | 'mode'
    >
): string[] {
    const problems: string[] = [];

    if (!SKILL_NAME_PATTERN.test(skill.name)) {
        problems.push(
            `"${skill.name}" is not a valid skill name — use lowercase letters, digits and hyphens, e.g. "house-style".`
        );
    }
    if (skill.name.length > MAX_SKILL_NAME_LENGTH) {
        problems.push(
            `Skill name is longer than ${MAX_SKILL_NAME_LENGTH} characters.`
        );
    }
    if (!skill.title.trim()) {
        problems.push(`Skill "${skill.name}" needs a title.`);
    }
    if (skill.title.length > MAX_SKILL_TITLE_LENGTH) {
        problems.push(
            `Skill "${skill.name}" has a title longer than ${MAX_SKILL_TITLE_LENGTH} characters.`
        );
    }
    // A description is required rather than optional, and this is the field
    // people will want to skip. It is the only thing in the prompt for a skill
    // nobody has attached, so a skill without one is invisible to the model and
    // can never be recommended — it exists but cannot be found.
    if (!skill.description.trim()) {
        problems.push(
            `Skill "${skill.name}" needs a description — it is what tells the model when the skill applies.`
        );
    }
    if (skill.description.length > MAX_SKILL_DESCRIPTION_LENGTH) {
        problems.push(
            `Skill "${skill.name}" has a description longer than ${MAX_SKILL_DESCRIPTION_LENGTH} characters.`
        );
    }
    if (!skill.instructions.trim()) {
        problems.push(`Skill "${skill.name}" needs instructions.`);
    }
    if (skill.instructions.length > MAX_SKILL_INSTRUCTIONS_LENGTH) {
        problems.push(
            `Skill "${skill.name}" has instructions longer than ${MAX_SKILL_INSTRUCTIONS_LENGTH} characters.`
        );
    }
    if (skill.mode !== 'manual' && skill.mode !== 'always') {
        problems.push(
            `Skill "${skill.name}" has an unknown mode "${String(skill.mode)}".`
        );
    }

    return problems;
}

/** The transcript snapshot for a skill a turn ran with. */
export function toSkillRef(skill: Skill): SkillRef {
    return { name: skill.name, title: skill.title, source: skill.source };
}
