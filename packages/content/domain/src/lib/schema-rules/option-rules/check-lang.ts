import { isWellFormedLanguageTag } from '../../richtext/language-tag';
import type { FieldRule } from '../rule';
import { fieldPath, issue } from '../schema-issue';

/** A `lang` no user agent can parse tells assistive tech nothing useful. */
export const checkLang: FieldRule = (type, name, field) =>
    field.lang === undefined || isWellFormedLanguageTag(field.lang)
        ? []
        : [
              issue(
                  fieldPath(type.name, name),
                  'field.lang',
                  `Field "${type.name}.${name}" has an invalid BCP-47 language tag ` +
                      `${JSON.stringify(field.lang)}. Expected something like "en", "en-GB" or "zh-Hans".`
              )
          ];
