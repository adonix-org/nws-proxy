/*
 * Copyright (C) 2025 Ty Busby
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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

        const source = new URL(request.url);
        const target = new URL(source.pathname, `https://api.weather.gov`);
        target.search = source.search;

        const response = await fetch(target, {
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
