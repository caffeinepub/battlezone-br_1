import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Entry {
    id: bigint;
    survivalTime: bigint;
    placement: bigint;
    timestamp: Time;
    playerName: string;
    kills: bigint;
}
export type Time = bigint;
export interface backendInterface {
    getAllEntries(): Promise<Array<Entry>>;
    getTopKills(): Promise<Array<Entry>>;
    getTopPlacements(): Promise<Array<Entry>>;
    submitMatch(playerName: string, kills: bigint, placement: bigint, survivalTime: bigint): Promise<bigint>;
}
