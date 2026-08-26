/**
 * A rule names a content type this deployment does not register, or the
 * workspace was never granted.
 *
 * The two cases share one error and one message on purpose: content's own
 * routes already answer an ungranted type with the 404 an unknown one gets, so
 * that a workspace cannot enumerate the deployment's content model. A rule
 * editor that distinguished them would reopen exactly that channel.
 */
export class UnknownAlarmContentTypeError extends Error {
    constructor(readonly typeName: string) {
        super(`Unknown content type "${typeName}".`);
        this.name = 'UnknownAlarmContentTypeError';
    }
}
