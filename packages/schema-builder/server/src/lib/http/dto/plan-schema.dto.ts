import { ApiProperty } from '@nestjs/swagger';
import { IsObject, Matches } from 'class-validator';

/** The body of `POST /schema-builder/plan`. */
export class PlanSchemaDto {
    @ApiProperty({
        type: 'object',
        additionalProperties: true,
        description:
            'The draft SchemaDocument — the whole content model as it should be. Its shape is checked ' +
            'by the use case (400 with every problem), its meaning by the schema rules (422).'
    })
    @IsObject()
    document!: Record<string, unknown>;

    @ApiProperty({
        description:
            'The fingerprint of the document the draft was made from (GET /schema-builder/document).',
        example: '0123456789abcdef',
        pattern: '^[0-9a-f]{16}$'
    })
    @Matches(/^[0-9a-f]{16}$/)
    baseFingerprint!: string;
}
