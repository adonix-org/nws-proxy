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

import { deserializeRequest, serializeRequest, serializeResponse } from "./serialized";
import { RecordStorage } from "./record-storage";
import { StorageRecord } from "./interfaces";
import { ProxyReset, ProxyStopped, StoredResponse } from "./responses";
import { Time } from "@adonix.org/cloud-spark";

export class ProxyStorage extends RecordStorage<StorageRecord> {
    private static readonly KEY = "nws:storage";
    private static readonly MIN_ALARM_SECONDS = 10 * Time.Second;

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

    protected async origin(request: Request, refreshSeconds: number): Promise<Response> {
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

        this.setAlarm(refreshSeconds);

        return response;
    }

    protected async setAlarm(seconds: number): Promise<void> {
        await this.ctx.storage.deleteAlarm();
        if (seconds < ProxyStorage.MIN_ALARM_SECONDS) {
            console.warn(
                `Alarm seconds (${seconds}) less than minimum (${ProxyStorage.MIN_ALARM_SECONDS}). Using minimum.`
            );
        }
        await this.ctx.storage.setAlarm(
            Date.now() + Math.max(seconds, ProxyStorage.MIN_ALARM_SECONDS) * 1000
        );
    }

    public async stop(): Promise<Response> {
        await this.ctx.storage.deleteAlarm();
        return new ProxyStopped().response();
    }

    public async reset(): Promise<Response> {
        await this.ctx.storage.deleteAlarm();
        await this.ctx.storage.deleteAll();
        return new ProxyReset().response();
    }

    public async refresh(): Promise<Response> {
        const stored = await this.load();
        if (!stored) throw new Error("Missing storage entry.");

        const request = deserializeRequest(stored.request);
        return this.origin(request, stored.refreshSeconds);
    }

    protected async doAlarm(): Promise<void> {
        try {
            await this.refresh();
        } catch (error) {
            console.error(error);
        }
    }

    public override async alarm(): Promise<void> {
        console.log("Alarm fired!");
        this.ctx.waitUntil(this.doAlarm());
    }
}
