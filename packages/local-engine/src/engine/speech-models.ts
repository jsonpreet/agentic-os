import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  LOCAL_SPEECH_MODEL_CATALOG,
  SpeechModelCatalogEntry,
  SpeechModelStatus,
  catalogSpeechModels
} from '@agentic/shared-contracts';

const MODELS_DIR = path.join(os.homedir(), '.agentic', 'models', 'speech');

type DownloadState = {
  bytesReceived: number;
  bytesTotal?: number;
  error?: string;
};

const downloads = new Map<string, DownloadState>();

export function speechModelsDir(): string {
  return MODELS_DIR;
}

function filePath(filename: string): string {
  return path.join(MODELS_DIR, filename);
}

function isInstalled(entry: SpeechModelCatalogEntry): boolean {
  if (!entry.filename) return false;
  const main = filePath(entry.filename);
  if (!fs.existsSync(main) || fs.statSync(main).size <= 1024) return false;
  return (entry.extraFiles ?? []).every((extra) => {
    const extraPath = filePath(extra.filename);
    return fs.existsSync(extraPath) && fs.statSync(extraPath).size > 16;
  });
}

export function listSpeechModels(platform: NodeJS.Platform = process.platform): SpeechModelStatus[] {
  return catalogSpeechModels(platform).map((model) => {
    const entry = LOCAL_SPEECH_MODEL_CATALOG.find((item) => item.id === model.id);
    const download = downloads.get(model.id);

    if (download?.error) {
      return {
        ...model,
        status: 'error',
        bytesReceived: download.bytesReceived,
        bytesTotal: download.bytesTotal ?? model.bytesTotal,
        error: download.error
      };
    }

    if (download && !download.error) {
      return {
        ...model,
        status: 'downloading',
        bytesReceived: download.bytesReceived,
        bytesTotal: download.bytesTotal ?? model.bytesTotal
      };
    }

    if (entry && isInstalled(entry)) {
      return { ...model, status: 'ready', error: undefined };
    }

    return model;
  });
}

async function downloadFile(url: string, dest: string, onProgress?: (received: number, total?: number) => void) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'agentic-desktop' },
    redirect: 'follow'
  });
  if (!response.ok || !response.body) {
    throw new Error(`Download failed (${response.status})`);
  }

  const total = Number(response.headers.get('content-length')) || undefined;
  const temp = `${dest}.part`;
  const file = fs.createWriteStream(temp);
  const reader = response.body.getReader();
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    file.write(Buffer.from(value));
    onProgress?.(received, total);
  }

  await new Promise<void>((resolve, reject) => {
    file.end(() => resolve());
    file.on('error', reject);
  });
  fs.renameSync(temp, dest);
}

export async function downloadSpeechModel(id: string): Promise<SpeechModelStatus> {
  const entry = LOCAL_SPEECH_MODEL_CATALOG.find((item) => item.id === id);
  if (!entry) throw new Error(`Unknown speech model: ${id}`);
  if (entry.source !== 'download' || !entry.url || !entry.filename) {
    throw new Error(`${entry.name} does not need a download.`);
  }

  fs.mkdirSync(MODELS_DIR, { recursive: true });
  if (isInstalled(entry)) {
    return listSpeechModels().find((model) => model.id === id)!;
  }

  downloads.set(id, { bytesReceived: 0, bytesTotal: entry.bytesTotal });

  try {
    await downloadFile(entry.url, filePath(entry.filename), (received, total) => {
      downloads.set(id, { bytesReceived: received, bytesTotal: total ?? entry.bytesTotal });
    });
    for (const extra of entry.extraFiles ?? []) {
      await downloadFile(extra.url, filePath(extra.filename));
    }
    downloads.delete(id);
    return listSpeechModels().find((model) => model.id === id)!;
  } catch (error) {
    downloads.set(id, {
      bytesReceived: downloads.get(id)?.bytesReceived ?? 0,
      bytesTotal: entry.bytesTotal,
      error: error instanceof Error ? error.message : 'Download failed'
    });
    throw error;
  }
}
