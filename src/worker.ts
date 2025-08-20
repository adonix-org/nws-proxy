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

import { BasicWorker, ClonedResponse } from "@adonix.org/cloud-spark";

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

        return this.getResponse(ClonedResponse, await fetch(request));
    }

    public override getAllowHeaders(): string[] {
        return [...super.getAllowHeaders(), "Feature-Flags"];
    }

    public override getAllowOrigins(): string[] {
        return ["https://www.tybusby.com", "https://localhost:8787"];
    }
}
