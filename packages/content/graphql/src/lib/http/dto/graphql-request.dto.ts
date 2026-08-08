import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

/**
 * The GraphQL-over-HTTP request body.
 *
 * Declared as a real DTO because the host's global `ValidationPipe` runs with
 * `forbidNonWhitelisted: true`: without these three properties every GraphQL
 * request would be rejected as carrying unknown keys before reaching the
 * controller. The length bound is **not** here — it belongs with the rest of the
 * cost budget, which is host-configurable, and a hard-coded `@MaxLength` would
 * silently override it.
 */
export class GraphqlRequestDto {
    /** The query document. */
    @ApiProperty({
        type: String,
        example: '{ articles(pageSize: 10) { items { id title } total } }',
        description:
            'The GraphQL document to execute. Queries and mutations only — this endpoint runs one operation per request.'
    })
    @IsString()
    query!: string;

    /** Variable values referenced by the document. */
    @ApiPropertyOptional({
        type: 'object',
        additionalProperties: true,
        description:
            'Variable values, keyed by variable name. Structurally an arbitrary object — the document declares the types, and graphql-js coerces against them.'
    })
    @IsOptional()
    @IsObject()
    variables?: Record<string, unknown>;

    /** Which operation to run, when the document defines more than one. */
    @ApiPropertyOptional({
        type: String,
        description:
            'Which operation to run. Required when the document defines more than one, since this endpoint executes exactly one per request.'
    })
    @IsOptional()
    @IsString()
    operationName?: string;
}
