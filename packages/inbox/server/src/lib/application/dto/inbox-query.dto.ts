import { Transform } from 'class-transformer';
import {
    IsBoolean,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    Max,
    Min
} from 'class-validator';
import { INBOX_CATEGORIES, type InboxCategory } from '@orthacms/inbox-domain';

/** The largest page `GET /inbox` serves. */
export const INBOX_PAGE_MAX = 100;

/** `GET /api/inbox` query. */
export class InboxQueryDto {
    /** One tab's items; every tab's when omitted. */
    @IsOptional()
    @IsIn(INBOX_CATEGORIES)
    category?: InboxCategory;

    /** Only what is still unread. */
    @IsOptional()
    @Transform(
        ({ value }) => value === true || value === 'true' || value === '1'
    )
    @IsBoolean()
    unread?: boolean;

    /** The previous page's `nextCursor`. */
    @IsOptional()
    @IsString()
    before?: string;

    @IsOptional()
    @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
    @IsInt()
    @Min(1)
    @Max(INBOX_PAGE_MAX)
    limit?: number;
}

/** `POST /api/inbox/read` body — mark everything read, or one tab. */
export class MarkAllReadDto {
    @IsOptional()
    @IsIn(INBOX_CATEGORIES)
    category?: InboxCategory;
}
