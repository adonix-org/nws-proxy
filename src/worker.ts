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

import { BasicWorker, Cache, CacheControl, ClonedResponse, Time } from "@adonix.org/cloud-spark";

const LONG_CACHE: CacheControl = {
    public: true,
    "max-age": Time.Week,
    "s-maxage": Time.Week,
    "stale-while-revalidate": 4 * Time.Week,
    "stale-if-error": Time.Week,
};

export class NWSProxyWorker extends BasicWorker {
    private static readonly NWS_API = "https://api.weather.gov";

    protected override async get(): Promise<Response> {
        const source = new URL(this.request.url);
        const target = new URL(source.pathname + source.search, NWSProxyWorker.NWS_API);

        const headers = new Headers(this.request.headers);
        headers.set("User-Agent", this.env.NWS_USER_AGENT);

        const request = new Request(target, {
            body: this.request.body,
            method: this.request.method,
            headers,
        });

        const response = await fetch(request);
        let cache: CacheControl | undefined = undefined;
        if (response.ok) {
            cache = this.getCacheControl(target);
        }

        return this.getResponse(ClonedResponse, await fetch(request), cache);
    }

    protected getCacheControl(url: URL): CacheControl | undefined {
        const paths = ["^/gridpoints/([A-Z]{3})/\\d+,\\d+/stations$", "^/points/-?\\d+(\\.\\d+)?,-?\\d+(\\.\\d+)?$"];
        for (const path of paths) {
            if (new RegExp(path).test(url.pathname)) {
                return LONG_CACHE;
            }
        }
        return;
    }

    public override getAllowHeaders(): string[] {
        return [...super.getAllowHeaders(), "Feature-Flags"];
    }

    public override getAllowOrigins(): string[] {
        try {
            return JSON.parse(this.env.ALLOWED_ORIGINS);
        } catch (error) {
            console.error("Error parsing ALLOWED_ORIGINS", this.env.ALLOWED_ORIGINS, error);
            return [];
        }
    }
}
