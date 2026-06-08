import type { Socket } from "socket.io";
import { jwtVerify } from "jose";
import type { NextApiRequest } from "next";
import { getToken } from "next-auth/jwt";

export async function resolveSocketUser(
  socket: Socket,
  expectedProjectId?: string
): Promise<string | null> {
  const cached = (socket.data as { userId?: string }).userId;
  if (cached) return cached;

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  const authToken = socket.handshake.auth?.token as string | undefined;
  if (authToken) {
    try {
      const { payload } = await jwtVerify(
        authToken,
        new TextEncoder().encode(secret)
      );
      const userId = payload.sub;
      if (typeof userId !== "string") return null;
      if (
        expectedProjectId &&
        payload.projectId !== expectedProjectId
      ) {
        return null;
      }
      (socket.data as { userId?: string }).userId = userId;
      return userId;
    } catch {
      // fall through to session cookie
    }
  }

  const sessionToken = await getToken({
    req: {
      headers: { cookie: socket.handshake.headers.cookie ?? "" },
    } as NextApiRequest,
    secret,
    secureCookie: process.env.NODE_ENV === "production",
  });

  const userId = sessionToken?.id ?? sessionToken?.sub;
  if (typeof userId !== "string") return null;

  (socket.data as { userId?: string }).userId = userId;
  return userId;
}
