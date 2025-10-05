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
    ClonedResponse,
    cors,
    GET,
    RouteWorker,
    Time,
} from "@adonix.org/cloud-spark";

export class NWSProxy extends RouteWorker {
    private static readonly NWS_BASE_URL = "https://api.weather.gov";

    protected override init(): void {
        this.routes([
            [GET, "/points/:coordinates", this.points],
            [GET, "/gridpoints/:wfo/:xy/stations", this.points],
            [GET, "/stations/:stationId/observations/latest", this.observations],
        ]);

        this.use(cors({ allowedHeaders: ["Feature-Flags"], maxAge: Time.Month }));
        this.use(cache());
    }

    protected override async get(): Promise<Response> {
        return this.proxy();
    }

    protected async points(): Promise<Response> {
        const response = await this.get();
        if (!response.ok) return response;

        const cache: CacheControl = {
            public: true,
            "max-age": Time.Week,
            "s-maxage": Time.Week,
            "stale-while-revalidate": 4 * Time.Week,
            "stale-if-error": Time.Week,
        };
        return this.response(ClonedResponse, response, cache);
    }

    protected async observations(): Promise<Response> {
        const response = await this.get();
        if (!response.ok) return response;

        const cache: CacheControl = {
            public: true,
            "max-age": 5 * Time.Minute,
            "s-maxage": 5 * Time.Minute,
            "stale-while-revalidate": 10 * Time.Minute,
        };

        return this.response(ClonedResponse, response, cache);
    }

    private async proxy(): Promise<Response> {
        const source = new URL(this.request.url);
        const target = new URL(source.pathname + source.search, NWSProxy.NWS_BASE_URL);

        const headers = new Headers(this.request.headers);
        headers.set("User-Agent", this.env.NWS_USER_AGENT);

        return await fetch(
            new Request(target, {
                method: this.request.method,
                body: this.request.body,
                headers,
            })
        );
    }
}
