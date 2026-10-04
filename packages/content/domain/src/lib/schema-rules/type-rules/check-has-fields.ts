import type { TypeRule } from '../rule';
import { issue, typePath } from '../schema-issue';

export const checkHasFields: TypeRule = (type) =>
    Object.keys(type.fields).length > 0
        ? []
        : [
              issue(
                  typePath(type.name),
                  'type.no-fields',
                  `Content type "${type.name}" defines no fields.`
              )
          ];
