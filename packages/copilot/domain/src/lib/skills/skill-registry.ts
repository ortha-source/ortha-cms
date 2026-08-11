import { validateSkillShape, type Skill, type SkillDefinition } from './skill';

/**
 * The host's code-defined skills, frozen at boot.
 *
 * Structurally the same idea as `ModelRegistry`: a name→value lookup built once
 * from a list the operator wrote, so registration order is meaningful and a
 * duplicate name is a loud failure rather than a silent last-one-wins.
 */
export interface SkillRegistry {
    /** Every code skill, in the order the host declared them. */
    all(): Skill[];
    /** Whether a name is taken by a code skill. */
    has(name: string): boolean;
    /** One code skill, or `undefined`. */
    get(name: string): Skill | undefined;
}

/**
 * Builds the immutable registry over the host's skill list.
 *
 * @throws When a skill is malformed or a name is registered twice. Both are
 *   misconfigurations that should fail at construction — a duplicate name would
 *   otherwise mean the model silently runs with whichever body happened to win,
 *   which is the failure mode nobody thinks to look for.
 */
export function buildSkillRegistry(
    definitions: readonly SkillDefinition[]
): SkillRegistry {
    // A null-prototype snapshot, for the reason `buildModelRegistry` uses one:
    // a later mutation of the host's array cannot change what a run resolves,
    // and a lookup of `constructor` or `toString` misses instead of resolving
    // something off `Object.prototype` that is not a skill.
    const entries: Record<string, Skill> = Object.create(null) as Record<
        string,
        Skill
    >;
    const order: string[] = [];

    for (const definition of definitions) {
        const skill: Skill = {
            name: definition.name,
            title: definition.title,
            description: definition.description,
            instructions: definition.instructions,
            mode: definition.mode ?? 'manual',
            source: 'code'
        };

        const problems = validateSkillShape(skill);
        if (problems.length > 0) {
            throw new Error(
                `Invalid copilot skill in the host's configuration: ${problems.join(' ')}`
            );
        }
        if (Object.prototype.hasOwnProperty.call(entries, skill.name)) {
            throw new Error(
                `Duplicate copilot skill name "${skill.name}". Names must be unique across the skill list.`
            );
        }

        entries[skill.name] = Object.freeze(skill);
        order.push(skill.name);
    }

    return {
        all: () => order.map((name) => entries[name]),
        has: (name) => Object.prototype.hasOwnProperty.call(entries, name),
        get: (name) => entries[name]
    };
}

/**
 * The catalogue one workspace sees: the deployment's code skills, then that
 * workspace's own.
 *
 * **Code wins a name collision**, and the CMS side is filtered rather than
 * overwritten. The write routes refuse a colliding name up front, so reaching
 * this filter means a code skill was added *after* a CMS one already had the
 * name — a deploy, not a request. Dropping the CMS row is the safer of the two
 * readings: the code skill is the one in review, in git, and identical across
 * every workspace, and a deploy that silently changed one workspace's
 * instructions is exactly the surprise this avoids.
 */
export function mergeSkills(
    code: readonly Skill[],
    cms: readonly Skill[]
): Skill[] {
    const taken = new Set(code.map((skill) => skill.name));
    return [...code, ...cms.filter((skill) => !taken.has(skill.name))];
}
