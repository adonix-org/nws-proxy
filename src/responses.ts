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

import { CacheControl, CopyResponse, JsonResponse, StatusCodes } from "@adonix.org/cloud-spark";

import { StorageRecord } from "./interfaces";
import { deserializeResponse } from "./serialized";

export class StoredResponse extends CopyResponse {
    constructor(json: StorageRecord, cache?: CacheControl) {
        super(deserializeResponse(json.response), cache);
        this.setHeader("x-proxy-storage", "HIT");
        this.setHeader("x-proxy-updated", json.lastRefresh.toUTCString());
        this.setHeader(
            "x-proxy-age",
            `${Math.floor((Date.now() - json.lastRefresh.getTime()) / 1000)}`
        );
    }
}

export class ProxyActionResponse extends JsonResponse {
    constructor(message: string) {
        const json = {
            status: StatusCodes.OK,
            message,
        };
        super(json, CacheControl.DISABLE);
    }
}

export class ProxyStopped extends ProxyActionResponse {
    constructor() {
        super("Proxy storage alarms stopped.");
    }
}

export class ProxyReset extends ProxyActionResponse {
    constructor() {
        super("Proxy storage reset.");
    }
}
