import { IsString, Matches, MaxLength } from 'class-validator';
import { LOCALE_SLUG_MAX_LENGTH, LOCALE_SLUG_RE } from '../../i18n.constants';

/** Body for `POST /api/i18n/content/:typeName/:id/translations`. */
export class CreateTranslationDto {
    /** Target locale slug the translation is created in. */
    @IsString()
    @MaxLength(LOCALE_SLUG_MAX_LENGTH)
    @Matches(LOCALE_SLUG_RE)
    locale!: string;
}
