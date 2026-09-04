import {
    BadRequestException,
    ValidationPipe,
    type ArgumentMetadata
} from '@nestjs/common';
import { CreateAlarmRuleDto, UpdateAlarmRuleDto } from './save-alarm-rule.dto';

/**
 * A rule's content type is fixed at creation, and the mechanism is an absence:
 * `UpdateAlarmRuleDto` simply has no `contentType`, so the host's
 * `forbidNonWhitelisted` pipe rejects a body carrying one.
 *
 * That is worth a test precisely *because* it is an absence. Adding the field
 * "for symmetry with create" is a one-line change that reviews as tidying up,
 * and its consequence is silent: every finding a rule has ever opened points at
 * entries of the old type, so a rule that changed type keeps a page of findings
 * about records it can no longer describe, and nothing in the system reports a
 * contradiction.
 *
 * The pipe is constructed here with the same three options `createServer`
 * applies globally (`packages/bootstrap/server/src/lib/create-server.ts`) —
 * this checks the DTO, not the wiring; the wired pipe is a server-e2e concern.
 */

const BODY: ArgumentMetadata = { type: 'body' };

const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true
});

const VALID_CREATE = {
    contentType: 'article',
    name: 'Live records point at published authors',
    findingTitle: 'Author is not published',
    severity: 'warn',
    filter: { and: [{ field: 'status', op: 'eq', value: 'published' }] }
};

describe('UpdateAlarmRuleDto', () => {
    it('has no contentType to change a rule with [alarms:I-15]', async () => {
        const rejection = await pipe
            .transform(
                { name: 'renamed', contentType: 'product' },
                { ...BODY, metatype: UpdateAlarmRuleDto }
            )
            .then(
                () => null,
                (error: unknown) => error
            );

        // `BadRequestException.message` is the generic "Bad Request Exception";
        // the sentence a caller actually receives is in the response body, so
        // that is what this reads — otherwise the assertion would pass for any
        // 400 at all, including one from an unrelated decorator.
        expect(rejection).toBeInstanceOf(BadRequestException);
        expect((rejection as BadRequestException).getResponse()).toMatchObject({
            message: ['property contentType should not exist']
        });
    });

    it('accepts the same body without it', async () => {
        // The negative control: the rejection above is about the one key, not
        // about a pipe that refuses this DTO whatever it is handed.
        await expect(
            pipe.transform(
                { name: 'renamed' },
                { ...BODY, metatype: UpdateAlarmRuleDto }
            )
        ).resolves.toMatchObject({ name: 'renamed' });
    });

    it('is the only half of the pair that refuses it [alarms:I-15]', async () => {
        // Creation names the type — that is where the decision is made, and it
        // is what makes the omission on update a decision rather than an
        // oversight.
        await expect(
            pipe.transform(VALID_CREATE, {
                ...BODY,
                metatype: CreateAlarmRuleDto
            })
        ).resolves.toMatchObject({ contentType: 'article' });
    });
});
