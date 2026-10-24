import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { RequestPasswordRecoveryUseCase } from '../../application/use-cases/request-password-recovery.use-case';
import { OriginGuard } from '../guards/origin.guard';
import { PasswordRecoveryController } from './password-recovery.controller';

const GUARDS_METADATA = '__guards__';

function controller(available: boolean) {
    const submitted: string[] = [];
    const recovery = {
        isAvailable: available,
        submit: (email: string) => {
            submitted.push(email);
        }
    } as unknown as RequestPasswordRecoveryUseCase;
    return {
        controller: new PasswordRecoveryController(recovery),
        submitted
    };
}

describe('PasswordRecoveryController', () => {
    it('says whether the deployment can send recovery mail', () => {
        expect(controller(true).controller.availability()).toEqual({
            available: true
        });
        expect(controller(false).controller.availability()).toEqual({
            available: false
        });
    });

    it('answers 404 without a mail provider, as if the route were not there', () => {
        const { controller: subject, submitted } = controller(false);
        expect(() => subject.request({ email: 'ada@example.com' })).toThrow(
            NotFoundException
        );
        expect(submitted).toEqual([]);
    });

    it('acknowledges every address the same way and leaves the work for later', () => {
        const { controller: subject, submitted } = controller(true);

        expect(subject.request({ email: 'ada@example.com' })).toEqual({
            ok: true
        });
        expect(subject.request({ email: 'nobody@example.com' })).toEqual({
            ok: true
        });
        expect(submitted).toEqual(['ada@example.com', 'nobody@example.com']);
    });

    it('is rate-limited per source, and the request passes the Origin check', () => {
        const classGuards =
            Reflect.getMetadata(GUARDS_METADATA, PasswordRecoveryController) ??
            [];
        const postGuards =
            Reflect.getMetadata(
                GUARDS_METADATA,
                PasswordRecoveryController.prototype.request
            ) ?? [];
        expect(classGuards).toContain(ThrottlerGuard);
        expect(postGuards).toContain(OriginGuard);
    });
});
