export type EventHandler<TPayload> = (payload: TPayload) => void;
export interface TypedEventBus<TEventMap extends object> {
    on<K extends keyof TEventMap>(event: K, handler: EventHandler<TEventMap[K]>): () => void;
    off<K extends keyof TEventMap>(event: K, handler: EventHandler<TEventMap[K]>): void;
    emit<K extends keyof TEventMap>(event: K, payload: TEventMap[K]): void;
    removeAll(event?: keyof TEventMap): void;
}
export declare function createEventBus<TEventMap extends object>(): TypedEventBus<TEventMap>;
//# sourceMappingURL=eventBus.d.ts.map