import { SQL } from "bun";
import type { Entity, EntityKind, EntitySummary, Thumbnail } from "../types";

const UPSERT_CHUNK_SIZE = 500;

const ENTITY_COLUMNS = [
  "kind",
  "id",
  "slug",
  "name",
  "description",
  "thumbnail",
  "modified",
  "source_url",
  "data",
] as const;

interface EntityRow {
  kind: EntityKind;
  id: number | string | bigint;
  slug: string;
  name: string;
  description: string | null;
  thumbnail: unknown;
  modified: Date | string | null;
  source_url: string;
  data: unknown;
}

type SummaryRow = Omit<EntityRow, "data">;

let db: SQL | null = null;

function getDb(): SQL {
  if (db) return db;

  const url = process.env.NEON_DB;
  if (!url) {
    throw new Error(
      "NEON_DB is not set. Add it to .env (Bun loads .env automatically) before using the database.",
    );
  }

  db = new SQL(url);
  return db;
}

function parseJson(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  return value;
}

function toIsoString(value: Date | string | null): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function mapSummary(row: SummaryRow): EntitySummary {
  const thumbnail = parseJson(row.thumbnail) as Thumbnail | null;

  return {
    id: Number(row.id),
    kind: row.kind,
    slug: row.slug,
    name: row.name,
    description: row.description,
    thumbnail: thumbnail ?? null,
    modified: toIsoString(row.modified),
    sourceUrl: row.source_url,
  };
}

function mapEntity(row: EntityRow): Entity {
  const data = parseJson(row.data) as Record<string, unknown> | null;

  return {
    ...mapSummary(row),
    data: data ?? {},
  };
}

export async function listEntities(opts: {
  kind: EntityKind;
  page: number;
  limit: number;
  search?: string;
}): Promise<{ results: EntitySummary[]; total: number }> {
  const sql = getDb();

  const page = Number.isFinite(opts.page) ? Math.max(1, Math.trunc(opts.page)) : 1;
  const limit = Number.isFinite(opts.limit) ? Math.max(1, Math.trunc(opts.limit)) : 20;
  const offset = (page - 1) * limit;
  const search = opts.search?.trim() ? opts.search.trim() : null;

  const filter = search
    ? sql`where kind = ${opts.kind} and lower(name) like '%' || lower(${search}) || '%'`
    : sql`where kind = ${opts.kind}`;

  const [countRows, pageRows] = await Promise.all([
    sql<{ total: number }[]>`
      select count(*)::int as total from entities ${filter}
    `,
    sql<SummaryRow[]>`
      select kind, id, slug, name, description, thumbnail, modified, source_url
      from entities
      ${filter}
      order by lower(name), id
      limit ${limit} offset ${offset}
    `,
  ]);

  return {
    results: pageRows.map(mapSummary),
    total: countRows[0]?.total ?? 0,
  };
}

export async function getEntity(kind: EntityKind, id: number): Promise<Entity | null> {
  const sql = getDb();

  const rows = await sql<EntityRow[]>`
    select kind, id, slug, name, description, thumbnail, modified, source_url, data
    from entities
    where kind = ${kind} and id = ${id}
    limit 1
  `;

  const row = rows[0];
  return row ? mapEntity(row) : null;
}

export async function upsertEntities(rows: Entity[]): Promise<number> {
  if (rows.length === 0) return 0;

  const sql = getDb();

  for (let start = 0; start < rows.length; start += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(start, start + UPSERT_CHUNK_SIZE);

    const values = chunk.map((entity) => ({
      kind: entity.kind,
      id: entity.id,
      slug: entity.slug,
      name: entity.name,
      description: entity.description,
      thumbnail: entity.thumbnail,
      modified: entity.modified,
      source_url: entity.sourceUrl,
      data: entity.data,
    }));

    await sql`
      insert into entities ${sql(values, ...ENTITY_COLUMNS)}
      on conflict (kind, id) do update set
        slug = excluded.slug,
        name = excluded.name,
        description = excluded.description,
        thumbnail = excluded.thumbnail,
        modified = excluded.modified,
        source_url = excluded.source_url,
        data = excluded.data,
        updated_at = now()
    `;
  }

  return rows.length;
}

export async function counts(): Promise<Record<string, number>> {
  const sql = getDb();

  const rows = await sql<{ kind: string; count: number }[]>`
    select kind, count(*)::int as count from entities group by kind
  `;

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.kind] = Number(row.count);
  }
  return result;
}

export async function closeDb(): Promise<void> {
  if (!db) return;

  const instance = db;
  db = null;
  await instance.close();
}
