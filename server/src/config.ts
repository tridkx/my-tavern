import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(serverRoot, '..');

export const DATA_DIR = process.env.MY_TAVERN_DATA
  ? path.resolve(process.env.MY_TAVERN_DATA)
  : path.join(projectRoot, 'data');

export const DB_PATH = path.join(DATA_DIR, 'my-tavern.db');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const AUDIO_DIR = path.join(UPLOAD_DIR, 'audio');
export const IMAGE_DIR = path.join(UPLOAD_DIR, 'images');

export const PORT = Number(process.env.PORT || 3000);
export const HOST = process.env.HOST || '0.0.0.0';
export const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';
export const PUBLIC_DIR = path.join(serverRoot, '..', 'web', 'dist');
export const IS_PROD = process.env.NODE_ENV === 'production';

export function ensureDataDirs() {
  for (const dir of [DATA_DIR, UPLOAD_DIR, AUDIO_DIR, IMAGE_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
