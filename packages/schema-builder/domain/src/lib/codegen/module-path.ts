import { contentFolder } from '../manifest/manifest-entry';

export type TypeKind = 'collection' | 'single';
export type KindOf = (name: string) => TypeKind;

/** A type's module path under `src/content/`: `collections/event.ts`. */
export const contentFilePath = (kind: TypeKind, name: string): string =>
    `${contentFolder(kind)}/${name}.ts`;

/** The import specifier from a type of `fromKind` to another type's module. */
export function modulePath(
    fromKind: TypeKind,
    target: string,
    targetKind: TypeKind
): string {
    return fromKind === targetKind
        ? `./${target}`
        : `../${contentFolder(targetKind)}/${target}`;
}
