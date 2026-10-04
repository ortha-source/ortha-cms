import type { ChangeKind, ChangeOf } from '../diff/schema-change';
import type { ClassifyContext } from './change-facts';
import type { ClassifiedChange } from './classified-change';
import { classifyCodeOnly } from './classifiers/classify-code-only';
import { classifyFieldAdd } from './classifiers/classify-field-add';
import { classifyFieldRemove } from './classifiers/classify-field-remove';
import { classifyFieldUpdate } from './classifiers/classify-field-update';
import { classifyTypeAdd } from './classifiers/classify-type-add';
import { classifyTypeFlag } from './classifiers/classify-type-flag';
import { classifyTypeRemove } from './classifiers/classify-type-remove';
import { classifyUnsupported } from './classifiers/classify-unsupported';

export type Classifier<K extends ChangeKind> = (
    change: ChangeOf<K>,
    ctx: ClassifyContext
) => ClassifiedChange;

/** Exhaustive by type: a new change kind does not compile until it is classified. */
export const CLASSIFIERS: { readonly [K in ChangeKind]: Classifier<K> } = {
    'type.add': classifyTypeAdd,
    'type.remove': classifyTypeRemove,
    'type.meta': classifyCodeOnly,
    'type.flag': classifyTypeFlag,
    'field.add': classifyFieldAdd,
    'field.remove': classifyFieldRemove,
    'field.update': classifyFieldUpdate,
    'field.reorder': classifyCodeOnly,
    'field.rename': classifyUnsupported,
    'field.retype': classifyUnsupported
};
