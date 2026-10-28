import type { Entity, EntityKind } from "../types";
import type { RawPage } from "./fandom";

const DESCRIPTION_LENGTH = 4000;

const NAME_PARAM: Record<EntityKind, string> = {
  characters: "Name",
  creators: "Name",
  comics: "Title",
  series: "Title",
  events: "Title",
  stories: "Title",
};

const DESCRIPTION_PARAMS: Record<EntityKind, string[]> = {
  characters: ["History", "Description"],
  comics: ["Synopsis1", "Synopsis", "Synopsis2", "Description"],
  events: ["Synopsis", "History", "Description", "Notes"],
  series: ["Synopsis", "History", "Description"],
  stories: ["Synopsis", "History", "Description"],
  creators: ["Description", "Notes"],
};

function stripTemplates(input: string): string {
  let output = "";
  let index = 0;

  while (index < input.length) {
    if (input.startsWith("{{", index)) {
      let depth = 0;
      let cursor = index;
      while (cursor < input.length) {
        if (input.startsWith("{{", cursor)) {
          depth++;
          cursor += 2;
        } else if (input.startsWith("}}", cursor)) {
          depth--;
          cursor += 2;
          if (depth === 0) break;
        } else {
          cursor++;
        }
      }
      index = cursor;
      continue;
    }

    output += input[index];
    index++;
  }

  return output;
}

