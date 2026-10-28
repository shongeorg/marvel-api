import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { closeDb, upsertEntities } from "../src/db/client";
import type { Entity, EntityKind } from "../src/types";

const ENTITIES: EntityKind[] = [
  "characters",
  "comics",
  "creators",
  "events",
  "series",
  "stories",
];

const BATCH_SIZE = 500;
const DATA_ROOT = join(import.meta.dir, "..", "data");

interface Summary {
  files: number;
  seeded: number;
  skipped: number;
}

function parseKindArg(): EntityKind | null {
  const arg = process.argv.find(
    (value) => value.startsWith("--entity=") || value.startsWith("--resource="),
  );
  if (!arg) return null;

  const value = arg.slice(arg.indexOf("=") + 1).trim();
  if (!ENTITIES.includes(value as EntityKind)) {
    throw new Error(`Unknown entity "${value}". Expected one of: ${ENTITIES.join(", ")}.`);
  }
  return value as EntityKind;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toEntity(value: unknown, kind: EntityKind): Entity | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "number" || !Number.isFinite(value.id)) return null;
  if (typeof value.name !== "string" || value.name.length === 0) return null;

  const thumbnail =
    isRecord(value.thumbnail) &&
    typeof value.thumbnail.path === "string" &&
    typeof value.thumbnail.extension === "string"
      ? { path: value.thumbnail.path, extension: value.thumbnail.extension }
      : null;

  return {
    id: value.id,
    kind,
    slug: typeof value.slug === "string" ? value.slug : value.name,
    name: value.name,
    description: typeof value.description === "string" ? value.description : null,
    thumbnail,
    modified: typeof value.modified === "string" ? value.modified : null,
    sourceUrl: typeof value.sourceUrl === "string" ? value.sourceUrl : "",
    data: isRecord(value.data) ? value.data : {},
  };
}

async function listJsonFiles(dir: string): Promise<string[] | null> {
  try {
    const entries = await readdir(dir);
    return entries
      .filter((entry) => entry.toLowerCase().endsWith(".json"))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function seedKind(kind: EntityKind): Promise<Summary> {
  const dir = join(DATA_ROOT, kind);
  const summary: Summary = { files: 0, seeded: 0, skipped: 0 };

  const files = await listJsonFiles(dir);
  if (files === null) {
    console.log(`${kind}: no data directory, skipping`);
    return summary;
  }
  if (files.length === 0) {
    console.log(`${kind}: no json files, skipping`);
    return summary;
  }

  const total = files.length;
  summary.files = total;

  let batch: Entity[] = [];

  const flush = async (): Promise<void> => {
    if (batch.length === 0) return;
    await upsertEntities(batch);
    batch = [];
  };

  for (const [index, fileName] of files.entries()) {
    const path = join(dir, fileName);

    let parsed: unknown;
    try {
      parsed = await Bun.file(path).json();
    } catch (error) {
      console.warn(`${kind}: ${fileName}: invalid JSON (${(error as Error).message})`);
      summary.skipped += 1;
      continue;
    }

    const entity = toEntity(parsed, kind);
    if (entity === null) {
      console.warn(`${kind}: ${fileName}: missing or invalid id/name, skipped`);
      summary.skipped += 1;
      continue;
    }

    batch.push(entity);
    summary.seeded += 1;

    if (batch.length >= BATCH_SIZE) {
      await flush();
      console.log(`${kind}: ${index + 1}/${total}`);
    }
  }

  await flush();
  console.log(`${kind}: ${total}/${total}`);

  return summary;
}

async function main(): Promise<void> {
  const only = parseKindArg();
  const targets = only ? [only] : ENTITIES;
  const summaries = new Map<EntityKind, Summary>();

  for (const kind of targets) {
    summaries.set(kind, await seedKind(kind));
  }

  const rows = [...summaries.entries()];
  const totalFiles = rows.reduce((sum, [, summary]) => sum + summary.files, 0);
  const totalSeeded = rows.reduce((sum, [, summary]) => sum + summary.seeded, 0);
  const totalSkipped = rows.reduce((sum, [, summary]) => sum + summary.skipped, 0);

  console.log("--- seed summary ---");
  for (const [kind, summary] of rows) {
    console.log(
      `${kind}: files=${summary.files} seeded=${summary.seeded} skipped=${summary.skipped}`,
    );
  }
  console.log(`total: files=${totalFiles} seeded=${totalSeeded} skipped=${totalSkipped}`);
}

try {
  await main();
} finally {
  await closeDb();
}
