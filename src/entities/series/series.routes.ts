import { Elysia } from "elysia";
import { getSeriesById, listSeries } from "./series.controller";

export const seriesRoutes = new Elysia({ name: "series-routes" })
  .get("/v1/public/series", ({ request }) => listSeries(new URL(request.url)))
  .get("/v1/public/series/:id", ({ params }) => getSeriesById(params.id));
