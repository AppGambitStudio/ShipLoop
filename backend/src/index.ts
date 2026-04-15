import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./config.js";

const app = Fastify({ logger: true });

app.register(cors, { origin: env.FRONTEND_URL });

app.get("/health", async () => ({
  status: "ok",
  timestamp: new Date().toISOString(),
}));

app.listen({ port: env.BACKEND_PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`ShipLoop backend running at ${address}`);
});
