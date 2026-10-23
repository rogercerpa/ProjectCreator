const fs = require('fs-extra');
const path = require('path');

const RENAME_RETRY_DELAYS_MS = [25, 75, 150, 300];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Windows briefly locks files that antivirus/OneDrive/indexers are touching, so
// rename can fail with EPERM/EBUSY/EACCES even though the target is writable.
async function renameWithRetry(from, to) {
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.rename(from, to);
      return;
    } catch (error) {
      const retryable = ['EPERM', 'EBUSY', 'EACCES'].includes(error.code);
      if (!retryable || attempt >= RENAME_RETRY_DELAYS_MS.length) throw error;
      await sleep(RENAME_RETRY_DELAYS_MS[attempt]);
    }
  }
}

/**
 * Write a file so readers only ever see the old contents or the new contents,
 * never a truncated mix. When `backup` is true the previous file is kept as
 * `<file>.bak` and used by readJsonWithRecovery if the main file is corrupt.
 */
async function writeFileAtomic(filePath, contents, { backup = false } = {}) {
  await fs.ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;

  try {
    await fs.writeFile(tempPath, contents, 'utf8');
    if (backup && (await fs.pathExists(filePath))) {
      await fs.copy(filePath, `${filePath}.bak`, { overwrite: true });
    }
    await renameWithRetry(tempPath, filePath);
  } catch (error) {
    await fs.remove(tempPath).catch(() => {});
    throw error;
  }
}

async function writeJsonAtomic(filePath, data, options = {}) {
  const { space, ...writeOptions } = options;
  await writeFileAtomic(filePath, JSON.stringify(data, null, space), writeOptions);
}

/**
 * Read JSON, falling back to `<file>.bak` when the main file is unreadable.
 * Returns `fallback` only when neither file exists. Throws when data exists but
 * cannot be parsed, so callers never mistake a corrupt file for an empty one.
 */
async function readJsonWithRecovery(filePath, fallback) {
  const backupPath = `${filePath}.bak`;

  if (!(await fs.pathExists(filePath))) {
    if (await fs.pathExists(backupPath)) {
      console.warn(`[AtomicJsonFile] ${path.basename(filePath)} missing, restoring from backup`);
      return JSON.parse(await fs.readFile(backupPath, 'utf8'));
    }
    return fallback;
  }

  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (primaryError) {
    const corruptCopy = `${filePath}.corrupt-${Date.now()}`;
    await fs.copy(filePath, corruptCopy).catch(() => {});
    console.error(`[AtomicJsonFile] ${filePath} is unreadable (copied to ${corruptCopy}):`, primaryError.message);

    if (await fs.pathExists(backupPath)) {
      const recovered = JSON.parse(await fs.readFile(backupPath, 'utf8'));
      console.warn(`[AtomicJsonFile] Recovered ${path.basename(filePath)} from backup`);
      return recovered;
    }

    const error = new Error(`${path.basename(filePath)} is corrupt and no backup is available. A copy was saved to ${corruptCopy}.`);
    error.code = 'DATA_FILE_CORRUPT';
    throw error;
  }
}

/** Runs async tasks one at a time, in call order. A failed task does not block later ones. */
function createSerialQueue() {
  let tail = Promise.resolve();
  return function runExclusive(task) {
    const run = tail.then(() => task());
    tail = run.catch(() => {});
    return run;
  };
}

module.exports = {
  writeFileAtomic,
  writeJsonAtomic,
  readJsonWithRecovery,
  createSerialQueue
};
