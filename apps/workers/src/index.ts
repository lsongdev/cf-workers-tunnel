import { Hono, type Context } from "hono";
import {
  buildPublicUrl,
  normalizeSubdomain,
  TUNNELS_API_PATH,
  type CreateTunnelRequest,
  type CreateTunnelResponse,
} from "@hostc/tunnel-protocol";
import { HostcDurableObject } from "./durable/tunnel";
import { buildTunnelWebSocketUrl, createRandomTunnelId, extractTunnelSubdomain } from "./lib/tunnels";

type AppEnv = {
  Bindings: Env;
};

type InternalCreateTunnelResponse = {
  tunnelId: string;
  subdomain: string;
  connectToken: string;
};

const INTERNAL_CREATE_PATH = "/_internal/create";
const INTERNAL_CONNECT_PATH = "/_internal/connect";

const app = new Hono<AppEnv>();

app.onError((error, c) => {
  console.error(
    JSON.stringify({
      event: "worker.unhandled_error",
      error: error.message,
      path: new URL(c.req.url).pathname,
    }),
  );

  return c.json(
    {
      error: "Internal server error",
    },
    500,
  );
});

app.post(TUNNELS_API_PATH, async (c) => {
  const body = await readCreateTunnelRequest(c.req.raw);

  if (body.subdomain !== undefined && !normalizeSubdomain(body.subdomain)) {
    return c.json(
      {
        error: "Invalid subdomain",
      },
      400,
    );
  }

  const subdomain = normalizeSubdomain(body.subdomain ?? "") ?? createRandomTunnelId();
  const tunnelId = subdomain;
  const tunnelStub = c.env.HOSTC_DURABLE_OBJECT.getByName(tunnelId);

  const createResponse = await tunnelStub.fetch(
    new Request(`https://hostc.internal${INTERNAL_CREATE_PATH}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        tunnelId,
        subdomain,
      }),
    }),
  );

  if (!createResponse.ok) {
    return cloneResponse(createResponse);
  }

  const created = (await createResponse.json()) as InternalCreateTunnelResponse;
  const requestUrl = new URL(c.req.url);

  return c.json<CreateTunnelResponse>(
    {
      tunnelId: created.tunnelId,
      subdomain: created.subdomain,
      publicUrl: buildPublicUrl(c.env.PUBLIC_BASE_DOMAIN, created.subdomain),
      websocketUrl: buildTunnelWebSocketUrl(requestUrl, created.tunnelId, created.connectToken),
      connectToken: created.connectToken,
    },
    201,
  );
});

app.get(`${TUNNELS_API_PATH}/:tunnelId/connect`, async (c) => {
  const tunnelId = normalizeSubdomain(c.req.param("tunnelId"));

  if (!tunnelId) {
    return c.json(
      {
        error: "Invalid tunnel id",
      },
      400,
    );
  }

  const requestUrl = new URL(c.req.url);
  const tunnelStub = c.env.HOSTC_DURABLE_OBJECT.getByName(tunnelId);

  return tunnelStub.fetch(new Request(`https://hostc.internal${INTERNAL_CONNECT_PATH}${requestUrl.search}`, c.req.raw));
});

app.get("/", (c) => {
  const tunnelSubdomain = getTunnelSubdomain(c);

  if (tunnelSubdomain) {
    return proxyTunnelRequest(c, tunnelSubdomain);
  }

  return createInfoResponse(c.env.PUBLIC_BASE_DOMAIN);
});

app.all("*", async (c) => {
  const tunnelSubdomain = getTunnelSubdomain(c);

  if (!tunnelSubdomain) {
    return new Response("Not Found", {
      status: 404,
    });
  }

  return proxyTunnelRequest(c, tunnelSubdomain);
});

export { HostcDurableObject };
export default app;

async function readCreateTunnelRequest(request: Request): Promise<CreateTunnelRequest> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return {};
  }

  return (await request.json<CreateTunnelRequest>().catch(() => ({}))) ?? {};
}

function cloneResponse(response: Response): Response {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

function getTunnelSubdomain(c: Context<AppEnv>): string | null {
  const url = new URL(c.req.url);
  return extractTunnelSubdomain(url.hostname, c.env.PUBLIC_BASE_DOMAIN);
}

function proxyTunnelRequest(c: Context<AppEnv>, tunnelSubdomain: string): Promise<Response> {
  const tunnelStub = c.env.HOSTC_DURABLE_OBJECT.getByName(tunnelSubdomain);
  return tunnelStub.fetch(c.req.raw);
}

function createInfoResponse(publicBaseDomain: string): Response {
  return Response.json({
    name: "hostc",
    createTunnelPath: TUNNELS_API_PATH,
    publicBaseDomain,
    message: `Create a tunnel and route public traffic through subdomain.${publicBaseDomain}`,
  });
}
