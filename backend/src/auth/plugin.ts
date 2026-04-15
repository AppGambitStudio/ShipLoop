import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    userId: string;
  }
}

async function authPlugin(app: FastifyInstance) {
  app.decorate(
    "authenticate",
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        const decoded = await request.jwtVerify<{ userId: string; email: string }>();
        request.userId = decoded.userId;
      } catch (err) {
        reply.status(401).send({ error: "Unauthorized" });
      }
    }
  );
}

export default fp(authPlugin);
