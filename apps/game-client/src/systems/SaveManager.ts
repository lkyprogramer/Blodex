import {
  deserializeRunStateResult,
  RUN_SAVE_STORAGE_KEY,
  RUN_SAVE_STORAGE_KEY_V1,
  RUN_SAVE_STORAGE_KEY_V2,
  serializeRunState,
  type RunSaveDataV2
} from "@blodex/core";

export const RUN_SETTLED_STORAGE_KEY = "blodex_run_settled_v1";
export const SAVE_LEASE_TTL_MS = 15_000;
export const SAVE_LEASE_HEARTBEAT_MS = 5_000;
export const SAVE_DEBOUNCE_MS = 300;

export interface SaveManagerOptions {
  storage?: Storage;
  sessionStorage?: Storage;
  now?: () => number;
  storageKey?: string;
  legacyStorageKey?: string;
  settledKey?: string;
  leaseTtlMs?: number;
  leaseHeartbeatMs?: number;
  debounceMs?: number;
}

export interface LeaseAcquireResult {
  ok: boolean;
  save: RunSaveDataV2 | null;
  reason?: "missing_save" | "lease_held" | "write_failed";
  holderTabId?: string;
}

function safeGetWindowStorage(kind: "localStorage" | "sessionStorage"): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  try {
    return window[kind];
  } catch {
    return undefined;
  }
}

