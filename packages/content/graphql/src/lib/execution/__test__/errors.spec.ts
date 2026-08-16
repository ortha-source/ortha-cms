import {
    ForbiddenException,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
    UnprocessableEntityException
} from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { toGraphQLError } from '../errors';

describe('toGraphQLError', () => {
    let logger: Logger;

    beforeEach(() => {
        logger = { error: jest.fn() } as unknown as Logger;
    });

    it('carries a 404 through as NOT_FOUND with its status', () => {
        const mapped = toGraphQLError(
            new NotFoundException('Unknown content type "ghost".'),
            logger
        );

        expect(mapped?.message).toBe('Unknown content type "ghost".');
        expect(mapped?.extensions).toMatchObject({
            code: 'NOT_FOUND',
            status: 404
        });
    });

    it('maps a scope failure to FORBIDDEN', () => {
        const mapped = toGraphQLError(new ForbiddenException('nope'), logger);

        expect(mapped?.extensions).toMatchObject({
            code: 'FORBIDDEN',
            status: 403
        });
    });

    it('preserves the per-field issues a 422 carries', () => {
        // "Which field failed and why" is the whole value of a validation
        // error — re-shaping it would make the protocols disagree about one
        // failure.
        const issues = [{ field: 'title', message: 'is required' }];
        const mapped = toGraphQLError(
            new UnprocessableEntityException({
                message: 'Validation failed.',
                issues
            }),
            logger
        );

        expect(mapped?.extensions).toMatchObject({
            code: 'VALIDATION_FAILED',
            status: 422,
            issues
        });
    });

    it('joins an array message, as a class-validator failure produces', () => {
        const mapped = toGraphQLError(
            new UnprocessableEntityException({
                message: ['a must be a string', 'b must be an int']
            }),
            logger
        );

        expect(mapped?.message).toBe('a must be a string; b must be an int');
    });

    it('masks an unexpected error and logs it instead', () => {
        const mapped = toGraphQLError(
            new Error('relation "content_article" does not exist'),
            logger
        );

        expect(mapped?.message).toBe('Internal server error.');
        expect(mapped?.message).not.toMatch(/content_article/);
        expect(logger.error).toHaveBeenCalled();
    });

    it('masks a 5xx HttpException, which is a bug wearing a status', () => {
        // The mask keys on the status, not on the exception class: wrapping a
        // driver error in an InternalServerErrorException is an ordinary thing
        // to write, and relaying its message turns a token into a
        // reconnaissance tool.
        const mapped = toGraphQLError(
            new InternalServerErrorException(
                'relation "content_article" does not exist'
            ),
            logger
        );

        expect(mapped?.message).toBe('Internal server error.');
        expect(mapped?.message).not.toMatch(/content_article/);
        expect(mapped?.extensions).toMatchObject({
            code: 'INTERNAL_SERVER_ERROR',
            status: 500
        });
        expect(logger.error).toHaveBeenCalled();
    });

    it('masks any 5xx, not only 500', () => {
        const mapped = toGraphQLError(
            new ServiceUnavailableException('pgbouncer pool exhausted'),
            logger
        );

        expect(mapped?.message).toBe('Internal server error.');
        expect(mapped?.extensions).toMatchObject({ status: 503 });
    });

    it('unwraps an HttpException a resolver threw inside a GraphQLError', () => {
        // graphql-js wraps whatever a resolver throws, so the interesting
        // exception is one level down and would otherwise be masked.
        const wrapped = new GraphQLError('nope', {
            originalError: new ForbiddenException('scope')
        });

        expect(toGraphQLError(wrapped, logger)?.extensions).toMatchObject({
            code: 'FORBIDDEN',
            status: 403
        });
    });

    it('leaves a plain GraphQLError alone', () => {
        const validation = new GraphQLError('Cannot query field "ghost".');

        expect(toGraphQLError(validation, logger)).toBe(validation);
    });
});
