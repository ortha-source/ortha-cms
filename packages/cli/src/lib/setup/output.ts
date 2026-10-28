import { quote } from './env-file';
import type { EnvValues } from './engine';

/** Where the settings go. */
export type OutputFormat = 'env' | 'compose' | 'kubernetes' | 'file';

/** Every set value, sorted, as `[name, value]`. */
function entries(values: EnvValues): [string, string][] {
    return Object.entries(values)
        .filter((entry): entry is [string, string] => Boolean(entry[1]))
        .sort(([a], [b]) => a.localeCompare(b));
}

/** A YAML double-quoted scalar. */
function yamlString(value: string): string {
    return JSON.stringify(value);
}

/** A Docker Compose `environment:` block. */
export function renderCompose(values: EnvValues): string {
    return [
        '    environment:',
        ...entries(values).map(
            ([name, value]) => `      ${name}: ${yamlString(value)}`
        )
    ].join('\n');
}

/** A Kubernetes Secret with every value as `stringData`. */
export function renderKubernetesSecret(
    values: EnvValues,
    name = 'orthacms'
): string {
    return (
        [
            'apiVersion: v1',
            'kind: Secret',
            'metadata:',
            `  name: ${name}`,
            'type: Opaque',
            'stringData:',
            ...entries(values).map(
                ([key, value]) => `  ${key}: ${yamlString(value)}`
            )
        ].join('\n') + '\n'
    );
}

/** A plain `KEY=value` file, as Fly, Render and Railway import one. */
export function renderEnvList(values: EnvValues): string {
    return (
        entries(values)
            .map(([name, value]) => `${name}=${quote(value)}`)
            .join('\n') + '\n'
    );
}
