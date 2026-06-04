/**
 * Thrown by `AuthService` for every failed login — wrong password, unknown
 * email, missing hash, or a non-active account all raise this one error with no
 * distinguishing detail. Transport-agnostic: the controller maps it to a
 * generic HTTP 401 so the response cannot be used to enumerate accounts.
 */
export class InvalidCredentialsError extends Error {
    constructor() {
        super('Invalid credentials');
        this.name = 'InvalidCredentialsError';
    }
}
