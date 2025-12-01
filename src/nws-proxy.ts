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
    BasicWorker,
    CacheControl,
    CopyResponse,
    StatusCodes,
    Time,
} from "@adonix.org/cloud-spark";

export abstract class NwsProxy extends BasicWorker {
    public static readonly NWS_BASE_URL = "https://api.weather.gov";
    public static readonly KV_DO_PREFIX = "nws:do:";

    constructor(request: Request, env: Env, ctx: ExecutionContext) {
        const headers = new Headers(request.headers);
        headers.delete("cache-control");
        headers.delete("pragma");
        headers.delete("accept-language");

        headers.set("user-agent", env.NWS_USER_AGENT);

        const source = new URL(request.url);
        const target = new URL(source.pathname + source.search, NwsProxy.NWS_BASE_URL);
        super(new Request(target, { headers, method: request.method }), env, ctx);
    }

    protected override async get(): Promise<Response> {
        const name = this.getName();
        const exists = await this.registered(name);

        const stub = this.env.NWS_STORAGE.getByName(name);
        const response = await stub.proxy(this.request, this.getTtl());

        if (response.status !== StatusCodes.OK) return response;

        if (!exists) {
            await this.register(name);
        }

        const cache = CacheControl.parse(response.headers.get("cache-control") ?? "");
        return this.response(CopyResponse, response, {
            ...cache,
            ...{ "s-maxage": this.getTtl() },
        });
    }

    protected async registered(name: string): Promise<boolean> {
        return (await this.env.NWS_KV.get(name)) !== null;
    }

    protected async register(name: string): Promise<void> {
        await this.env.NWS_KV.put(name, this.request.url);
    }

    protected getUrl(): URL {
        return new URL(this.request.url);
    }

    protected getName(): string {
        const url = this.getUrl();
        url.searchParams.sort();
        return `${NwsProxy.KV_DO_PREFIX}${url.toString()}`;
    }

    protected getTtl(): number {
        return Time.Hour;
    }
}
