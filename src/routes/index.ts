import { Elysia } from "elysia";
import { charactersRoutes } from "../entities/characters/characters.routes";
import { comicsRoutes } from "../entities/comics/comics.routes";
import { creatorsRoutes } from "../entities/creators/creators.routes";
import { eventsRoutes } from "../entities/events/events.routes";
import { seriesRoutes } from "../entities/series/series.routes";
import { storiesRoutes } from "../entities/stories/stories.routes";
import { CORS } from "../shared/http";
import { systemRoutes } from "./system.routes";

export const apiRoutes = new Elysia({ name: "api-routes" })
  .onRequest(({ request }) => {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
  })
  .use(systemRoutes)
  .use(charactersRoutes)
  .use(comicsRoutes)
  .use(creatorsRoutes)
  .use(eventsRoutes)
  .use(seriesRoutes)
  .use(storiesRoutes);
