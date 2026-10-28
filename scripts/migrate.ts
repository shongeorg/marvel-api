import { SQL } from "bun";

const SCHEMA_URL = new URL("../src/db/schema.sql", import.meta.url);

function connect(): SQL {
  const url = process.env.NEON_DB;
  if (!url) {
    throw new Error(
      "NEON_DB is not set. Add it to .env (Bun loads .env automatically) before running migrations.",
    );
  }
  return new SQL(url);
}

async function main(): Promise<void> {
  const file = Bun.file(SCHEMA_URL);
  if (!(await file.exists())) {
    throw new Error(`Schema file not found: ${file.name ?? SCHEMA_URL.pathname}`);
  }

  const schema = await file.text();
  const statements = schema
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

  const sql = connect();

  try {
    const legacy = await sql<{ present: boolean }[]>`
      select exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'entities'
          and column_name = 'resource'
      ) as present
    `;
    if (legacy[0]?.present) {
      console.log("Dropping legacy entities table (old `resource` column).");
      await sql.unsafe("drop table entities");
    }

    for (const statement of statements) {
      await sql.unsafe(statement);
    }

    console.log(`Applied ${statements.length} statement(s) from src/db/schema.sql`);

    const columns = await sql<
      { column_name: string; data_type: string; is_nullable: string }[]
    >`
      select column_name, data_type, is_nullable
      from information_schema.columns
      where table_schema = 'public' and table_name = 'entities'
      order by ordinal_position
    `;

    console.log("entities columns:");
    for (const column of columns) {
      console.log(
        `  ${column.column_name} ${column.data_type}${column.is_nullable === "NO" ? " not null" : ""}`,
      );
    }

    const counts = await sql<{ count: number }[]>`
      select count(*)::int as count from entities
    `;
    console.log(`entities rows: ${counts[0]?.count ?? 0}`);
  } finally {
    await sql.close();
  }
}

await main();
