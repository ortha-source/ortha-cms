import type { FieldRule } from '../rule';
import { fieldPath, issue } from '../schema-issue';

/**
 * `localized` only means something on a row-per-locale type; anywhere else the
 * flag would silently do nothing.
 */
export const checkLocalized: FieldRule = (type, name, field) =>
    !field.localized || type.i18n
        ? []
        : [
              issue(
                  fieldPath(type.name, name),
                  'field.localized-without-i18n',
                  `Field "${name}" on "${type.name}" is localized, but the type ` +
                      `does not set i18n: true.`
              )
          ];
