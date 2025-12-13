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
    CopyResponse,
    GET,
    JsonResponse,
    RouteTable,
    RouteWorker,
    Time,
} from "@adonix.org/cloud-spark";
import { NwsProxy } from "./nws-proxy";

class Points extends NwsProxy {
    protected override getTtl(): number {
        return Time.Month;
    }
}

class Alerts extends NwsProxy {
    protected override getTtl(): number {
        return 10 * Time.Minute;
    }
}

class Stations extends NwsProxy {
    protected override getUrl(): URL {
        const url = new URL(this.request.url);
        url.searchParams.set("limit", "1");
        return url;
    }

    protected override getTtl(): number {
        return Time.Month;
    }
}

class Forecast extends NwsProxy {
    protected override getTtl(): number {
        return Time.Hour;
    }
}

class HWO extends NwsProxy {
    protected override getTtl(): number {
        return 10 * Time.Minute;
    }
}

class Observation extends NwsProxy {
    protected override getTtl(): number {
        return 10 * Time.Minute;
    }
}

class Products extends NwsProxy {
    protected override async get(): Promise<Response> {
        const response = await fetch(this.request);
        return this.response(CopyResponse, response, {
            "max-age": 10 * Time.Minute,
            "s-maxage": 1 * Time.Hour,
        });
    }
}

class DurableObjectList extends BasicWorker {
    protected override async get(): Promise<Response> {
        const list = await this.env.NWS_KV.list({ prefix: NwsProxy.KV_DO_PREFIX });
        const json = list.keys.map((k) => k.name);
        return this.response(JsonResponse, json);
    }
}

class DurableObjectReset extends BasicWorker {
    protected override async get(): Promise<Response> {
        const list = await this.env.NWS_KV.list({ prefix: NwsProxy.KV_DO_PREFIX });
        for (const key of list.keys) {
            const stub = this.env.NWS_STORAGE.getByName(key.name);
            const response = await stub.reset();
            console.info(key.name, await response.text());
        }

        const json = list.keys.map((k) => k.name);
        return this.response(JsonResponse, json);
    }
}

const NWS_ROUTES: RouteTable = [
    [GET, "/products/types/HWO/locations/:wfo/latest", HWO],
    [GET, "/points/:coordinates", Points],
    [GET, "/alerts/active", Alerts],
    [GET, "/gridpoints/:wfo/:xy/stations", Stations],
    [GET, "/gridpoints/:wfo/:xy/forecast", Forecast],
    [GET, "/products/types/:id/locations/:wfo/latest", Products],
    [GET, "/stations/:id/observations/latest", Observation],
];

export class NWSRouteWorker extends RouteWorker {
    protected override init(): void {
        this.route(GET, "/admin/list", DurableObjectList);
        this.route(GET, "/admin/reset", DurableObjectReset);

        this.routes(NWS_ROUTES);
    }
}
