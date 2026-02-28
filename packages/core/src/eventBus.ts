export type EventHandler<TPayload> = (payload: TPayload) => void;

export interface TypedEventBus<TEventMap extends object> {
  on<K extends keyof TEventMap>(event: K, handler: EventHandler<TEventMap[K]>): () => void;
  off<K extends keyof TEventMap>(event: K, handler: EventHandler<TEventMap[K]>): void;
  emit<K extends keyof TEventMap>(event: K, payload: TEventMap[K]): void;
  removeAll(event?: keyof TEventMap): void;
  listenerCount(event?: keyof TEventMap): number;
}

export function createEventBus<TEventMap extends object>(): TypedEventBus<TEventMap> {
  const listeners = new Map<keyof TEventMap, Set<EventHandler<unknown>>>();

  return {
    on<K extends keyof TEventMap>(event: K, handler: EventHandler<TEventMap[K]>): () => void {
      const set = listeners.get(event) ?? new Set<EventHandler<unknown>>();
      set.add(handler as EventHandler<unknown>);
      listeners.set(event, set);
      return () => {
        set.delete(handler as EventHandler<unknown>);
        if (set.size === 0) {
          listeners.delete(event);
        }
      };
    },

    off<K extends keyof TEventMap>(event: K, handler: EventHandler<TEventMap[K]>): void {
      const set = listeners.get(event);
      if (set === undefined) {
        return;
      }
      set.delete(handler as EventHandler<unknown>);
      if (set.size === 0) {
        listeners.delete(event);
      }
    },

    emit<K extends keyof TEventMap>(event: K, payload: TEventMap[K]): void {
      const set = listeners.get(event);
      if (set === undefined || set.size === 0) {
        return;
      }

      // Sync dispatch with snapshot semantics avoids mutation-while-iterating surprises.
      const handlers = [...set] as Array<EventHandler<TEventMap[K]>>;
      for (const handler of handlers) {
        handler(payload);
      }
    },

    removeAll(event?: keyof TEventMap): void {
      if (event === undefined) {
        listeners.clear();
        return;
      }
      listeners.delete(event);
    },

    listenerCount(event?: keyof TEventMap): number {
      if (event !== undefined) {
        return listeners.get(event)?.size ?? 0;
      }
      let total = 0;
      for (const set of listeners.values()) {
        total += set.size;
      }
      return total;
    }
  };
}
