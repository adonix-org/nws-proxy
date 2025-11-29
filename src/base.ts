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

import { BasicWorker, CacheControl, CopyResponse, StatusCodes } from "@adonix.org/cloud-spark";

export abstract class NwsApiProxy extends BasicWorker {
    public static readonly NWS_BASE_URL = "https://api.weather.gov";

    constructor(request: Request, env: Env, ctx: ExecutionContext) {
        const headers = new Headers(request.headers);
        headers.delete("cache-control");
        headers.delete("pragma");
        headers.delete("accept-language");

        headers.set("user-agent", env.NWS_USER_AGENT);

        const source = new URL(request.url);
        const target = new URL(source.pathname + source.search, NwsApiProxy.NWS_BASE_URL);
        super(new Request(target, { headers, method: request.method }), env, ctx);
    }

    protected override async get(): Promise<Response> {
        const name = this.getName();
        console.info(name);
        const stub = this.env.NWS_STORAGE.getByName(name);
        const response = await stub.proxy(this.request, this.getTtl());

        if (response.status !== StatusCodes.OK) return response;

        const existing = CacheControl.parse(response.headers.get("cache-control") ?? "");
        return this.response(CopyResponse, response, {
            ...existing,
            ...{ "s-maxage": this.getTtl() },
        });
    }

    protected getUrl(): URL {
        return new URL(this.request.url);
    }

    protected getName(): string {
        const url = this.getUrl();
        url.searchParams.sort();
        return `nws:do:${url.toString()}`;
    }

    protected abstract getTtl(): number;
}
