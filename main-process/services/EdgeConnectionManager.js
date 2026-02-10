const http = require('http');
const https = require('https');
const path = require('path');
const os = require('os');
const { spawn, exec } = require('child_process');

const DEFAULT_DEBUG_PORT = 9222;
const WORKQUEUE_URL = 'https://agile.acuitybrandslighting.net/applications/workqueue2';

/**
 * EdgeConnectionManager
 * Manages connection to Microsoft Edge via Chrome DevTools Protocol (CDP).
 * Detects if Edge is running with remote debugging, connects via puppeteer-core,
 * and finds/creates the Agile workqueue tab. Uses existing Edge profile for SSO.
 */
class EdgeConnectionManager {
  constructor(options = {}) {
    this.debugPort = options.debugPort ?? DEFAULT_DEBUG_PORT;
    this.workqueueUrl = options.workqueueUrl ?? WORKQUEUE_URL;
    this.browser = null;
    this.puppeteer = null;
    this._listeners = [];
  }

  /**
   * Lazy-load puppeteer-core to avoid require at module load (helps with packaging).
   */
  _getPuppeteer() {
    if (!this.puppeteer) {
      this.puppeteer = require('puppeteer-core');
    }
    return this.puppeteer;
  }

  /**
   * Check if Edge is running with remote debugging on the given port.
   * @param {number} [port] - CDP port (default: this.debugPort)
   * @returns {Promise<{ connected: boolean, browserVersion?: string, error?: string }>}
   */
  async checkConnection(port = this.debugPort) {
    return new Promise((resolve) => {
      const url = `http://127.0.0.1:${port}/json/version`;
      const req = http.get(url, { timeout: 3000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve({
              connected: true,
              browserVersion: json.Browser || json.browserVersion || 'unknown'
            });
          } catch {
            resolve({ connected: false, error: 'Invalid CDP response' });
          }
        });
      });
      req.on('error', (err) => {
        resolve({ connected: false, error: err.message || 'Connection refused' });
      });
      req.on('timeout', () => {
        req.destroy();
        resolve({ connected: false, error: 'Connection timeout' });
      });
      req.setTimeout(3000);
    });
  }

  /**
   * Connect to Edge via CDP using puppeteer-core.
   * @param {number} [port] - CDP port
   * @returns {Promise<import('puppeteer-core').Browser>}
   */
  async connect(port = this.debugPort) {
    const status = await this.checkConnection(port);
    if (!status.connected) {
      throw new Error(status.error || 'Edge is not running with remote debugging. Enable it and try again.');
    }
    const puppeteer = this._getPuppeteer();
    this.browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${port}`,
      defaultViewport: null
    });
    this._setupDisconnectHandler();
    return this.browser;
  }

  _setupDisconnectHandler() {
    if (!this.browser) return;
    this.browser.on('disconnected', () => {
      this.browser = null;
      this._listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
    });
  }

  /**
   * Register a listener for disconnect events.
   * @param {() => void} fn
   */
  onDisconnect(fn) {
    if (typeof fn === 'function') this._listeners.push(fn);
  }

  /**
   * Find an existing page that has the workqueue URL, or create a new page and navigate to it.
   * @param {import('puppeteer-core').Browser} browser
   * @returns {Promise<import('puppeteer-core').Page>}
   */
  async getOrCreateWorkqueueTab(browser) {
    const pages = await browser.pages();
    const workqueueOrigin = new URL(this.workqueueUrl).origin;
    const pathAndHash = new URL(this.workqueueUrl).pathname + (new URL(this.workqueueUrl).search || '');

    for (const page of pages) {
      try {
        const url = page.url();
        if (url.startsWith(workqueueOrigin) && url.includes(pathAndHash)) {
          return page;
        }
      } catch {
        // page may be closed
      }
    }

    const page = await browser.newPage();
    await page.goto(this.workqueueUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    return page;
  }

  /**
   * Open a new page and navigate to the given URL. Caller must close the page when done.
   * Used for RFA project details scraping without touching the workqueue tab.
   * @param {import('puppeteer-core').Browser} browser
   * @param {string} url
   * @param {{ timeout?: number }} [options]
   * @returns {Promise<import('puppeteer-core').Page>}
   */
  async openProjectPage(browser, url, options = {}) {
    const page = await browser.newPage();
    const timeout = options.timeout ?? 30000;
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout
    });
    return page;
  }

  /**
   * Get the current browser instance (if connected).
   */
  getBrowser() {
    return this.browser;
  }

  /**
   * Disconnect from Edge (does not close Edge).
   */
  async disconnect() {
    if (this.browser) {
      try {
        this.browser.disconnect();
      } catch (e) {
        console.warn('EdgeConnectionManager disconnect:', e.message);
      }
      this.browser = null;
    }
  }

  /**
   * Get the path to Microsoft Edge on Windows.
   * @returns {string|null}
   */
  _getEdgePath() {
    if (os.platform() !== 'win32') return null;
    const candidates = [
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft\\Edge\\Application\\msedge.exe')
    ];
    const fs = require('fs');
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) return p;
      } catch {}
    }
    return null;
  }

  /**
   * Get the default Edge user data directory (so SSO/cookies are available).
   */
  _getEdgeUserDataDir() {
    if (os.platform() === 'win32') {
      return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Microsoft', 'Edge', 'User Data');
    }
    if (os.platform() === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'Microsoft Edge');
    }
    return path.join(os.homedir(), '.config', 'microsoft-edge');
  }

  /**
   * Check if any Edge processes are currently running.
   * @returns {Promise<boolean>}
   */
  _isEdgeRunning() {
    return new Promise((resolve) => {
      exec('tasklist /FI "IMAGENAME eq msedge.exe" /NH', { windowsHide: true }, (err, stdout) => {
        if (err) { resolve(false); return; }
        resolve(stdout.toLowerCase().includes('msedge.exe'));
      });
    });
  }

  /**
   * Kill all running Edge processes (gracefully first, then force).
   * @returns {Promise<void>}
   */
  _killAllEdge() {
    return new Promise((resolve) => {
      exec('taskkill /IM msedge.exe /F', { windowsHide: true }, () => {
        // Wait a moment for processes to fully terminate
        setTimeout(resolve, 1500);
      });
    });
  }

  /**
   * Launch Microsoft Edge with remote debugging enabled.
   * If Edge is already running without the debug flag, it will close existing
   * Edge instances first (since Edge reuses the existing process and ignores
   * the --remote-debugging-port flag if already running).
   * @param {number} [port] - CDP port
   * @returns {Promise<{ success: boolean, error?: string, message?: string, needsRestart?: boolean }>}
   */
  async launchEdgeWithDebug(port = this.debugPort) {
    if (os.platform() !== 'win32') {
      return { success: false, error: 'Launch with debug port is only supported on Windows.' };
    }

    const edgePath = this._getEdgePath();
    if (!edgePath) {
      return { success: false, error: 'Microsoft Edge executable not found.' };
    }

    // Check if debug port is already active (Edge already in debug mode)
    const alreadyActive = await this.checkConnection(port);
    if (alreadyActive.connected) {
      return { success: true, message: 'Edge is already running with remote debugging.' };
    }

    // Check if Edge is running without the debug flag
    const edgeRunning = await this._isEdgeRunning();
    if (edgeRunning) {
      // Close existing Edge so we can relaunch with the debug flag.
      // Edge reuses the existing process and ignores --remote-debugging-port
      // if another Edge instance is already running with the same user-data-dir.
      console.log('EdgeConnectionManager: Closing existing Edge instances to relaunch with debug port...');
      await this._killAllEdge();

      // Verify Edge is actually closed
      const stillRunning = await this._isEdgeRunning();
      if (stillRunning) {
        return {
          success: false,
          error: 'Could not close existing Edge windows. Please close all Edge windows manually and try again.'
        };
      }
    }

    const userDataDir = this._getEdgeUserDataDir();
    const args = [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--restore-last-session' // Restore tabs the user had open
    ];

    return new Promise((resolve) => {
      try {
        const child = spawn(edgePath, args, {
          detached: true,
          stdio: 'ignore'
        });
        child.unref();

        // Give Edge time to start and open CDP
        const check = async (attempts = 0) => {
          if (attempts > 20) {
            resolve({
              success: false,
              error: 'Edge launched but the debug port did not open in time. Try closing Edge completely and clicking this button again.'
            });
            return;
          }
          const status = await this.checkConnection(port);
          if (status.connected) {
            resolve({ success: true, message: 'Edge restarted with remote debugging enabled. Your previous tabs have been restored.' });
            return;
          }
          setTimeout(() => check(attempts + 1), 500);
        };
        setTimeout(check, 1500);
      } catch (err) {
        resolve({ success: false, error: err.message || 'Failed to launch Edge' });
      }
    });
  }
}

module.exports = EdgeConnectionManager;
