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

import { CacheControl, CopyResponse } from "@adonix.org/cloud-spark";
import { SerializedRequest, SerializedResponse, StorageRecord } from "./interfaces";

export async function serializeRequest(request: Request): Promise<SerializedRequest> {
    const headers: Record<string, string> = {};
    for (const [k, v] of request.headers.entries()) {
        headers[k] = v;
    }

    return {
        method: request.method,
        url: request.url,
        headers,
        body: await request.text(),
    };
}

export async function serializeResponse(response: Response): Promise<SerializedResponse> {
    const headers: Record<string, string> = {};
    for (const [k, v] of response.headers.entries()) {
        headers[k] = v;
    }

    return {
        status: response.status,
        statusText: response.statusText,
        headers,
        body: await response.text(),
    };
}

export function deserializeResponse(json: SerializedResponse): Response {
    return new Response(json.body, {
        status: json.status,
        statusText: json.statusText,
        headers: json.headers,
    });
}

export function deserializeRequest(json: SerializedRequest): Request {
    return new Request(json.url, {
        method: json.method,
        headers: json.headers,
    });
}

export class StoredResponse extends CopyResponse {
    constructor(json: StorageRecord, cache?: CacheControl) {
        super(deserializeResponse(json.response), cache);
        this.setHeader("x-proxy-storage", "HIT");
        this.setHeader("x-last-refreshed", json.lastRefresh.toUTCString());
    }
}
