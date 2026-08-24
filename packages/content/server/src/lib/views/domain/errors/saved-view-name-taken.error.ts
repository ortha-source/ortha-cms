/** The caller already holds a view by this name in the same workspace + scope. */
export class SavedViewNameTakenError extends Error {
    constructor(name: string) {
        super(`You already have a view named "${name}" for this list.`);
        this.name = 'SavedViewNameTakenError';
    }
}
