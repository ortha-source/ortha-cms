/**
 * The block **registry** — a set of {@link BlockDefinition}s plus the lookups
 * the parser and serializer need. A schema is immutable and composable:
 * `extendBlockSchema` returns a new one, so a consumer can add (or replace) a
 * block type per editor instance without mutating anyone else's.
 */

import type { HtmlElement } from '../html/node';
import type { BlockDefinition } from './block-definition';

/** A resolved set of block types. */
export interface BlockSchema {
    /** Every definition, in registration order. */
    readonly definitions: readonly BlockDefinition[];
    /** The definition for `type`, or `undefined` when unregistered. */
    get(type: string): BlockDefinition | undefined;
    /** The definition claiming `element`, if any. */
    matchElement(element: HtmlElement): BlockDefinition | undefined;
    /** The definition whose {@link BlockDefinition.wrapper} claims `element`. */
    matchWrapper(element: HtmlElement): BlockDefinition | undefined;
    /** The definitions that appear in the slash menu, in menu order. */
    menuDefinitions(): readonly BlockDefinition[];
}

/**
 * Builds a schema from `definitions`. A later definition with the same `type`
 * **replaces** an earlier one — that is how a consumer overrides a built-in
 * (swapping the image block for one that talks to the media library) instead of
 * having to fork the built-in set.
 */
export function createBlockSchema(
    definitions: readonly BlockDefinition[]
): BlockSchema {
    const byType = new Map<string, BlockDefinition>();
    for (const definition of definitions)
        byType.set(definition.type, definition);
    const resolved = [...byType.values()];

    return {
        definitions: resolved,
        get: (type) => byType.get(type),
        matchElement: (element) =>
            resolved.find(
                (definition) =>
                    definition.tags?.includes(element.tag) &&
                    (definition.match?.(element) ?? true)
            ),
        matchWrapper: (element) =>
            resolved.find(
                (definition) =>
                    definition.wrapper?.tag === element.tag &&
                    (definition.wrapper.match?.(element) ?? true)
            ),
        menuDefinitions: () =>
            resolved
                .filter((definition) => definition.descriptor)
                .sort(
                    (a, b) =>
                        (a.descriptor?.order ?? 0) - (b.descriptor?.order ?? 0)
                )
    };
}

/** A schema with `extra` layered over `base` (same-`type` entries replace). */
export function extendBlockSchema(
    base: BlockSchema,
    extra: readonly BlockDefinition[]
): BlockSchema {
    return createBlockSchema([...base.definitions, ...extra]);
}
