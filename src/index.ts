/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run "npm run dev" in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run "npm run deploy" to publish your worker
 *
 * Bind resources to your worker in "wrangler.jsonc". After adding bindings, a type definition for the
 * "Env" object can be regenerated with "npm run cf-typegen".
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
    NWS_USER_AGENT: string;
}

export default {
    async fetch(request, env: Env, ctx: ExecutionContext): Promise<Response> {
        if (request.method === "OPTIONS") {
            // Handle preflight OPTIONS request
            return new Response(null, {
                status: 204,
                headers: getCorsHeaders(),
            });
        }

        if (request.method !== "GET") {
            return new Response("Method Not Allowed", { status: 405 });
        }

        const url = new URL(request.url);
        const targetUrl = new URL(`https://api.weather.gov${url.pathname}`);
        targetUrl.search = url.search;

        const response = await fetch(targetUrl, {
            headers: getRequestHeaders(request, env),
        });

        return new Response(response.body, {
            status: response.status,
            headers: getResponseHeaders(response),
        });
    },
} satisfies ExportedHandler<Env>;

function getRequestHeaders(request: Request, env: Env): Headers {
    const headers = new Headers();
    headers.set("Accept", "application/geo+json");
    headers.set("User-Agent", env.NWS_USER_AGENT);

    const modifed = request.headers.get("If-Modified-Since");
    if (modifed) {
        headers.set("If-Modified-Since", modifed);
    }

    const featureFlags = request.headers.get("Feature-Flags");
    if (featureFlags) {
        headers.set("Feature-Flags", featureFlags);
    }
    return headers;
}

function getResponseHeaders(response: Response): Headers {
    const headers = new Headers(response.headers);
    return addCorsHeaders(headers);
}

function getCorsHeaders(): Headers {
    return addCorsHeaders(new Headers());
}

function addCorsHeaders(headers: Headers): Headers {
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Headers", "*");
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    return headers;
}
