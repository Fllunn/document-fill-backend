import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * docx → pdf через обычный LibreOffice (soffice), отдельный процесс на каждую конвертацию.
 * Память занята только на время конвертации (~200 МБ), в простое — 0.
 * Версия LibreOffice — в Dockerfile (24.8: PDF совпадают с прежним WASM-конвертером).
 */
export class SofficeTimeoutError extends Error {}

const SOFFICE = process.env.SOFFICE_PATH || 'soffice';
// общий профиль LibreOffice: создаётся один раз при старте (warmUp), дальше каждый запуск быстрее
const PROFILE_URL = `file://${path.join(os.tmpdir(), 'lo-profile')}`;

export class SofficeConverter {
  // строго по одной: общий профиль не допускает двух процессов сразу, а на 1 vCPU параллельность только мешает
  private queue: Promise<unknown> = Promise.resolve();

  /** timeoutMs считается от запуска процесса, ожидание в очереди не входит */
  convert(docx: Buffer, timeoutMs: number): Promise<Buffer> {
    const result = this.queue.then(() => this.run(docx, timeoutMs));
    this.queue = result.catch(() => undefined);
    return result;
  }

  /** создать профиль заранее, чтобы первый PDF не тратил на это 2–3 секунды */
  warmUp(timeoutMs: number): Promise<void> {
    const result = this.queue.then(() => this.inTempDir((dir) => this.exec(['--terminate_after_init'], timeoutMs, dir)));
    this.queue = result.catch(() => undefined);
    return result;
  }

  private run(docx: Buffer, timeoutMs: number): Promise<Buffer> {
    return this.inTempDir(async (dir) => {
      const input = path.join(dir, 'document.docx');
      await fs.writeFile(input, docx);
      await this.exec(['--convert-to', 'pdf', '--outdir', dir, input], timeoutMs, dir);
      return fs.readFile(path.join(dir, 'document.pdf'));
    });
  }

  // своя временная папка на каждый запуск: туда же пишет временные файлы LibreOffice (TMPDIR), после — удаляется
  private async inTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-'));
    try {
      return await fn(dir);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }

  private exec(args: string[], timeoutMs: number, tmpDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // detached: своя группа процессов — по таймауту убиваем soffice вместе с дочерним soffice.bin
      const child = spawn(
        SOFFICE,
        [`-env:UserInstallation=${PROFILE_URL}`, '--headless', '--invisible', '--norestore', '--nolockcheck', '--nodefault', '--nologo', ...args],
        { detached: true, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, TMPDIR: tmpDir } },
      );
      let stderr = '';
      let timedOut = false;
      child.stderr.on('data', (chunk) => (stderr = (stderr + chunk).slice(-2000)));

      const timer = setTimeout(() => {
        timedOut = true;
        try {
          process.kill(-child.pid!, 'SIGKILL');
        } catch {
        }
      }, timeoutMs);

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) return reject(new SofficeTimeoutError(`soffice: таймаут ${timeoutMs} мс`));
        if (code !== 0) return reject(new Error(`soffice: код ${code}: ${stderr.trim()}`));
        resolve();
      });
    });
  }
}
