import type { EntityKind, PaginatedResult } from "../types";
import { parsePositiveInt } from "./http";

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export type PageParams =
  | { ok: true; page: number; limit: number }
  | { ok: false; message: string };

export interface Page<T> extends PaginatedResult<T> {
  kind: EntityKind;
}
export function readPageParams(url: URL): PageParams {
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  if (page === null) {
    return { ok: false, message: 'Query parameter "page" must be a positive integer' };
  }

  const limit = parsePositiveInt(url.searchParams.get("limit"), DEFAULT_LIMIT);
  if (limit === null) {
    return { ok: false, message: 'Query parameter "limit" must be a positive integer' };
  }

  return { ok: true, page, limit: Math.min(limit, MAX_LIMIT) };
}

export function readSearch(url: URL): string | undefined {
  return url.searchParams.get("search")?.trim() || undefined;
}

export function buildPage<T>(
  kind: EntityKind,
  results: T[],
  page: number,
  limit: number,
  total: number,
): Page<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    kind,
    results,
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
