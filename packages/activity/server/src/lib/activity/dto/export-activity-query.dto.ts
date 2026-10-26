import { OmitType } from '@nestjs/swagger';
import { ListActivityQueryDto } from './list-activity-query.dto';

/**
 * Query parameters for `GET /api/activity/export` — every filter, search and
 * sort the list accepts, and **no paging**: the export is "the current view",
 * the same question `GET /api/activity` answers a page at a time, in one file
 * capped at `EXPORT_MAX_ROWS`.
 *
 * Derived from the list DTO rather than restated, so a filter added to the log
 * is exportable the day it ships — an export that quietly ignored a filter the
 * page applied would hand an auditor more than they were shown, which is the
 * one direction an audit export must never err in.
 */
export class ExportActivityQueryDto extends OmitType(ListActivityQueryDto, [
    'page',
    'pageSize'
] as const) {}
