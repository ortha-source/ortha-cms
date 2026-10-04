import { defineMessages, useIntl } from 'react-intl';
import { Button, InputField } from '@orthacms/design-system';
import {
    PATTERN_PRESETS,
    testPattern
} from '../../../../../domain/patternPresets';
import { PatternTester } from './PatternTester';

const messages = defineMessages({
    label: { id: 'schemaBuilder.rules.pattern', defaultMessage: 'Pattern' },
    hint: {
        id: 'schemaBuilder.rules.patternHint',
        defaultMessage: 'A regular expression the whole value must match.'
    },
    invalid: {
        id: 'schemaBuilder.rules.patternInvalid',
        defaultMessage: 'This is not a valid regular expression.'
    },
    presets: {
        id: 'schemaBuilder.rules.patternPresets',
        defaultMessage: 'Common patterns'
    },
    slug: { id: 'schemaBuilder.rules.presetSlug', defaultMessage: 'Slug' },
    email: { id: 'schemaBuilder.rules.presetEmail', defaultMessage: 'Email' },
    url: { id: 'schemaBuilder.rules.presetUrl', defaultMessage: 'URL' }
});

type Props = {
    pattern?: string;
    onChange: (patch: Record<string, unknown>) => void;
};

/** `pattern`, with presets and a tester; a pattern that does not compile says so here. */
export function PatternRule({ pattern = '', onChange }: Props) {
    const intl = useIntl();
    const broken = pattern !== '' && testPattern(pattern, '') === null;
    return (
        <div className="flex flex-col gap-3">
            <InputField
                id="rule-pattern"
                label={intl.formatMessage(messages.label)}
                description={intl.formatMessage(messages.hint)}
                error={
                    broken ? intl.formatMessage(messages.invalid) : undefined
                }
                className="font-mono"
                value={pattern}
                onChange={(event) => onChange({ pattern: event.target.value })}
            />
            <div
                className="flex flex-wrap items-center gap-2"
                role="group"
                aria-label={intl.formatMessage(messages.presets)}
            >
                {PATTERN_PRESETS.map((preset) => (
                    <Button
                        key={preset.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onChange({ pattern: preset.pattern })}
                    >
                        {intl.formatMessage(messages[preset.id])}
                    </Button>
                ))}
            </div>
            {pattern && !broken && <PatternTester pattern={pattern} />}
        </div>
    );
}
