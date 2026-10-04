import type { TypeDoc } from '../document/type-doc';
import { GENERATED_MARKER } from '../generated-marker';
import type { KindOf } from './module-path';
import { objectLiteral } from './object-literal';
import { propertyKey } from './property-key';
import { renderField } from './render-field';
import { renderImports } from './render-imports';
import { renderTypeOptions } from './render-type-options';

export const GENERATED_BANNER = [
    `${GENERATED_MARKER} — managed by the Schema Builder.`,
    '// Remove the line above to take this type over by hand; the builder will then show it read-only.'
].join('\n');

/** One content type's module, as the builder owns it. Prettier formats it afterwards. */
export function renderTypeModule(type: TypeDoc, kindOf: KindOf): string {
    const fields = type.fields
        .map(({ name, spec }) => `${propertyKey(name)}: ${renderField(spec)}`)
        .join(',\n');
    const options = objectLiteral(renderTypeOptions(type), {
        raw: { fields: `{\n${fields}\n}` }
    });
    const dsl = type.kind === 'single' ? 'single' : 'collection';
    return [
        GENERATED_BANNER,
        '',
        ...renderImports(type, kindOf),
        '',
        `export const ${type.name} = ${dsl}('${type.name}', ${options});`,
        ''
    ].join('\n');
}
