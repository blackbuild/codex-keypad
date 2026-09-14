import { mkdir, readFile, rename, utimes, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { CodexControlSurfaceState } from './control-surface-state.ts';

export class ControlSurfaceStatePublisher {
  private readonly outputPath: string;

  constructor(outputPath: string) {
    this.outputPath = outputPath;
  }

  async publish(state: CodexControlSurfaceState): Promise<boolean> {
    const serialized = `${JSON.stringify(state, undefined, 2)}\n`;
    if (await readExisting(this.outputPath) === serialized) {
      const now = new Date();
      await utimes(this.outputPath, now, now);
      return false;
    }

    await mkdir(dirname(this.outputPath), { recursive: true });
    const temporaryPath = `${this.outputPath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, serialized, { encoding: 'utf8', mode: 0o600 });
    await rename(temporaryPath, this.outputPath);
    return true;
  }
}

async function readExisting(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}
