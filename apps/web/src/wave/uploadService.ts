import type { UploadStatus } from "./types";

/**
 * Upload boundary. The UI only talks to `UploadService`; replace
 * `createMockUploadService` with a real HTTP / S3 implementation to go live.
 */
export interface UploadResult {
  /** Remote URL once stored. Omit to keep using the local preview URL. */
  url?: string;
}
export interface UploadCallbacks {
  onProgress: (percent: number) => void;
  onDone: (result: UploadResult) => void;
  onError: (error: Error) => void;
}
export interface UploadHandle {
  cancel: () => void;
}
export interface UploadService {
  upload: (file: File, callbacks: UploadCallbacks) => UploadHandle;
}

export interface MockUploadOptions {
  /** Total simulated time per upload. */
  durationMs?: number;
  /** 0..1 chance that an upload fails part-way. */
  failureRate?: number;
  tickMs?: number;
  random?: () => number;
}

export function createMockUploadService(options: MockUploadOptions = {}): UploadService {
  const { durationMs = 1600, failureRate = 0, tickMs = 120, random = Math.random } = options;
  return {
    upload(file, cb) {
      const willFail = random() < failureRate;
      const failAt = 0.3 + random() * 0.5;
      let elapsed = 0;
      const timer = setInterval(() => {
        elapsed += tickMs;
        const p = Math.min(1, elapsed / durationMs);
        if (willFail && p >= failAt) {
          clearInterval(timer);
          cb.onError(new Error(`Upload of ${file.name} failed`));
          return;
        }
        cb.onProgress(Math.round(p * 100));
        if (p >= 1) {
          clearInterval(timer);
          cb.onDone({});
        }
      }, tickMs);
      return { cancel: () => clearInterval(timer) };
    },
  };
}

/**
 * Real uploader: multipart POST to the agents API (`apps/api`, `POST /uploads`, proxied by Vite
 * at `/api`). Uses XHR rather than fetch because fetch has no upload-progress events.
 * The server answers `{ url }` with a URL under the same `/api` prefix.
 */
export function createHttpUploadService(endpoint = "/api/uploads"): UploadService {
  return {
    upload(file, cb) {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", endpoint);
      xhr.responseType = "json";
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) cb.onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      };
      xhr.onload = () => {
        const body = xhr.response as { url?: unknown; detail?: unknown } | null;
        if (xhr.status >= 200 && xhr.status < 300 && body && typeof body.url === "string") {
          cb.onProgress(100);
          cb.onDone({ url: body.url });
        } else {
          const detail = body && typeof body.detail === "string" ? body.detail : `server answered ${xhr.status}`;
          cb.onError(new Error(detail));
        }
      };
      xhr.onerror = () => cb.onError(new Error("couldn\u2019t reach the upload server. Is the API running on port 8000?"));
      const form = new FormData();
      form.append("file", file, file.name);
      xhr.send(form);
      return { cancel: () => xhr.abort() };
    },
  };
}

export interface UploadUpdate {
  id: string;
  status: UploadStatus;
  progress: number;
  url?: string;
  /** Set when status is "failed". */
  error?: string;
}

/**
 * Online-aware queue. Items wait as "queued" while offline and start as soon as
 * `setOnline(true)` is called. Emits patches; it owns no UI state.
 */
export class UploadQueue {
  private files = new Map<string, File>();
  private handles = new Map<string, UploadHandle>();
  private waiting = new Set<string>();
  private online = false;

  constructor(
    private readonly service: UploadService,
    private readonly onUpdate: (update: UploadUpdate) => void,
  ) {}

  setOnline(online: boolean): void {
    this.online = online;
    if (online) for (const id of [...this.waiting]) this.start(id);
  }

  enqueue(id: string, file: File): void {
    this.files.set(id, file);
    this.waiting.add(id);
    this.onUpdate({ id, status: "queued", progress: 0 });
    if (this.online) this.start(id);
  }

  retry(id: string): void {
    if (!this.files.has(id)) return;
    this.waiting.add(id);
    this.onUpdate({ id, status: "queued", progress: 0 });
    if (this.online) this.start(id);
  }

  cancel(id: string): void {
    this.handles.get(id)?.cancel();
    this.handles.delete(id);
    this.waiting.delete(id);
    this.files.delete(id);
  }

  dispose(): void {
    for (const h of this.handles.values()) h.cancel();
    this.handles.clear();
    this.waiting.clear();
    this.files.clear();
  }

  private start(id: string): void {
    const file = this.files.get(id);
    if (!file) return;
    this.waiting.delete(id);
    this.onUpdate({ id, status: "uploading", progress: 0 });
    const handle = this.service.upload(file, {
      onProgress: (progress) => this.onUpdate({ id, status: "uploading", progress }),
      onDone: (result) => {
        this.handles.delete(id);
        this.files.delete(id);
        this.onUpdate({ id, status: "done", progress: 100, url: result.url });
      },
      onError: (error) => {
        this.handles.delete(id);
        // Keep the file so Retry works.
        this.onUpdate({ id, status: "failed", progress: 0, error: error.message });
      },
    });
    this.handles.set(id, handle);
  }
}
