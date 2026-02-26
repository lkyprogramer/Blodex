export function createEventBus() {
    const listeners = new Map();
    return {
        on(event, handler) {
            const set = listeners.get(event) ?? new Set();
            set.add(handler);
            listeners.set(event, set);
            return () => {
                set.delete(handler);
                if (set.size === 0) {
                    listeners.delete(event);
                }
            };
        },
        off(event, handler) {
            const set = listeners.get(event);
            if (set === undefined) {
                return;
            }
            set.delete(handler);
            if (set.size === 0) {
                listeners.delete(event);
            }
        },
        emit(event, payload) {
            const set = listeners.get(event);
            if (set === undefined || set.size === 0) {
                return;
            }
            // Sync dispatch with snapshot semantics avoids mutation-while-iterating surprises.
            const handlers = [...set];
            for (const handler of handlers) {
                handler(payload);
            }
        },
        removeAll(event) {
            if (event === undefined) {
                listeners.clear();
                return;
            }
            listeners.delete(event);
        }
    };
}
//# sourceMappingURL=eventBus.js.map