import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "./utils.js";

const authBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const { email, password } = authBody.parse(request.body);

    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing) {
      return reply.status(409).send({ error: "Email already registered" });
    }

    const passwordHash = await hashPassword(password);
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash })
      .returning({ id: users.id, email: users.email });

    const token = app.jwt.sign({ userId: user.id, email: user.email });
    return reply.status(201).send({ token, user: { id: user.id, email: user.email } });
  });

  app.post("/auth/login", async (request, reply) => {
    const { email, password } = authBody.parse(request.body);

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (!user) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const token = app.jwt.sign({ userId: user.id, email: user.email });
    return { token, user: { id: user.id, email: user.email } };
  });
}
