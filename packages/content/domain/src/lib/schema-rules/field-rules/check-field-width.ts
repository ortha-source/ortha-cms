import type { FieldRule } from '../rule';
import { fieldPath, issue } from '../schema-issue';

/** The widths `admin.width` accepts. */
export const FIELD_WIDTHS: ReadonlySet<unknown> = new Set(['half', 'full']);

/**
 * The admin reads an unknown width as `full`, so a typo (`'halff'`) would pass
 * boot and quietly lay the form out as if it had never been written.
 */
export const checkFieldWidth: FieldRule = (type, name, field) =>
    field.width === undefined || FIELD_WIDTHS.has(field.width)
        ? []
        : [
              issue(
                  fieldPath(type.name, name),
                  'field.width',
                  `Field "${type.name}.${name}" has admin.width ` +
                      `"${String(field.width)}" — use 'half' or 'full'.`
              )
          ];
