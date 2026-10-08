import { defaultValueProblem } from '../../fields/default-value';
import type { FieldRule } from '../rule';
import { fieldPath, issue } from '../schema-issue';

/**
 * A default must be a value the field accepts — of a type that takes one, and
 * inside its options, range and pattern. Re-checked whenever those change, so
 * narrowing the options under a default is caught on the field, not on save.
 */
export const checkDefaultValue: FieldRule = (type, name, field) => {
    if (field.defaultValue === undefined) return [];
    const problem = defaultValueProblem(
        {
            type: field.type,
            required: false,
            ...(field.validation ? { validation: field.validation } : {}),
            ...(field.options ? { options: field.options } : {})
        },
        field.defaultValue
    );
    return problem === undefined
        ? []
        : [
              issue(
                  fieldPath(type.name, name),
                  'field.default-value',
                  `Field "${type.name}.${name}" has default value ` +
                      `${JSON.stringify(field.defaultValue)}, which ${problem}.`
              )
          ];
};
