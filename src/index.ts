import { Elysia } from "elysia";
import { apiRoutes } from "./routes";
import { sendNotFound, sendServerError } from "./shared/http";

const app = new Elysia()
  .use(apiRoutes)
  .onError(({ code }) => {
    if (code === "NOT_FOUND") {
      return sendNotFound("Route not found");
    }

    return sendServerError();
  });

if (process.env.VERCEL !== "1") {
  app.listen(Number(process.env.PORT ?? 4444));
}

export default app;
