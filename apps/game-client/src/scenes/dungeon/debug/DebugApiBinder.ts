export class DebugApiBinder {
  install(api: unknown): void {
    (window as unknown as { __blodexDebug?: unknown }).__blodexDebug = api;
  }

  remove(): void {
    const target = window as unknown as { __blodexDebug?: unknown };
    if (target.__blodexDebug !== undefined) {
      delete target.__blodexDebug;
    }
  }
}
