import type { TypeDoc } from '../document/type-doc';
import { modulePath, type KindOf } from './module-path';

const DSL = '@orthacms/content-server/define';

/** The DSL import, then one import per related type, sorted. */
export function renderImports(type: TypeDoc, kindOf: KindOf): string[] {
    const relations = type.fields.flatMap(({ spec }) =>
        spec.type === 'relation' ? [spec.to] : []
    );
    const targets = [...new Set(relations)]
        .filter((target) => target !== type.name)
        .sort();
    const names = [
        type.kind === 'single' ? 'single' : 'collection',
        'field',
        ...(relations.length ? ['type AnyContentType'] : [])
    ];
    return [
        `import { ${names.join(', ')} } from '${DSL}';`,
        ...targets.map(
            (target) =>
                `import { ${target} } from '${modulePath(type.kind, target, kindOf(target))}';`
        )
    ];
}