function randomTabId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tab-${Math.floor(Math.random() * 1e9).toString(16)}`;
}

export class SaveManager {
  private static readonly TAB_ID_KEY = "blodex_tab_id_v1";

  private readonly storage: Storage | undefined;
  private readonly sessionStorage: Storage | undefined;
  private readonly now: () => number;
  private readonly storageKey: string;
  private readonly legacyStorageKey: string;
  private readonly settledKey: string;
  private readonly leaseTtlMs: number;
  private readonly leaseHeartbeatMs: number;
  private readonly debounceMs: number;
  private readonly tabId: string;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;
  private pageHideHandler: (() => void) | null = null;
  private beforeUnloadHandler: (() => void) | null = null;

  constructor(options: SaveManagerOptions = {}) {
    this.storage = options.storage ?? safeGetWindowStorage("localStorage");
    this.sessionStorage = options.sessionStorage ?? safeGetWindowStorage("sessionStorage");
    this.now = options.now ?? (() => Date.now());
    this.storageKey = options.storageKey ?? RUN_SAVE_STORAGE_KEY_V2 ?? RUN_SAVE_STORAGE_KEY;
    this.legacyStorageKey = options.legacyStorageKey ?? RUN_SAVE_STORAGE_KEY_V1;
    this.settledKey = options.settledKey ?? RUN_SETTLED_STORAGE_KEY;
    this.leaseTtlMs = options.leaseTtlMs ?? SAVE_LEASE_TTL_MS;
    this.leaseHeartbeatMs = options.leaseHeartbeatMs ?? SAVE_LEASE_HEARTBEAT_MS;
    this.debounceMs = options.debounceMs ?? SAVE_DEBOUNCE_MS;
    this.tabId = this.resolveTabId();
  }

  getTabId(): string {
    return this.tabId;
  }

  readSave(): RunSaveDataV2 | null {
    if (this.storage === undefined) {
      return null;
    }

    let rawV2: string | null = null;
    try {
      rawV2 = this.storage.getItem(this.storageKey);
    } catch {
      return null;
    }

    if (rawV2 !== null) {
      const parsed = deserializeRunStateResult(rawV2);
      if (parsed.save !== null) {
        return parsed.save;
      }
    }

    let rawV1: string | null = null;
    try {
      rawV1 = this.storage.getItem(this.legacyStorageKey);
    } catch {
      return null;
    }
    if (rawV1 === null) {
      return null;
    }

    const migrated = deserializeRunStateResult(rawV1);
    if (migrated.save === null) {
      return null;
    }

    if (migrated.sourceVersion === 1) {
      const wrote = this.writeSave(migrated.save);
      if (wrote) {
        try {
          this.storage.removeItem(this.legacyStorageKey);
        } catch {
          // Keep legacy copy when cleanup fails; v2 still takes precedence.
        }
      }
    }

    return migrated.save;
  }

  writeSave(snapshot: RunSaveDataV2): boolean {
    if (this.storage === undefined) {
      return false;
    }

    try {
      this.storage.setItem(this.storageKey, serializeRunState(snapshot));
      return true;
    } catch {
      return false;
    }
  }

  deleteSave(): void {
    if (this.storage === undefined) {
      return;
    }
    try {
      this.storage.removeItem(this.storageKey);
      this.storage.removeItem(this.legacyStorageKey);
    } catch {
      // Best effort cleanup; keep runtime alive when storage is unavailable.
    }
  }

  scheduleSave(snapshotBuilder: () => RunSaveDataV2 | null): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = globalThis.setTimeout(() => {
      this.debounceTimer = null;
      this.flushSave(snapshotBuilder);
    }, this.debounceMs);
  }

  flushSave(snapshotBuilder: () => RunSaveDataV2 | null): boolean {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    const snapshot = snapshotBuilder();
    if (snapshot === null) {
      return false;
    }
    return this.writeSave(snapshot);
  }

  hasForeignLease(save: RunSaveDataV2 | null, nowMs = this.now()): boolean {
    if (save?.lease === undefined) {
      return false;
    }
    if (save.lease.leaseUntilMs <= nowMs) {
      return false;
    }
    return save.lease.tabId !== this.tabId;
  }

  acquireLease(save: RunSaveDataV2 | null = this.readSave(), nowMs = this.now()): LeaseAcquireResult {
    if (save === null) {
      return {
        ok: false,
        save: null,
        reason: "missing_save"
      };
    }

    if (this.hasForeignLease(save, nowMs)) {
      return {
        ok: false,
        save,
        reason: "lease_held",
        ...(save.lease?.tabId === undefined ? {} : { holderTabId: save.lease.tabId })
      };
    }

    const leased: RunSaveDataV2 = {
      ...save,
      lease: {
        tabId: this.tabId,
        renewedAtMs: nowMs,
        leaseUntilMs: nowMs + this.leaseTtlMs
      }
    };

    if (!this.writeSave(leased)) {
      return {
        ok: false,
        save,
        reason: "write_failed"
      };
    }

    return {
      ok: true,
      save: leased
    };
  }

  renewLease(snapshotBuilder?: () => RunSaveDataV2 | null): boolean {
    const nowMs = this.now();
    const save = this.readSave();
    if (save === null) {
      return false;
    }
    if (this.hasForeignLease(save, nowMs)) {
      return false;
    }

    const snapshot = snapshotBuilder?.() ?? save;
    if (snapshot === null) {
      return false;
    }

    return this.writeSave({
      ...snapshot,
      lease: {
        tabId: this.tabId,
        renewedAtMs: nowMs,
        leaseUntilMs: nowMs + this.leaseTtlMs
      }
    });
  }

  startLeaseHeartbeat(snapshotBuilder?: () => RunSaveDataV2 | null): void {
    this.stopLeaseHeartbeat();
    this.heartbeatTimer = globalThis.setInterval(() => {
      this.renewLease(snapshotBuilder);
    }, this.leaseHeartbeatMs);
  }

  stopLeaseHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  bindPageLifecycle(saveNow: () => void): void {
    this.unbindPageLifecycle();

    if (typeof document !== "undefined") {
      this.visibilityHandler = () => {
        if (document.visibilityState === "hidden") {
          saveNow();
        }
      };
      document.addEventListener("visibilitychange", this.visibilityHandler);
    }

    if (typeof window !== "undefined") {
      this.pageHideHandler = () => {
        saveNow();
      };
      this.beforeUnloadHandler = () => {
        saveNow();
      };
      window.addEventListener("pagehide", this.pageHideHandler);
      window.addEventListener("beforeunload", this.beforeUnloadHandler);
    }
  }

  unbindPageLifecycle(): void {
    if (this.visibilityHandler !== null && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.pageHideHandler !== null && typeof window !== "undefined") {
      window.removeEventListener("pagehide", this.pageHideHandler);
      this.pageHideHandler = null;
    }
    if (this.beforeUnloadHandler !== null && typeof window !== "undefined") {
      window.removeEventListener("beforeunload", this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }
  }

  isRunSettled(runId: string): boolean {
    const settled = this.readSettledRunIds();
    return settled.has(runId);
  }

  markRunSettled(runId: string): void {
    if (this.storage === undefined) {
      return;
    }
    const settled = this.readSettledRunIds();
    if (settled.has(runId)) {
      return;
    }
    settled.add(runId);
    try {
      this.storage.setItem(this.settledKey, JSON.stringify([...settled.values()]));
    } catch {
      // Ignore transient storage failures.
    }
  }

  dispose(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.stopLeaseHeartbeat();
    this.unbindPageLifecycle();
  }

  private resolveTabId(): string {
    if (this.sessionStorage === undefined) {
      return randomTabId();
    }

    try {
      const existing = this.sessionStorage.getItem(SaveManager.TAB_ID_KEY);
      if (existing !== null && existing.length > 0) {
        return existing;
      }
    } catch {
      return randomTabId();
    }

    const next = randomTabId();
    try {
      this.sessionStorage.setItem(SaveManager.TAB_ID_KEY, next);
    } catch {
      // Keep generated tab id in-memory when sessionStorage write fails.
    }
    return next;
  }

  private readSettledRunIds(): Set<string> {
    if (this.storage === undefined) {
      return new Set<string>();
    }

    let raw: string | null = null;
    try {
      raw = this.storage.getItem(this.settledKey);
    } catch {
      return new Set<string>();
    }
    if (raw === null) {
      return new Set<string>();
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return new Set<string>();
      }
      return new Set(parsed.filter((entry): entry is string => typeof entry === "string"));
    } catch {
      return new Set<string>();
    }
  }
}
