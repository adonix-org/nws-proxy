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

import { GET, JsonResponse, RouteWorker, SuccessResponse } from "@adonix.org/cloud-spark";

export { ProxyStorage as StorageProxy } from "./proxy-storage";

class TestWorker extends RouteWorker {
    protected name: string = "http://localhost:8787/";

    public override init(): void {
        this.route(GET, "/proxy", this.proxy);
        this.route(GET, "/refresh", this.refresh);
        this.route(GET, "/", this.root);
    }

    public proxy() {
        return this.response(JsonResponse, { message: "Hello Proxy!" });
    }

    public async refresh() {
        const stub = this.env.NWS_STORAGE.getByName(this.name);
        return await stub.refresh();
    }

    public async root(): Promise<Response> {
        this.name = this.request.url;
        const stub = this.env.NWS_STORAGE.getByName(this.name);
        const request = new Request(new URL("/proxy", this.request.url), {
            headers: this.request.headers,
        });
        return await stub.proxy(request, 1000, true);
    }
}

export default TestWorker.ignite();

//import { NWSProxy } from "./nws-proxy";
//export default NWSProxy.ignite();
