import { exec } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import fs from 'fs-extra';

//note we are promisifying exec to use async/await so the spinner show
//otherwise the cli would just pause and show project created successfully
//which is ugly
const execAsync = promisify(exec);

export type FetchEntry = {
  repoPath: string;
  destPath?: string;
};

export async function fetchGitHubFolders(
  repoUrl: string,
  entries: FetchEntry[],
  targetPath: string,
): Promise<void> {
  const tempDir = path.join(os.tmpdir(), `lynx-template-${Date.now()}`);
  await fs.ensureDir(tempDir);

  try {
    let cloned = false;
    try {
      await execAsync(
        `git clone --depth 1 --filter=blob:none --sparse "${repoUrl}" "${tempDir}"`,
      );

      const repoPaths = entries.map((n) => n.repoPath);
      if (repoPaths.length > 0) {
        const args = repoPaths
          .map((p) => `"${p.replace(/"/g, '\\"')}"`)
          .join(' ');
        await execAsync(`git -C "${tempDir}" sparse-checkout set ${args}`);
      }

      cloned = true;
    } catch (err) {
      // Sparse clone not supported or failed; fall back to a shallow full clone.
      try {
        await fs.remove(tempDir);
        await execAsync(`git clone --depth 1 "${repoUrl}" "${tempDir}"`);
        cloned = true;
      } catch (err2) {
        throw new Error(
          `Failed to clone repository ${repoUrl}: ${err2 ?? err}`,
        );
      }
    }

    if (!cloned) {
      throw new Error(`Failed to clone repository ${repoUrl}`);
    }

    for (const entry of entries) {
      const sourcePath = path.join(tempDir, entry.repoPath);
      if (!(await fs.pathExists(sourcePath))) {
        console.warn(`Template folder not found in repo: ${entry.repoPath}`);
        continue;
      }

      const destSub = entry.destPath || '';
      const destFull = path.join(targetPath, destSub);
      await fs.ensureDir(destFull);
      await fs.copy(sourcePath, destFull, {
        overwrite: true,
        errorOnExist: false,
      });
    }
  } finally {
    try {
      await fs.remove(tempDir);
    } catch {
      // Ignore cleanup errors
    }
  }
}
