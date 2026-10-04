import type { TypeRule } from '../rule';
import { issue, typePath } from '../schema-issue';

/** A page (single) is served at a route path, which starts with "/". */
export const checkSinglePath: TypeRule = (type) =>
    type.kind !== 'single' || (type.path ?? '').startsWith('/')
        ? []
        : [
              issue(
                  typePath(type.name),
                  'type.single-path',
                  `Single "${type.name}" path must start with "/" (got "${type.path ?? ''}").`
              )
          ];
