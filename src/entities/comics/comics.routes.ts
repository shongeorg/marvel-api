import { Elysia } from "elysia";
import { getComic, listComics } from "./comics.controller";

export const comicsRoutes = new Elysia({ name: "comics-routes" })
  .get("/v1/public/comics", ({ request }) => listComics(new URL(request.url)))
  .get("/v1/public/comics/:id", ({ params }) => getComic(params.id));
