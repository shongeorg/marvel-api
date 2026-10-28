export const API_URL = "https://marvel.fandom.com/api.php";

const USER_AGENT = "marvel-api-local/1.0";
const MAX_BATCH_SIZE = 50;
const MAX_CATEGORY_LIMIT = 500;
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS = [500, 1500, 4000];

export interface CategoryMember {
  pageid: number;
  title: string;
}

export interface RawPage {
  pageid: number;
  title: string;
  wikitext: string;
  modified: string | null;
  thumbnail: string | null;
}

interface ApiCategoryMember {
  pageid?: number;
  title?: string;
}

interface ApiPage {
  pageid?: number;
  title?: string;
  missing?: unknown;
  invalid?: unknown;
  thumbnail?: { source?: string };
  revisions?: Array<{
    timestamp?: string;
    slots?: { main?: { content?: string; "*"?: string } };
  }>;
}

interface ApiResponse {
  query?: {
    categorymembers?: ApiCategoryMember[];
    pages?: ApiPage[];
  };
  continue?: { cmcontinue?: string };
  error?: { code?: string; info?: string };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUrl(params: Record<string, string>): string {
  const url = new URL(API_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function errorMessage(status: number, statusText: string, body: string): string {
  const snippet = body.replace(/\s+/g, " ").trim().slice(0, 200);
  return `Fandom API request failed: HTTP ${status}${statusText ? ` ${statusText}` : ""}${
    snippet ? ` - ${snippet}` : ""
  }`;
}

async function request(params: Record<string, string>): Promise<ApiResponse> {
  const url = buildUrl(params);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
      });
    } catch (error) {
      lastError = new Error(
        `Fandom API request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (attempt < RETRY_DELAYS.length) {
        await sleep(RETRY_DELAYS[attempt]!);
        continue;
      }
      break;
    }

    if (response.ok) {
      const data = (await response.json()) as ApiResponse;
      if (data.error) {
        throw new Error(
          `Fandom API error${data.error.code ? ` (${data.error.code})` : ""}: ${
            data.error.info ?? "unknown error"
          }`,
        );
      }
      return data;
    }

    const body = await response.text().catch(() => "");
    if (!RETRY_STATUSES.has(response.status)) {
      throw new Error(errorMessage(response.status, response.statusText, body));
    }

    lastError = new Error(errorMessage(response.status, response.statusText, body));
    if (attempt < RETRY_DELAYS.length) {
      await sleep(RETRY_DELAYS[attempt]!);
    }
  }

  throw new Error(
    `Fandom API request failed after ${RETRY_DELAYS.length + 1} attempts: ${
      lastError?.message ?? "unknown error"
    }`,
  );
}

export async function categoryMembers(
  category: string,
  opts: { limit?: number; from?: string } = {},
): Promise<{ members: CategoryMember[]; next: string | null }> {
  const requested = opts.limit ?? MAX_CATEGORY_LIMIT;
  const limit = Math.min(
    Math.max(Number.isFinite(requested) ? Math.trunc(requested) : MAX_CATEGORY_LIMIT, 1),
    MAX_CATEGORY_LIMIT,
  );

  const params: Record<string, string> = {
    action: "query",
    list: "categorymembers",
    cmtitle: category,
    cmlimit: String(limit),
    cmtype: "page",
    format: "json",
    formatversion: "2",
  };
  if (opts.from) params.cmcontinue = opts.from;

  const data = await request(params);

  const members: CategoryMember[] = [];
  for (const member of data.query?.categorymembers ?? []) {
    if (typeof member.pageid !== "number" || typeof member.title !== "string") continue;
    members.push({ pageid: member.pageid, title: member.title });
  }

  return { members, next: data.continue?.cmcontinue ?? null };
}

function toRawPage(page: ApiPage): RawPage | null {
  if (page.missing !== undefined || page.invalid !== undefined) return null;
  if (typeof page.pageid !== "number" || typeof page.title !== "string") return null;

  const revision = page.revisions?.[0];
  const wikitext = revision?.slots?.main?.content ?? revision?.slots?.main?.["*"];
  if (typeof wikitext !== "string") return null;

  let modified: string | null = null;
  const timestamp = revision?.timestamp;
  if (typeof timestamp === "string" && timestamp) {
    const parsed = new Date(timestamp);
    modified = Number.isNaN(parsed.getTime()) ? timestamp : parsed.toISOString();
  }

  const thumbnail = typeof page.thumbnail?.source === "string" ? page.thumbnail.source : null;

  return {
    pageid: page.pageid,
    title: page.title,
    wikitext,
    modified,
    thumbnail,
  };
}

export async function fetchPages(titles: string[]): Promise<RawPage[]> {
  const unique = [...new Set(titles.map((title) => title.trim()).filter(Boolean))];
  const pages: RawPage[] = [];

  for (let index = 0; index < unique.length; index += MAX_BATCH_SIZE) {
    const batch = unique.slice(index, index + MAX_BATCH_SIZE);
    const data = await request({
      action: "query",
      prop: "revisions|pageimages",
      rvprop: "content|timestamp",
      rvslots: "main",
      piprop: "thumbnail",
      pithumbsize: "400",
      format: "json",
      formatversion: "2",
      titles: batch.join("|"),
    });

    for (const page of data.query?.pages ?? []) {
      const raw = toRawPage(page);
      if (raw) pages.push(raw);
    }
  }

  return pages;
}
