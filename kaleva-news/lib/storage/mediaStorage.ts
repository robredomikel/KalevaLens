import "server-only";
import { mkdir, writeFile, readFile, stat } from "fs/promises";
import path from "path";

export interface StoredMedia {
  key: string;
  url: string;
  size: number;
}

export interface MediaStorage {
  put(key: string, data: Buffer, contentType: string): Promise<StoredMedia>;
  read(key: string): Promise<Buffer>;
  stat(key: string): Promise<{ size: number }>;
}

function safeKey(key: string) {
  const normalized = path.posix.normalize(key).replace(/^\.\.\//, "");
  if (normalized.startsWith("/") || normalized.includes("../")) throw new Error("Invalid media storage key");
  return normalized;
}

class FilesystemMediaStorage implements MediaStorage {
  private root = path.resolve(process.env.MEDIA_STORAGE_ROOT || path.join(process.cwd(), "public", "generated-media"));
  private baseUrl = (process.env.MEDIA_PUBLIC_BASE_URL || "/generated-media").replace(/\/$/, "");

  async put(key: string, data: Buffer): Promise<StoredMedia> {
    const clean = safeKey(key);
    const target = path.resolve(this.root, clean);
    if (!target.startsWith(`${this.root}${path.sep}`)) throw new Error("Media path escapes storage root");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
    return { key: clean, url: `${this.baseUrl}/${clean.split("/").map(encodeURIComponent).join("/")}`, size: data.length };
  }

  async read(key: string) {
    return readFile(path.resolve(this.root, safeKey(key)));
  }

  async stat(key: string) {
    const result = await stat(path.resolve(this.root, safeKey(key)));
    return { size: result.size };
  }
}

let storage: MediaStorage | null = null;
export function getMediaStorage(): MediaStorage {
  if (!storage) storage = new FilesystemMediaStorage();
  return storage;
}

export function setMediaStorageForTests(value: MediaStorage | null) {
  storage = value;
}
