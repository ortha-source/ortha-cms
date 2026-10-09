import type { ReactElement } from 'react';
import type { FieldDoc } from '@orthacms/schema-builder-domain';
import {
    validationEditors,
    type ValidationEditor
} from '../../../../domain/fieldCapabilities';
import type { FieldEditor } from '../../../../application/useFieldEditor';
import { IntegerRule } from './IntegerRule';
import { LengthRules } from './LengthRules';
import { MediaAcceptRules } from './MediaAcceptRules';
import { PatternRule } from './PatternRule';
import { RangeRules } from './RangeRules';
import { StructureRule } from './StructureRule';

type Spec = FieldDoc & Record<string, unknown>;
type Render = (spec: Spec, onChange: FieldEditor['setSpec']) => ReactElement;

/** One editor per rule; which ones a field gets is `validationEditors`' business. */
const EDITORS: Readonly<Record<ValidationEditor, Render>> = {
    length: (spec, onChange) => (
        <LengthRules
            minLength={spec['minLength'] as number}
            maxLength={spec['maxLength'] as number}
            onChange={onChange}
        />
    ),
    pattern: (spec, onChange) => (
        <PatternRule pattern={spec['pattern'] as string} onChange={onChange} />
    ),
    structure: (spec, onChange) => (
        <StructureRule
            structure={spec['structure'] as 'on' | 'off'}
            onChange={onChange}
        />
    ),
    range: (spec, onChange) => (
        <RangeRules
            min={spec['min'] as number}
            max={spec['max'] as number}
            onChange={onChange}
        />
    ),
    integer: (spec, onChange) => (
        <IntegerRule integer={spec['integer'] as boolean} onChange={onChange} />
    ),
    mediaAccept: (spec, onChange) => (
        <MediaAcceptRules
            multiple={spec['multiple'] as boolean}
            accept={spec['accept'] as never}
            onChange={onChange}
        />
    )
};

/** The rules this field's kind takes, and only those. */
export function FieldValidationTab({ editor }: { editor: FieldEditor }) {
    const spec = editor.entry.spec as Spec;
    return (
        <div className="flex flex-col gap-6">
            {validationEditors(spec).map((name) => (
                <div key={name}>{EDITORS[name](spec, editor.setSpec)}</div>
            ))}
        </div>
    );
}
