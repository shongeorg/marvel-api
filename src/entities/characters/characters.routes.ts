import { Elysia } from "elysia";
import { getCharacter, listCharacters } from "./characters.controller";

export const charactersRoutes = new Elysia({ name: "characters-routes" })
  .get("/v1/public/characters", ({ request }) => listCharacters(new URL(request.url)))
  .get("/v1/public/characters/:id", ({ params }) => getCharacter(params.id));
