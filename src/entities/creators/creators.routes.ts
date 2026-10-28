import { Elysia } from "elysia";
import { getCreator, listCreators } from "./creators.controller";

export const creatorsRoutes = new Elysia({ name: "creators-routes" })
  .get("/v1/public/creators", ({ request }) => listCreators(new URL(request.url)))
  .get("/v1/public/creators/:id", ({ params }) => getCreator(params.id));
