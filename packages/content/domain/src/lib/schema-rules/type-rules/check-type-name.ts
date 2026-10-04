import type { TypeRule } from '../rule';
import { issue, typePath } from '../schema-issue';

/** Valid machine names: snake_case, starting with a letter. */
export const TYPE_NAME_RE = /^[a-z][a-z0-9_]*$/;

export const checkTypeName: TypeRule = (type) =>
    TYPE_NAME_RE.test(type.name)
        ? []
        : [
              issue(
                  typePath(type.name),
                  'type.name',
                  `Content type name "${type.name}" must be snake_case ` +
                      `(letters, digits, underscores; starting with a letter).`
              )
          ];
