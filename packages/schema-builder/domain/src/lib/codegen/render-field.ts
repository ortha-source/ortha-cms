import type { FieldDoc } from '../document/field-doc';
import { FIELD_BUILDER } from './field-builder';
import { fieldOptions } from './field-options';
import { objectLiteral } from './object-literal';
import { renderRelationField } from './render-relation-field';

/** One field's DSL call. */
export function renderField(spec: FieldDoc): string {
    if (spec.type === 'relation') return renderRelationField(spec);
    const options = fieldOptions(spec);
    const args =
        Object.keys(options).length ||
        spec.type === 'select' ||
        spec.type === 'multiselect'
            ? objectLiteral(options)
            : '';
    return `field.${FIELD_BUILDER[spec.type]}(${args})`;
}
