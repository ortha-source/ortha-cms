/**
 * Content-type names are `snake_case` slugs (`blog_post`); GraphQL wants
 * `PascalCase` types and `camelCase` fields. This module is the single
 * translation, so the object type, the list envelope, the input, and every root
 * field of one content type are derived from one place and cannot disagree.
 */

/** The GraphQL names one content type contributes to the schema. */
export interface TypeNames {
    /** The entry object type — `blog_post` → `BlogPost`. */
    object: string;
    /** The paged list envelope — `BlogPostList`. */
    list: string;
    /** The write input object — `BlogPostInput`. */
    input: string;
    /** The per-type relation-delta input — `BlogPostRelationsInput`. */
    relationsInput: string;
    /** The single-entry query field — `blogPost`. */
    single: string;
    /** The list query field — `blogPosts`. Absent on `single` content types. */
    plural: string;
    /** Mutation fields, keyed by operation. */
    mutations: {
        create: string;
        update: string;
        publish: string;
        unpublish: string;
        remove: string;
    };
}

/**
 * `blog_post` → `BlogPost`. Splits on any run of non-alphanumerics, so a name
 * using `-` or `.` (neither is currently legal in a content slug, but the
 * registry's rules are not this module's to assume) still produces a valid
 * GraphQL name.
 */
export function pascalCase(name: string): string {
    return name
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
}

/** `blog_post` → `blogPost`. */
export function camelCase(name: string): string {
    const pascal = pascalCase(name);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Naive English pluralisation for the list field: `article` → `articles`,
 * `category` → `categories`, `box` → `boxes`.
 *
 * Deliberately not a full pluralisation library. The output is a **published
 * API name**, so what matters is that it is stable and predictable from the
 * content slug — a consumer reads it out of the SDL either way, and a clever
 * irregular-noun table would make the mapping harder to guess, not easier.
 */
export function pluralize(name: string): string {
    if (/[^aeiou]y$/.test(name)) {
        return `${name.slice(0, -1)}ies`;
    }
    if (/(s|x|z|ch|sh)$/.test(name)) {
        return `${name}es`;
    }
    return `${name}s`;
}

/** Every GraphQL name derived from one content type's slug. */
export function namesFor(typeName: string): TypeNames {
    const object = pascalCase(typeName);
    const single = camelCase(typeName);
    return {
        object,
        list: `${object}List`,
        input: `${object}Input`,
        relationsInput: `${object}RelationsInput`,
        single,
        plural: pluralize(single),
        mutations: {
            create: `create${object}`,
            update: `update${object}`,
            publish: `publish${object}`,
            unpublish: `unpublish${object}`,
            remove: `delete${object}`
        }
    };
}

/**
 * A GraphQL enum value name derived from one `select` option, or `null` when
 * the option cannot be one.
 *
 * Options are author-chosen strings (`in-progress`, `2024`, `née`), while a
 * GraphQL name must start with a letter or underscore and carry only letters,
 * digits, and underscores. Separators are replaced with `_`, so `in-progress`
 * is written `in_progress` on the wire and maps back to the stored value —
 * unavoidable, since the enum *name* is what a client sends and GraphQL has no
 * other spelling for it. What must never happen is an **ambiguous** mapping:
 * an option that cannot be a name at all (`2024`), or two options sanitising to
 * the same name, returns `null`, and the caller falls back to `String` for the
 * whole field rather than serving a value the client cannot round-trip.
 */
export function enumValueName(option: string): string | null {
    const sanitized = option.replace(/[^_0-9A-Za-z]/g, '_');
    if (!/^[_A-Za-z][_0-9A-Za-z]*$/.test(sanitized)) {
        return null;
    }
    return sanitized;
}

/**
 * The reason two content types cannot coexist in one schema, or `null` when
 * they can.
 *
 * Checked once against the **whole registry** at plugin construction rather than
 * per workspace: a collision between two types is a modelling bug, and finding
 * it only when some workspace happens to be granted both would make it a
 * production surprise instead of a boot failure.
 */
export function collisionBetween(first: string, second: string): string | null {
    const a = namesFor(first);
    const b = namesFor(second);
    if (a.object === b.object) {
        return `both map to the GraphQL type "${a.object}"`;
    }
    if (a.plural === b.single || b.plural === a.single) {
        return `their query fields collide ("${a.single}"/"${a.plural}" vs "${b.single}"/"${b.plural}")`;
    }
    return null;
}

/**
 * Throws when any two registered content types would produce colliding GraphQL
 * names. Called at plugin construction, so `blog_post` + `blogPost` fails boot
 * rather than serving a schema that silently drops one of them.
 */
export function assertNoNameCollisions(typeNames: readonly string[]): void {
    for (let i = 0; i < typeNames.length; i++) {
        for (let j = i + 1; j < typeNames.length; j++) {
            const reason = collisionBetween(typeNames[i], typeNames[j]);
            if (reason) {
                throw new Error(
                    `Content types "${typeNames[i]}" and "${typeNames[j]}" cannot both be served over GraphQL — ${reason}. Rename one of them.`
                );
            }
        }
    }
}
