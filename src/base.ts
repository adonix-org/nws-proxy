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
    Forbidden,
    GET,
    RouteTable,
    RouteWorker,
    sortSearchParams,
} from "@adonix.org/cloud-spark";

export { ProxyStorage } from "./proxy-storage";

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

    protected abstract getRefreshSeconds(): number;

    protected override get(): Promise<Response> {
        const name = this.getName();
        console.log(name);
        if (!name) return this.response(Forbidden);

        const stub = this.env.NWS_STORAGE.getByName(name);
        return stub.proxy(this.request, this.getRefreshSeconds());
    }

    private getName(): string | undefined {
        return `nws:do:${sortSearchParams(this.request).toString()}`;
    }
}

class Points extends NwsApiProxy {
    protected getRefreshSeconds(): number {
        return 30;
    }
}

const ROUTE_TABLE: RouteTable = [
    [GET, "/points/:coordinates", Points],
    [GET, "/alerts/active", Points],
];

class NwsWorker extends RouteWorker {
    public override init(): void {
        this.routes(ROUTE_TABLE);
    }
}

export default NwsWorker.ignite();
