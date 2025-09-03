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
    CacheControl,
    CacheHandler,
    ClonedResponse,
    CorsHandler,
    Method,
    RouteParams,
    RouteWorker,
    Time,
} from "@adonix.org/cloud-spark";

const LONG_CACHE: CacheControl = {
    public: true,
    "max-age": Time.Week,
    "s-maxage": Time.Week,
    "stale-while-revalidate": 4 * Time.Week,
    "stale-if-error": Time.Week,
};

export class NWSProxyWorker extends RouteWorker {
    private static readonly NWS_API = "https://api.weather.gov";

    protected override init(): void {
        this.load([
            [Method.GET, "/points/:coordinates", this.addLongCache],
            [Method.GET, "/gridpoints/:wfo/:xy/stations", this.addLongCache],
        ]);
        this.use(new CorsHandler({ allowedHeaders: ["Content-Type", "Feature-Flags"] }));
        this.use(new CacheHandler());
    }

    private async addLongCache(params: RouteParams): Promise<Response> {
        console.log({ ...params });
        return this.getResponse(ClonedResponse, await this.get(), LONG_CACHE);
    }

    protected override async get(): Promise<Response> {
        const source = new URL(this.request.url);
        const target = new URL(source.pathname + source.search, NWSProxyWorker.NWS_API);

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
