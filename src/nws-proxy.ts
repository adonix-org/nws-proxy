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

import {
    cache,
    CacheControl,
    CopyResponse,
    cors,
    GET,
    RouteWorker,
    StatusCodes,
    Time,
} from "@adonix.org/cloud-spark";

export class NWSProxy extends RouteWorker {
    private static readonly NWS_BASE_URL = "https://api.weather.gov";

    constructor(request: Request, env: Env, ctx: ExecutionContext) {
        const headers = new Headers(request.headers);
        headers.delete("cache-control");
        headers.delete("pragma");
        headers.delete("accept-language");
        super(new Request(request, { headers }), env, ctx);
    }

    protected override init(): void {
        this.routes([
            [GET, "/alerts/active", this.alerts],
            [GET, "/gridpoints/:wfo/:xy/stations", this.stations],
            [GET, "/gridpoints/:wfo/:xy/forecast", this.forecast],
            [GET, "/points/:coordinates", this.points],
            [GET, "/products/types/:id/locations/:wfo/latest", this.products],
            [GET, "/stations/:id/observations/latest", this.observation],
        ]);

        this.use(cors({ allowedHeaders: ["feature-flags"], maxAge: Time.Month }));
        this.use(cache());
    }

    private points(): Promise<Response> {
        const edge: CacheControl = {
            "s-maxage": Time.Year,
        };
        return this.proxy(edge);
    }

    private stations(): Promise<Response> {
        const edge: CacheControl = {
            "s-maxage": Time.Year,
        };

        const source = new URL(this.request.url);
        source.searchParams.set("limit", "1");
        return this.proxy(edge, source);
    }

    private alerts(): Promise<Response> {
        const edge: CacheControl = {
            "s-maxage": 10 * Time.Minute,
        };
        return this.proxy(edge);
    }

    private forecast(): Promise<Response> {
        const edge: CacheControl = {
            "s-maxage": Time.Hour,
        };
        return this.proxy(edge);
    }

    private products(): Promise<Response> {
        const edge: CacheControl = {
            "s-maxage": 10 * Time.Minute,
        };
        return this.proxy(edge);
    }

    private observation(): Promise<Response> {
        const edge: CacheControl = {
            "s-maxage": 10 * Time.Minute,
        };
        return this.proxy(edge);
    }

    private async proxy(
        cache?: CacheControl,
        source: URL = new URL(this.request.url)
    ): Promise<Response> {
        const target = new URL(source.pathname + source.search, NWSProxy.NWS_BASE_URL);

        const headers = new Headers(this.request.headers);
        headers.set("user-agent", this.env.NWS_USER_AGENT);

        const response = await fetch(
            new Request(target, {
                method: this.request.method,
                headers,
            })
        );

        if (response.status !== StatusCodes.OK || !cache) return response;

        const existing = CacheControl.parse(response.headers.get("cache-control") ?? "");
        return this.response(CopyResponse, response, { ...existing, ...cache });
    }
}
