import type { FieldRule } from '../rule';
import { fieldPath, issue } from '../schema-issue';

/**
 * A required single relation is a NOT NULL FK, so ON DELETE SET NULL could
 * never succeed — the parent's delete would always fail.
 */
export const checkRequiredSetNull: FieldRule = (type, name, field) => {
    const rel = field.relation;
    const contradicts =
        field.type === 'relation' &&
        !!rel &&
        !rel.inverse &&
        !rel.many &&
        field.required &&
        rel.onDelete === 'set null';
    return contradicts
        ? [
              issue(
                  fieldPath(type.name, name),
                  'relation.required-set-null',
                  `Relation "${type.name}.${name}" is required but its onDelete is ` +
                      `'set null' — a NOT NULL foreign key cannot be nulled on delete. ` +
                      `Use 'cascade' or 'restrict'.`
              )
          ]
        : [];
};
