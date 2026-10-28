import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { categoryMembers, fetchPages } from "../src/lib/fandom";
import { buildEntity } from "../src/lib/parse";
import type { Entity, EntityKind } from "../src/types";

const ENTITIES: EntityKind[] = [
  "characters",
  "comics",
  "creators",
  "events",
  "series",
  "stories",
];

const CATEGORIES: Record<EntityKind, string> = {
  characters: "Category:Characters",
  comics: "Category:Comics",
  creators: "Category:Creators",
  events: "Category:Events",
  series: "Category:Volumes",
  stories: "Category:Story Arcs",
};

const DATA_DIR = resolve(import.meta.dir, "..", "data");
const BATCH_SIZE = 50;
const CATEGORY_PAGE = 500;

interface Options {
  entities: EntityKind[];
  limit: number | null;
  resume: boolean;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    entities: ENTITIES,
    limit: null,
    resume: true,
  };

  for (const arg of argv) {
    if (arg.startsWith("--entity=")) {
      const value = arg.slice("--entity=".length);
      if (!ENTITIES.includes(value as EntityKind)) {
        throw new Error(`Unknown entity "${value}". Use one of: ${ENTITIES.join(", ")}`);
      }
      options.entities = [value as EntityKind];
    } else if (arg.startsWith("--limit=")) {
      options.limit = Number(arg.slice("--limit=".length));
    } else if (arg === "--fresh") {
      options.resume = false;
    }
  }

  return options;
}

async function existingIds(kind: EntityKind): Promise<Set<number>> {
  const dir = join(DATA_DIR, kind);
  try {
    const files = await readdir(dir);
    return new Set(
      files
        .filter((file) => file.endsWith(".json"))
        .map((file) => Number(file.slice(0, -5)))
        .filter((id) => Number.isFinite(id)),
    );
  } catch {
    return new Set();
  }
}

async function saveEntities(kind: EntityKind, entities: Entity[]): Promise<number> {
  const dir = join(DATA_DIR, kind);
  await mkdir(dir, { recursive: true });

  let saved = 0;
  for (const entity of entities) {
    await writeFile(join(dir, `${entity.id}.json`), JSON.stringify(entity, null, 2), "utf8");
    saved++;
  }

  return saved;
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function scrapeKind(kind: EntityKind, options: Options): Promise<void> {
  const category = CATEGORIES[kind];
  const done = options.resume ? await existingIds(kind) : new Set<number>();
  const started = Date.now();

  let cursor: string | null = null;
  let visited = 0;
  let saved = 0;
  let failed = 0;

  console.log(`\n[${kind}] ${category} — already on disk: ${done.size}`);

  do {
    const page = await categoryMembers(category, {
      limit: CATEGORY_PAGE,
      ...(cursor ? { from: cursor } : {}),
    });

    const pending = page.members.filter((member) => !done.has(member.pageid));
    visited += page.members.length;

    for (const group of chunks(pending, BATCH_SIZE)) {
      const titles = group.map((member) => member.title);
      try {
        const pages = await fetchPages(titles);
        const entities = pages.map((raw) => buildEntity(kind, raw));
        saved += await saveEntities(kind, entities);
        failed += group.length - pages.length;
      } catch (error) {
        failed += group.length;
        console.error(
          `[${kind}] batch failed (${titles[0]}…):`,
          error instanceof Error ? error.message : error,
        );
      }

      if (options.limit !== null && saved >= options.limit) break;

      const elapsed = ((Date.now() - started) / 1000).toFixed(0);
      console.log(`[${kind}] seen=${visited} saved=${saved} failed=${failed} ${elapsed}s`);
    }

    cursor = page.next;
    if (options.limit !== null && saved >= options.limit) break;
    if (!page.members.length) break;
  } while (cursor);

  console.log(`[${kind}] done: saved=${saved} failed=${failed}`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  console.log(`Scraping: ${options.entities.join(", ")} -> ${DATA_DIR}`);

  for (const kind of options.entities) {
    await scrapeKind(kind, options);
  }

  console.log("\nAll done.");
}

await main();
