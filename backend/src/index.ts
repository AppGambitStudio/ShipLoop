import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { env } from "./config.js";
import authPlugin from "./auth/plugin.js";
import { authRoutes } from "./auth/routes.js";
import { configRoutes } from "./routes/config.js";
import { assetRoutes } from "./routes/assets.js";
import { dumpRoutes } from "./routes/dumps.js";
import { approvalRoutes } from "./routes/approval.js";

const app = Fastify({ logger: true });

app.register(cors, { origin: env.FRONTEND_URL });
app.register(jwt, { secret: env.JWT_SECRET });
app.register(authPlugin);
app.register(authRoutes);
app.register(configRoutes);
app.register(assetRoutes);
app.register(dumpRoutes);
app.register(approvalRoutes);

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
