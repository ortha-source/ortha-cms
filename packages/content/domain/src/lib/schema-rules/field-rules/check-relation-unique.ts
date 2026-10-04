import type { FieldRule } from '../rule';
import { fieldPath, issue } from '../schema-issue';

/**
 * `unique` is a UNIQUE constraint on the single FK column. A many-relation has
 * no such column — its links live in a join table.
 */
export const checkRelationUnique: FieldRule = (type, name, field) =>
    field.type === 'relation' && field.relation?.many && field.relation.unique
        ? [
              issue(
                  fieldPath(type.name, name),
                  'relation.unique-many',
                  `Relation "${type.name}.${name}" sets unique: true with ` +
                      `many: true — a many-relation has no FK column to constrain. ` +
                      `Drop one of them.`
              )
          ]
        : [];
