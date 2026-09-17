import { type NextRequest, NextResponse } from "next/server";

const rawBackendUrl =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://thread-sfe5.onrender.com";

const isLocalhost = /(^|\/\/)(localhost|127\.0\.0\.1)(?::|\/|$)/i.test(rawBackendUrl);
const BACKEND_URL = (
  process.env.NODE_ENV === "production" && isLocalhost
    ? (process.env.BACKEND_API_URL && !/(^|\/\/)(localhost|127\.0\.0\.1)(?::|\/|$)/i.test(process.env.BACKEND_API_URL)
        ? process.env.BACKEND_API_URL
        : "https://thread-sfe5.onrender.com")
    : rawBackendUrl
)
  .replace(/\/+$/, "")
  .replace(/\/api\/v1$/, "");

async function handleProxy(
  request: NextRequest,
  segmentData: { params: Promise<{ path?: string[] }> },
): Promise<NextResponse> {
  const { path } = await segmentData.params;
  const targetPath = path && path.length > 0 ? path.join("/") : "";
  const search = request.nextUrl.search;
  const targetUrl = `${BACKEND_URL}/api/v1${targetPath ? `/${targetPath}` : ""}${search}`;

  const forwardHeaders = new Headers();
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (
      lower !== "host" &&
      lower !== "connection" &&
      lower !== "content-length" &&
      lower !== "transfer-encoding"
    ) {
      forwardHeaders.set(key, value);
    }
  });

  const origin = request.headers.get("origin") || request.nextUrl.origin;
  if (origin) {
    forwardHeaders.set("origin", origin);
  }

  const clientIp =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip");
  if (clientIp) {
    forwardHeaders.set("x-forwarded-for", clientIp);
  }

  const hasBody = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  const body = hasBody ? await request.arrayBuffer() : null;

  try {
    const backendResponse = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      ...(hasBody && body !== null ? { body } : {}),
      redirect: "manual",
    });

    const responseHeaders = new Headers();

    // Preserve multiple Set-Cookie headers
    const setCookies =
      typeof backendResponse.headers.getSetCookie === "function"
        ? backendResponse.headers.getSetCookie()
        : null;

    backendResponse.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (
        lower !== "content-encoding" &&
        lower !== "content-length" &&
        lower !== "transfer-encoding" &&
        lower !== "set-cookie"
      ) {
        responseHeaders.append(key, value);
      }
    });

    if (setCookies && setCookies.length > 0) {
      for (const cookie of setCookies) {
        responseHeaders.append("set-cookie", cookie);
      }
    } else {
      const singleCookie = backendResponse.headers.get("set-cookie");
      if (singleCookie) {
        responseHeaders.append("set-cookie", singleCookie);
      }
    }

    const responseBody = await backendResponse.arrayBuffer();

    return new NextResponse(responseBody, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "PROXY_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to connect to upstream API service.",
        },
      },
      { status: 502 },
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
export const OPTIONS = handleProxy;
export const HEAD = handleProxy;
