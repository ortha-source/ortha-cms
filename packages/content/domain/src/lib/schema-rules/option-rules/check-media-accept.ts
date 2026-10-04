import { MEDIA_KIND_VALUES, isMediaKind } from '../../fields/media-kind';
import type { FieldRule } from '../rule';
import { fieldPath, issue } from '../schema-issue';

/** A typo'd kind would accept nothing, silently. */
export const checkMediaAccept: FieldRule = (type, name, field) =>
    (field.accept?.kinds ?? [])
        .filter((kind) => !isMediaKind(kind))
        .map((kind) =>
            issue(
                fieldPath(type.name, name),
                'field.media-kind',
                `Field "${type.name}.${name}" accepts media kind ${JSON.stringify(kind)}: ` +
                    `expected one of ${MEDIA_KIND_VALUES.join(', ')}.`
            )
        );
