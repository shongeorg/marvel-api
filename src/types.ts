export type EntityKind =
  | "characters"
  | "comics"
  | "creators"
  | "events"
  | "series"
  | "stories";

export interface Thumbnail {
  path: string;
  extension: string;
}
export interface Entity {
  id: number;
  kind: EntityKind;
  slug: string;
  name: string;
  description: string | null;
  thumbnail: Thumbnail | null;
  modified: string | null;
  sourceUrl: string;
  data: Record<string, unknown>;
}
export type EntitySummary = Omit<Entity, "data">;

export interface PaginatedResult<T> {
  results: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
