import { Elysia } from "elysia";
import { getEvent, listEvents } from "./events.controller";

export const eventsRoutes = new Elysia({ name: "events-routes" })
  .get("/v1/public/events", ({ request }) => listEvents(new URL(request.url)))
  .get("/v1/public/events/:id", ({ params }) => getEvent(params.id));
