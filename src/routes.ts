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
    cache,
    cors,
    GET,
    JsonResponse,
    RouteTable,
    RouteWorker,
    Time,
} from "@adonix.org/cloud-spark";
import { NwsApiProxy } from "./base";

class Points extends NwsApiProxy {
    protected override getTtl(): number {
        return Time.Day;
    }
}

class Alerts extends NwsApiProxy {
    protected override getTtl(): number {
        return 10 * Time.Minute;
    }
}

class Stations extends NwsApiProxy {
    protected override getUrl(): URL {
        const url = new URL(this.request.url);
        url.searchParams.set("limit", "1");
        return url;
    }

    protected override getTtl(): number {
        return Time.Day;
    }
}

class Forecast extends NwsApiProxy {
    protected override getTtl(): number {
        return Time.Hour;
    }
}

class Products extends NwsApiProxy {
    protected override getTtl(): number {
        return 10 * Time.Minute;
    }
}

class Observation extends NwsApiProxy {
    protected override getTtl(): number {
        return 10 * Time.Minute;
    }
}

class DurableObjectListing extends BasicWorker {
    protected override async get(): Promise<Response> {
        const list = await this.env.NWS_KV.list({ prefix: NwsApiProxy.KV_DO_PREFIX });
        const json = list.keys.map((k) => k.name);
        return this.response(JsonResponse, json);
    }
}

const NWS_ROUTES: RouteTable = [
    [GET, "/points/:coordinates", Points],
    [GET, "/alerts/active", Alerts],
    [GET, "/gridpoints/:wfo/:xy/stations", Stations],
    [GET, "/gridpoints/:wfo/:xy/forecast", Forecast],
    [GET, "/products/types/:id/locations/:wfo/latest", Products],
    [GET, "/stations/:id/observations/latest", Observation],
];

export class NWSRouteWorker extends RouteWorker {
    protected override init(): void {
        this.route(GET, "/", DurableObjectListing);

        this.routes(NWS_ROUTES);

        this.use(cors({ allowedHeaders: ["feature-flags"], maxAge: Time.Month }));
        // this.use(cache());
    }
}
