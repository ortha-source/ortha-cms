/**
 * Public API of `create-ortha-app`.
 *
 * The package is used through `npx`; these exports exist so the rendering and
 * validation logic is testable without spawning the binary.
 */
export {
    renderTemplate,
    render,
    generateSecret,
    isNonEmptyDirectory,
    type TemplateValues
} from './lib/template';
export {
    validateAppName,
    validateDatabaseUrl,
    databaseNameFrom
} from './lib/validate';
