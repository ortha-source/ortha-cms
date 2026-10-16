// @orthacms-generated — the content manifest. Do not edit by hand.
//
// Regenerate it with `orthacms content sync` (in this monorepo:
// `npx nx run server:content:sync`) after adding, renaming or removing a file
// under collections/ or pages/. The schema builder rewrites it on every apply.
//
// Two readers: plugins.ts registers `contentTypes` with ContentPlugin, and
// drizzle-kit diffs every top-level table export below into migrations.

import {
    contentEntryRevisions,
    joinTableOf,
    type AnyContentType
} from '@orthacms/content-server/define';
import { field_boolean } from './collections/field_boolean';
import { field_date } from './collections/field_date';
import { field_defaults } from './collections/field_defaults';
import { field_json } from './collections/field_json';
import { field_layout } from './collections/field_layout';
import { field_media } from './collections/field_media';
import { field_number } from './collections/field_number';
import { field_richtext } from './collections/field_richtext';
import { field_select } from './collections/field_select';
import { field_text } from './collections/field_text';
import { flags_all } from './collections/flags_all';
import { flags_none } from './collections/flags_none';
import { flags_paranoid } from './collections/flags_paranoid';
import { flags_publishable } from './collections/flags_publishable';
import { i18n_fields } from './collections/i18n_fields';
import { i18n_relations } from './collections/i18n_relations';
import { i18n_target } from './collections/i18n_target';
import { rel_many_to_many } from './collections/rel_many_to_many';
import { rel_many_to_one } from './collections/rel_many_to_one';
import { rel_one_to_one } from './collections/rel_one_to_one';
import { rel_self } from './collections/rel_self';
import { rel_target } from './collections/rel_target';
import { scenario_review_off } from './collections/scenario_review_off';
import { scenario_review_one } from './collections/scenario_review_one';
import { scenario_review_two } from './collections/scenario_review_two';
import { scenario_sibling_sync } from './collections/scenario_sibling_sync';
import { single_i18n } from './pages/single_i18n';
import { single_plain } from './pages/single_plain';

/** Every content type registered with ContentPlugin. */
export const contentTypes: readonly AnyContentType[] = [
    field_boolean,
    field_date,
    field_defaults,
    field_json,
    field_layout,
    field_media,
    field_number,
    field_richtext,
    field_select,
    field_text,
    flags_all,
    flags_none,
    flags_paranoid,
    flags_publishable,
    i18n_fields,
    i18n_relations,
    i18n_target,
    rel_many_to_many,
    rel_many_to_one,
    rel_one_to_one,
    rel_self,
    rel_target,
    scenario_review_off,
    scenario_review_one,
    scenario_review_two,
    scenario_sibling_sync,
    single_i18n,
    single_plain
];

/* Main tables — one `content_<name>` per type. */
export const fieldBooleanTable = field_boolean.table;
export const fieldDateTable = field_date.table;
export const fieldDefaultsTable = field_defaults.table;
export const fieldJsonTable = field_json.table;
export const fieldLayoutTable = field_layout.table;
export const fieldMediaTable = field_media.table;
export const fieldNumberTable = field_number.table;
export const fieldRichtextTable = field_richtext.table;
export const fieldSelectTable = field_select.table;
export const fieldTextTable = field_text.table;
export const flagsAllTable = flags_all.table;
export const flagsNoneTable = flags_none.table;
export const flagsParanoidTable = flags_paranoid.table;
export const flagsPublishableTable = flags_publishable.table;
export const i18nFieldsTable = i18n_fields.table;
export const i18nRelationsTable = i18n_relations.table;
export const i18nTargetTable = i18n_target.table;
export const relManyToManyTable = rel_many_to_many.table;
export const relManyToOneTable = rel_many_to_one.table;
export const relOneToOneTable = rel_one_to_one.table;
export const relSelfTable = rel_self.table;
export const relTargetTable = rel_target.table;
export const scenarioReviewOffTable = scenario_review_off.table;
export const scenarioReviewOneTable = scenario_review_one.table;
export const scenarioReviewTwoTable = scenario_review_two.table;
export const scenarioSiblingSyncTable = scenario_sibling_sync.table;
export const singleI18nTable = single_i18n.table;
export const singlePlainTable = single_plain.table;

/* Join tables — one per many-relation. `joinTableOf` throws if one is gone. */
export const i18nRelationsMirroredManyJoinTable = joinTableOf(
    i18n_relations,
    'mirrored_many'
);
export const relManyToManyManyJoinTable = joinTableOf(rel_many_to_many, 'many');
export const relSelfRelatedJoinTable = joinTableOf(rel_self, 'related');

/* The revision store — one fixed table, owned by content-server. */
export const contentEntryRevisionsTable = contentEntryRevisions;
