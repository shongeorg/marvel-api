import { Elysia } from "elysia";
import { getStory, listStories } from "./stories.controller";

export const storiesRoutes = new Elysia({ name: "stories-routes" })
  .get("/v1/public/stories", ({ request }) => listStories(new URL(request.url)))
  .get("/v1/public/stories/:id", ({ params }) => getStory(params.id));
