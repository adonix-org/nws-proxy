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
    deserializeRequest,
    serializeRequest,
    serializeResponse,
    StoredResponse,
} from "./serialized";
import { ObjectStorage } from "./object-storage";
import { StorageRecord } from "./interfaces";

export class ProxyStorage extends ObjectStorage<StorageRecord> {
    private static readonly KEY = "nws:storage";

    protected getKey(): string {
        return ProxyStorage.KEY;
    }

    public async proxy(
        request: Request,
        refreshSeconds: number,
        useStored = true
    ): Promise<Response> {
        const stored = useStored ? await this.load() : undefined;

        if (stored) {
            return new StoredResponse(stored).response();
        }

        return await this.origin(request, refreshSeconds);
    }

    public async origin(request: Request, refreshSeconds: number): Promise<Response> {
        const response = await fetch(request);

        if (response.ok) {
            const stored: StorageRecord = {
                request: await serializeRequest(request),
                response: await serializeResponse(response.clone()),
                lastRefresh: new Date(),
                refreshSeconds,
            };

            await this.save(stored);
        }

        // TODO: set alarm based on refresh seconds

        return response;
    }

    public async refresh(): Promise<Response> {
        const stored = await this.load();
        if (!stored) throw new Error("Missing storage entry.");

        const request = deserializeRequest(stored.request);
        return this.origin(request, stored.refreshSeconds);
    }

    public override async alarm(): Promise<void> {
        try {
            await this.refresh();
        } catch (err) {
            console.error(err);
        }
    }
}
