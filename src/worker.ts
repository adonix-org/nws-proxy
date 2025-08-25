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

import { BasicWorker, CacheControl, ClonedResponse, Time } from "@adonix.org/cloud-spark";

const LONG_CACHE: CacheControl = {
    public: true,
    "max-age": Time.Week,
    "s-maxage": Time.Week,
    "stale-while-revalidate": 4 * Time.Week,
    "stale-if-error": Time.Week,
};

export class NWSProxyWorker extends BasicWorker {
    private static readonly NWS_API = "https://api.weather.gov";
    private static readonly CACHE_PATHS: RegExp[] = [
        /^\/gridpoints\/([A-Z]{3})\/\d+,\d+\/stations$/,
        /^\/points\/-?\d+(\.\d+)?,-?\d+(\.\d+)?$/,
    ];

    protected override async get(): Promise<Response> {
        const source = new URL(this.request.url);
        const target = new URL(source.pathname + source.search, NWSProxyWorker.NWS_API);

        const cached = await this.getCachedResponse();
        if (cached) return cached;

        const headers = new Headers(this.request.headers);
        headers.set("User-Agent", this.env.NWS_USER_AGENT);

        const response = await fetch(
            new Request(target, {
                method: this.request.method,
                body: this.request.body,
                headers,
            })
        );

        return this.getResponse(ClonedResponse, response, this.getCacheControl(target));
    }

    protected getCacheControl(url: URL): CacheControl | undefined {
        for (const re of NWSProxyWorker.CACHE_PATHS) {
            if (re.test(url.pathname)) {
                return LONG_CACHE;
            }
        }
        return undefined;
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
