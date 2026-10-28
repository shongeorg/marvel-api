import { Elysia } from "elysia";
import { counts } from "../db/client";
import { sendJson, sendServerError } from "../shared/http";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../shared/pagination";

const ENDPOINTS = {
  characters: {
    list: "/v1/public/characters?page=1&limit=20&search=",
    detail: "/v1/public/characters/:id",
  },
  comics: {
    list: "/v1/public/comics?page=1&limit=20&search=",
    detail: "/v1/public/comics/:id",
  },
  creators: {
    list: "/v1/public/creators?page=1&limit=20&search=",
    detail: "/v1/public/creators/:id",
  },
  events: {
    list: "/v1/public/events?page=1&limit=20&search=",
    detail: "/v1/public/events/:id",
  },
  series: {
    list: "/v1/public/series?page=1&limit=20&search=",
    detail: "/v1/public/series/:id",
  },
  stories: {
    list: "/v1/public/stories?page=1&limit=20&search=",
    detail: "/v1/public/stories/:id",
  },
};

export const systemRoutes = new Elysia({ name: "system-routes" })
  .get("/", async () => {
    try {
      const totals = await counts();

      return sendJson(
        {
          name: "Marvel API (local)",
          version: "1.0.0",
          pagination: {
            page: { default: 1, min: 1 },
            limit: { default: DEFAULT_LIMIT, max: MAX_LIMIT },
          },
          endpoints: ENDPOINTS,
          counts: totals,
        },
        200,
        { "Cache-Control": "public, max-age=60" },
      );
    } catch {
      return sendServerError();
    }
  })
  .get("/health", () =>
    sendJson(
      { status: "ok", uptime: Number(process.uptime().toFixed(3)) },
      200,
      { "Cache-Control": "public, max-age=60" },
    ),
  );
