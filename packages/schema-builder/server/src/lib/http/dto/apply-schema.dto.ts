import { ApiProperty } from '@nestjs/swagger';
import {
    ArrayMaxSize,
    IsArray,
    IsObject,
    IsString,
    Matches
} from 'class-validator';

/** The body of `POST /schema-builder/apply`. */
export class ApplySchemaDto {
    @ApiProperty({
        type: 'object',
        additionalProperties: true,
        description: 'The draft SchemaDocument, as planned.'
    })
    @IsObject()
    document!: Record<string, unknown>;

    @ApiProperty({
        description: 'The fingerprint the plan was made against.',
        example: '0123456789abcdef',
        pattern: '^[0-9a-f]{16}$'
    })
    @Matches(/^[0-9a-f]{16}$/)
    baseFingerprint!: string;

    @ApiProperty({
        description:
            'The migration file name suffix: lowercase letters, digits and underscores.',
        example: 'add_event_venue',
        pattern: '^[a-z][a-z0-9_]{0,59}$'
    })
    @Matches(/^[a-z][a-z0-9_]{0,59}$/)
    migrationName!: string;

    @ApiProperty({
        type: [String],
        maxItems: 500,
        description:
            'The id of every destructive change being confirmed, one by one — there is no "confirm all".',
        example: ['field.remove:event.legacy']
    })
    @IsArray()
    @ArrayMaxSize(500)
    @IsString({ each: true })
    confirmed!: string[];
}
