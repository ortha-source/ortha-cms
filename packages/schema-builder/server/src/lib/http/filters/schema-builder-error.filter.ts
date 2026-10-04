import {
    Catch,
    HttpStatus,
    type ArgumentsHost,
    type ExceptionFilter
} from '@nestjs/common';
import type { Response } from 'express';
import { SchemaBuilderError } from '../../domain/errors';

/** One table from an error's code to its status; the controllers never map. */
const STATUS: Readonly<Record<string, HttpStatus>> = {
    'schema-builder.disabled': HttpStatus.FORBIDDEN,
    'schema-builder.stale': HttpStatus.CONFLICT,
    'schema-builder.invalid-document': HttpStatus.BAD_REQUEST,
    'schema-builder.invalid': HttpStatus.UNPROCESSABLE_ENTITY,
    'schema-builder.not-owned': HttpStatus.UNPROCESSABLE_ENTITY,
    'schema-builder.migration-ambiguous': HttpStatus.UNPROCESSABLE_ENTITY,
    'schema-builder.migration-failed': HttpStatus.INTERNAL_SERVER_ERROR
};

/** Answers a {@link SchemaBuilderError} as `{ statusCode, code, message, details }`. */
@Catch(SchemaBuilderError)
export class SchemaBuilderErrorFilter implements ExceptionFilter {
    catch(error: SchemaBuilderError, host: ArgumentsHost): void {
        const statusCode =
            STATUS[error.code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
        host.switchToHttp().getResponse<Response>().status(statusCode).json({
            statusCode,
            code: error.code,
            message: error.message,
            details: error.details()
        });
    }
}
