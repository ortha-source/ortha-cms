import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { InputField } from '@orthacms/design-system';
import { testPattern } from '../../../../../../domain/patternPresets';

const messages = defineMessages({
    label: {
        id: 'schemaBuilder.rules.patternTry',
        defaultMessage: 'Try a value'
    },
    match: {
        id: 'schemaBuilder.rules.patternMatch',
        defaultMessage: 'Matches'
    },
    noMatch: {
        id: 'schemaBuilder.rules.patternNoMatch',
        defaultMessage: 'Does not match'
    }
});

/** A sample value checked against the pattern as it is typed. */
export function PatternTester({ pattern }: { pattern: string }) {
    const intl = useIntl();
    const [sample, setSample] = useState('');
    const result = sample && pattern ? testPattern(pattern, sample) : null;
    return (
        <InputField
            id="rule-pattern-try"
            label={intl.formatMessage(messages.label)}
            value={sample}
            onChange={(event) => setSample(event.target.value)}
            description={
                result === null ? undefined : (
                    <span
                        role="status"
                        className={
                            result
                                ? 'text-success-soft-foreground'
                                : 'text-destructive'
                        }
                    >
                        {intl.formatMessage(
                            result ? messages.match : messages.noMatch
                        )}
                    </span>
                )
            }
        />
    );
}
