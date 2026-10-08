import {
    BadRequestException,
    NotFoundException,
    UnprocessableEntityException
} from '@nestjs/common';
import { DrizzleQueryError } from 'drizzle-orm';
import { GENERIC_FAILURE, userFacingMessage } from './user-facing-message';

/** A `pg` protocol error: `name` is the message type, the class is the tell. */
class DatabaseError extends Error {
    constructor(
        message: string,
        readonly code: string
    ) {
        super(message);
        this.name = 'error';
    }
}

describe('userFacingMessage', () => {
    it('passes the sentence a tool wrote for the model', () => {
        expect(userFacingMessage(new Error('No asset "a1".'))).toBe(
            'No asset "a1".'
        );
    });

    it("passes an HttpException, with a 422's per-field issues", () => {
        expect(userFacingMessage(new NotFoundException('No entry "x".'))).toBe(
            'No entry "x".'
        );
        expect(
            userFacingMessage(
                new UnprocessableEntityException({
                    message: 'Entry validation failed',
                    issues: [{ field: 'title', message: 'is required' }]
                })
            )
        ).toBe('Entry validation failed: title is required');
        expect(
            userFacingMessage(
                new BadRequestException({
                    message: 'Invalid arguments.',
                    issues: [
                        { field: 'pageSize', problems: ['must not be > 50'] }
                    ]
                })
            )
        ).toBe('Invalid arguments: pageSize must not be > 50');
    });

    it.each([
        [
            "drizzle-orm's query wrapper",
            new DrizzleQueryError('select * from "users" where "id" = $1', [
                'x'
            ])
        ],
        [
            'a pg DatabaseError',
            new DatabaseError('relation "secret_table" does not exist', '42P01')
        ],
        [
            'anything carrying a SQLSTATE',
            Object.assign(new Error('duplicate key "users_email_key"'), {
                code: '23505'
            })
        ],
        [
            'a socket error',
            Object.assign(new Error('connect ECONNREFUSED 10.0.0.5:5432'), {
                errno: -111,
                syscall: 'connect'
            })
        ],
        [
            'a driver error wrapped in an ordinary one',
            new Error('Saving failed', {
                cause: new DrizzleQueryError('update "x" set …', [])
            })
        ],
        [
            "a driver error interpolated into a batch applier's message",
            new Error(
                'Translation 2 of 2 (fr) failed: Failed query: insert into "content_article" …. The first 1 were saved and the rest were not.'
            )
        ],
        [
            'a programmer error',
            new TypeError(
                "Cannot read properties of undefined (reading 'rows')"
            )
        ]
    ])('withholds %s', (_label, error) => {
        expect(userFacingMessage(error)).toBe(GENERIC_FAILURE);
    });

    it("uses the caller's fallback, and survives a cyclic cause", () => {
        const looped = new Error('loop');
        (looped as { cause?: unknown }).cause = looped;
        expect(userFacingMessage(looped)).toBe('loop');
        expect(userFacingMessage('not an error', 'Could not apply.')).toBe(
            'Could not apply.'
        );
    });
});
