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
import { StorageRecord } from "./interfaces";
import { ProxyReset, ProxyStopped, StoredResponse } from "./responses";
import { StatusCodes, Time } from "@adonix.org/cloud-spark";
import { DurableObject } from "cloudflare:workers";

export class ProxyStorage extends DurableObject {
    private static readonly KEY = "nws:proxy";
    private static readonly MIN_ALARM_SECONDS = 1 * Time.Minute;
    private static readonly ALLOWED_LATE_SECONDS = 5 * Time.Minute;
    private stored: StorageRecord | undefined;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);

        this.ctx.blockConcurrencyWhile(async () => {
            this.stored = await this.ctx.storage.get<StorageRecord>(this.getKey());
        });
    }

    protected getKey(): string {
        return ProxyStorage.KEY;
    }

    protected async save(): Promise<void> {
        if (this.stored) this.ctx.storage.put(this.getKey(), this.stored);
    }

    private hasExpired(): boolean {
        if (!this.stored) return true;

        const now = Date.now();
        const allowed = (this.stored.refreshSeconds + ProxyStorage.ALLOWED_LATE_SECONDS) * 1000;
        const expires = this.stored.lastRefresh.getTime() + allowed;
        return now > expires;
    }

    public async proxy(request: Request, refreshSeconds: number): Promise<Response> {
        // No stored record exists or it has expired
        if (!this.stored || this.hasExpired()) {
            return this.origin(request, refreshSeconds);
        }

        // Upddate refreshSeconds if it changed.
        if (this.stored.refreshSeconds !== refreshSeconds) {
            this.stored.refreshSeconds = refreshSeconds;
            await this.save();
            await this.setAlarm(refreshSeconds);
        }

        return new StoredResponse(this.stored).response();
    }

    protected async origin(request: Request, refreshSeconds: number): Promise<Response> {
        const response = await fetch(request);

        if (response.status !== StatusCodes.OK) {
            await this.reset();
            return response;
        }

        this.stored = {
            request: await serializeRequest(request),
            response: await serializeResponse(response.clone()),
            lastRefresh: new Date(),
            refreshSeconds,
        };

        await this.save();
        await this.setAlarm(refreshSeconds);
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
        if (!this.stored) throw new Error("Missing storage entry.");

        const request = deserializeRequest(this.stored.request);
        return this.origin(request, this.stored.refreshSeconds);
    }

    protected async doAlarm(): Promise<void> {
        try {
            await this.refresh();
        } catch (error) {
            console.error(error);
        }
    }

    public override async alarm(): Promise<void> {
        this.ctx.waitUntil(this.doAlarm());
    }
}
