import { handle } from "hono/vercel";
import app from "@/server/app";

export const runtime = "nodejs";

const honoHandler = handle(app);

function handler(request: Request) {
  const hasBody =
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    request.body !== null;

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers: new Headers(request.headers),
    signal: request.signal,
  };

  if (hasBody) {
    init.body = request.body;
    init.duplex = "half";
  }

  const plainRequest = new Request(request.url, init);

  return honoHandler(plainRequest);
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
