import { checkTypes } from '@orthacms/content-domain';
import {
    toRuleType,
    type SchemaDocument
} from '@orthacms/schema-builder-domain';
import { SchemaInvalidError } from '../../domain/errors';

/** [schema-builder:I-10] The draft passes the rules the DSL and the registry run at boot. */
export function assertValid(draft: SchemaDocument): void {
    const issues = checkTypes(draft.types.map(toRuleType));
    if (issues.length) throw new SchemaInvalidError(issues);
}
