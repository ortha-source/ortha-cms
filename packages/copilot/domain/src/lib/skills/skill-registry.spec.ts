import {
    buildSkillRegistry,
    mergeSkills,
    type SkillRegistry
} from './skill-registry';
import {
    MAX_SKILL_DESCRIPTION_LENGTH,
    MAX_SKILL_INSTRUCTIONS_LENGTH,
    validateSkillShape,
    type Skill,
    type SkillDefinition
} from './skill';

function definition(over: Partial<SkillDefinition> = {}): SkillDefinition {
    return {
        name: 'house-style',
        title: 'House style',
        description: 'How we write product copy.',
        instructions: 'Sentence case. Second person. No exclamation marks.',
        ...over
    };
}

function skill(over: Partial<Skill> = {}): Skill {
    return {
        name: 'house-style',
        title: 'House style',
        description: 'How we write product copy.',
        instructions: 'Sentence case.',
        mode: 'manual',
        source: 'cms',
        ...over
    };
}

describe('buildSkillRegistry', () => {
    it('preserves the order the host declared', () => {
        const registry: SkillRegistry = buildSkillRegistry([
            definition({ name: 'first' }),
            definition({ name: 'second' }),
            definition({ name: 'third' })
        ]);

        expect(registry.all().map((entry) => entry.name)).toEqual([
            'first',
            'second',
            'third'
        ]);
    });

    it('defaults mode to manual and stamps the source as code', () => {
        const [built] = buildSkillRegistry([definition()]).all();

        expect(built.mode).toBe('manual');
        expect(built.source).toBe('code');
    });

    it('keeps an explicit always mode', () => {
        const [built] = buildSkillRegistry([
            definition({ mode: 'always' })
        ]).all();

        expect(built.mode).toBe('always');
    });

    it('rejects a duplicate name rather than letting one silently win', () => {
        expect(() => buildSkillRegistry([definition(), definition()])).toThrow(
            /Duplicate copilot skill name "house-style"/
        );
    });

    it('rejects a malformed skill at construction', () => {
        expect(() =>
            buildSkillRegistry([definition({ name: 'House Style' })])
        ).toThrow(/not a valid skill name/);
    });

    it('misses on Object.prototype keys instead of resolving them', () => {
        const registry = buildSkillRegistry([definition()]);

        expect(registry.has('constructor')).toBe(false);
        expect(registry.get('toString')).toBeUndefined();
    });

    it('is unaffected by a later mutation of the host list', () => {
        const list: SkillDefinition[] = [definition()];
        const registry = buildSkillRegistry(list);

        list.push(definition({ name: 'added-later' }));

        expect(registry.has('added-later')).toBe(false);
        expect(registry.all()).toHaveLength(1);
    });
});

describe('mergeSkills', () => {
    it('lists code skills before the workspace’s own', () => {
        const merged = mergeSkills(
            [skill({ name: 'from-code', source: 'code' })],
            [skill({ name: 'from-cms' })]
        );

        expect(merged.map((entry) => entry.name)).toEqual([
            'from-code',
            'from-cms'
        ]);
    });

    it('drops a CMS skill whose name a code skill already holds [copilot:I-29]', () => {
        const merged = mergeSkills(
            [
                skill({
                    name: 'house-style',
                    source: 'code',
                    instructions: 'the reviewed one'
                })
            ],
            [skill({ name: 'house-style', instructions: 'the shadowing one' })]
        );

        expect(merged).toHaveLength(1);
        expect(merged[0].source).toBe('code');
        expect(merged[0].instructions).toBe('the reviewed one');
    });
});

describe('validateSkillShape', () => {
    it('accepts a well-formed skill', () => {
        expect(validateSkillShape(skill())).toEqual([]);
    });

    it('reports every problem, not just the first', () => {
        const problems = validateSkillShape(
            skill({ name: 'Bad Name', title: '', description: '' })
        );

        expect(problems.length).toBeGreaterThanOrEqual(3);
    });

    it('requires a description, because it is all the model sees unattached', () => {
        expect(validateSkillShape(skill({ description: '   ' }))).toEqual([
            expect.stringContaining('needs a description')
        ]);
    });

    it('bounds the description and the instructions', () => {
        const problems = validateSkillShape(
            skill({
                description: 'x'.repeat(MAX_SKILL_DESCRIPTION_LENGTH + 1),
                instructions: 'y'.repeat(MAX_SKILL_INSTRUCTIONS_LENGTH + 1)
            })
        );

        expect(problems).toHaveLength(2);
    });
});