export function cleanWiki(value: string): string {
  if (typeof value !== "string" || value.length === 0) return "";

  let text = value;

  text = text.replace(/<!--[\s\S]*?-->/g, " ");
  text = text.replace(/<ref[^>]*\/>/gi, " ");
  text = text.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, " ");
  text = stripTemplates(text);
  text = text.replace(/\{\|[\s\S]*?\|\}/g, " ");
  text = text.replace(/<gallery[^>]*>[\s\S]*?<\/gallery>/gi, " ");
  text = text.replace(/\[\[:(?:Category|File|Image):[^\[\]]*\]\]/gi, " ");
  text = text.replace(/\[\[(?:Category|File|Image):[^\[\]]*\]\]/gi, " ");
  text = text.replace(/\[\[([^\[\]|]*)\|([^\[\]]*)\]\]/g, "$2");
  text = text.replace(/\[\[([^\[\]]*)\]\]/g, "$1");
  text = text.replace(/'''/g, "").replace(/''/g, "");
  text = text.replace(/={2,}\s*([^=\n]*?)\s*={2,}/g, "$1");
  text = text.replace(/__[A-Z]+__/g, " ");
  text = text.replace(/<[^>]*>/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/\(\s*from [^)]*\)/gi, "").replace(/\(\s*\)/g, "").trim();

  return text;
}

function splitTopLevel(value: string, separator: string): string[] {
  const parts: string[] = [];
  let current = "";
  let templateDepth = 0;
  let linkDepth = 0;

  for (let index = 0; index < value.length; index++) {
    const pair = value.slice(index, index + 2);

    if (pair === "{{") {
      templateDepth++;
      current += pair;
      index++;
      continue;
    }
    if (pair === "}}") {
      if (templateDepth > 0) templateDepth--;
      current += pair;
      index++;
      continue;
    }
    if (pair === "[[") {
      linkDepth++;
      current += pair;
      index++;
      continue;
    }
    if (pair === "]]") {
      if (linkDepth > 0) linkDepth--;
      current += pair;
      index++;
      continue;
    }

    if (value[index] === separator && templateDepth === 0 && linkDepth === 0) {
      parts.push(current);
      current = "";
      continue;
    }

    current += value[index];
  }

  parts.push(current);
  return parts;
}

export function parseTemplate(wikitext: string): {
  template: string | null;
  params: Record<string, string>;
} {
  if (typeof wikitext !== "string" || wikitext.length === 0) {
    return { template: null, params: {} };
  }

  const start = wikitext.indexOf("{{");
  if (start === -1) return { template: null, params: {} };

  let depth = 0;
  let close = -1;
  for (let index = start; index < wikitext.length; index++) {
    if (wikitext.startsWith("{{", index)) {
      depth++;
      index++;
      continue;
    }
    if (wikitext.startsWith("}}", index)) {
      depth--;
      index++;
      if (depth === 0) {
        close = index;
        break;
      }
    }
  }

  const inner = close === -1 ? wikitext.slice(start + 2) : wikitext.slice(start + 2, close - 1);
  const parts = splitTopLevel(inner, "|");
  const template = (parts[0] ?? "").trim();
  const params: Record<string, string> = {};

  for (const part of parts.slice(1)) {
    const equals = part.indexOf("=");
    if (equals === -1) continue;
    const key = part.slice(0, equals).trim();
    if (!key) continue;
    params[key] = part.slice(equals + 1);
  }

  return { template: template || null, params };
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const result = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return result.trim();
}

function stripDisambiguation(title: string): string {
  return title.replace(/\s*\((?:Earth-[^)]*|Legion Personality)\)\s*$/i, "").trim();
}

function toAliases(raw: string): string[] {
  const seen = new Set<string>();
  const aliases: string[] = [];

  for (const piece of raw.split(/[\n\r]+|\*/)) {
    const cleaned = cleanWiki(piece);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    aliases.push(cleaned);
  }

  return aliases;
}

function toThumbnail(url: string | null): { path: string; extension: string } | null {
  if (typeof url !== "string" || url.length === 0) return null;

  let clean = url.split("?")[0] ?? url;
  const revision = clean.indexOf("/revision/");
  if (revision > 0) clean = clean.slice(0, revision);

  const dot = clean.lastIndexOf(".");
  if (dot <= 0) return { path: clean, extension: "" };

  return { path: clean.slice(0, dot), extension: clean.slice(dot + 1).toLowerCase() };
}

function extractUniverse(params: Record<string, string>): string {
  const raw = params.Reality ?? params.Universe ?? "";
  const match = /Earth-[A-Za-z0-9]+/i.exec(raw);
  if (match) return match[0];
  return cleanWiki(raw);
}

export function buildEntity(kind: EntityKind, page: RawPage): Entity {
  const title = typeof page?.title === "string" ? page.title : "";
  const pageid = typeof page?.pageid === "number" ? page.pageid : 0;
  const sourceUrl = `https://marvel.fandom.com/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  const modified = typeof page?.modified === "string" ? page.modified : null;

  const fallback: Entity = {
    id: pageid,
    kind,
    slug: title,
    name: title,
    description: null,
    thumbnail: null,
    modified,
    sourceUrl,
    data: {},
  };

  try {
    const wikitext = typeof page?.wikitext === "string" ? page.wikitext : "";
    const { template, params } = parseTemplate(wikitext);

    const nameParam = NAME_PARAM[kind];
    const rawName = nameParam ? params[nameParam] : undefined;
    const name = cleanWiki(rawName ?? "") || stripDisambiguation(title) || title;

    let rawDescription = "";
    const descriptionKeys = [...(DESCRIPTION_PARAMS[kind] ?? ["Description"])];
    if (template === "Disambiguation") descriptionKeys.unshift("description");
    for (const key of descriptionKeys) {
      const candidate = cleanWiki(params[key] ?? "");
      if (candidate) {
        rawDescription = candidate;
        break;
      }
    }

    const description = rawDescription
      ? truncate(rawDescription, DESCRIPTION_LENGTH) || null
      : null;

    const thumbnailUrl = typeof page?.thumbnail === "string" ? page.thumbnail : null;
    const thumbnail = toThumbnail(thumbnailUrl);

    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      data[key] = cleanWiki(value);
    }
    data.template = template;
    data.universe = extractUniverse(params);
    data.aliases = toAliases(`${params.CurrentAlias ?? ""}\n${params.Aliases ?? ""}`);
    data.creators = cleanWiki(params.Creators ?? "");
    data.firstAppearance = cleanWiki(params.First ?? "");
    data.image = thumbnailUrl;

    return {
      id: pageid,
      kind,
      slug: title,
      name: name || title,
      description,
      thumbnail,
      modified,
      sourceUrl,
      data,
    };
  } catch {
    return fallback;
  }
}
