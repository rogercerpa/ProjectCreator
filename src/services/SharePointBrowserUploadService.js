const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * SharePoint Browser Upload Service
 * Handles automated SharePoint uploads using browser automation
 */
class SharePointBrowserUploadService {
  constructor() {
    this.settings = null;
    this.browser = null;
    this.page = null;
  }

  /**
   * Initialize the service with settings
   * @param {Object} settings - SharePoint settings
   */
  initialize(settings) {
    this.settings = settings;
    console.log('SharePoint Browser Upload Service initialized with settings:', {
      enabled: settings?.enabled,
      url: settings?.sharePointUrl ? 'URL provided' : 'No URL'
    });
  }

  /**
   * Parse SharePoint URL to extract components
   * @param {string} sharePointUrl - SharePoint URL
   * @returns {Object} Parsed URL components
   */
  parseSharePointUrl(sharePointUrl) {
    try {
      console.log('Parsing SharePoint URL:', sharePointUrl);
      
      const urlObj = new URL(sharePointUrl);
      const hostname = urlObj.hostname; // e.g., "acuitybrandsinc.sharepoint.com"
      const tenant = hostname.split('.')[0]; // e.g., "acuitybrandsinc"
      
      // Handle Forms/AllItems.aspx URLs with id parameter (your format)
      if (sharePointUrl.includes('/Forms/AllItems.aspx') && sharePointUrl.includes('id=')) {
        const pathParts = urlObj.pathname.split('/');
        
        // Find site name in path
        const sitesIndex = pathParts.indexOf('sites');
        const siteName = sitesIndex >= 0 && sitesIndex + 1 < pathParts.length ? 
          pathParts[sitesIndex + 1] : 'Unknown';
        
        // Extract folder path from id parameter
        const urlParams = new URLSearchParams(urlObj.search);
        const idParam = urlParams.get('id');
        let folderPath = '';
        
        if (idParam) {
          // id parameter format: /sites/CIDesignSolutions/Shared Documents/LnT
          const idDecoded = decodeURIComponent(idParam);
          console.log('ID parameter decoded:', idDecoded);
          
          const match = idDecoded.match(/\/sites\/[^\/]+\/Shared Documents\/(.+)/);
          if (match) {
            folderPath = match[1];
          }
        }
        
        const result = {
          tenant,
          siteName,
          siteUrl: `https://${hostname}/sites/${siteName}/Shared Documents`,
          documentsUrl: sharePointUrl, // Use the exact URL provided
          folderPath: folderPath || '',
          originalUrl: sharePointUrl
        };
        
        console.log('Parsed Forms/AllItems.aspx URL:', result);
        return result;
      }
      
      // Handle OneDrive-style SharePoint URLs (:f: format)
      if (sharePointUrl.includes('sharepoint.com/:f:/')) {
        const pathParts = urlObj.pathname.split('/');
        
        // Find site name in path
        const sitesIndex = pathParts.indexOf('sites');
        const siteName = sitesIndex >= 0 && sitesIndex + 1 < pathParts.length ? 
          pathParts[sitesIndex + 1] : 'Unknown';
        
        // Extract folder path from URL parameters
        const urlParams = new URLSearchParams(urlObj.search);
        let folderPath = '';
        
        // Look for folder path in various parameter formats
        for (const [key, value] of urlParams.entries()) {
          if (key.includes('id') && value.includes('/')) {
            const match = value.match(/\/sites\/[^\/]+\/Shared Documents\/(.+)/);
            if (match) {
              folderPath = match[1];
              break;
            }
          }
        }
        
        // Construct base SharePoint site URL for navigation
        const siteUrl = `https://${hostname}/sites/${siteName}/Shared Documents`;
        const documentsUrl = folderPath ? 
          `${siteUrl}/Forms/AllItems.aspx?RootFolder=%2Fsites%2F${siteName}%2FShared%20Documents%2F${encodeURIComponent(folderPath)}` :
          `${siteUrl}/Forms/AllItems.aspx`;
        
        const result = {
          tenant,
          siteName,
          siteUrl,
          documentsUrl,
          folderPath: folderPath || '',
          originalUrl: sharePointUrl
        };
        
        console.log('Parsed OneDrive-style SharePoint URL:', result);
        return result;
      }
      
      // Handle direct SharePoint document library URLs
      if (sharePointUrl.includes('/Shared Documents/')) {
        const pathParts = urlObj.pathname.split('/');
        const sitesIndex = pathParts.indexOf('sites');
        const siteName = sitesIndex >= 0 && sitesIndex + 1 < pathParts.length ? 
          pathParts[sitesIndex + 1] : 'Unknown';
        
        const documentsIndex = pathParts.indexOf('Documents');
        const folderPath = documentsIndex >= 0 && documentsIndex + 1 < pathParts.length ?
          pathParts.slice(documentsIndex + 1).join('/') : '';
        
        const siteUrl = `https://${hostname}/sites/${siteName}/Shared Documents`;
        
        const result = {
          tenant,
          siteName,
          siteUrl,
          documentsUrl: sharePointUrl,
          folderPath,
          originalUrl: sharePointUrl
        };
        
        console.log('Parsed direct SharePoint URL:', result);
        return result;
      }
      
      throw new Error('Unsupported SharePoint URL format');
      
    } catch (error) {
      console.error('Error parsing SharePoint URL:', error);
      throw new Error(`Invalid SharePoint URL: ${error.message}`);
    }
  }

  /**
   * Find Chrome executable on Windows
   * @returns {string|null} Path to Chrome executable
   */
  findChromeExecutable() {
    const possiblePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
      path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe')
    ];
    
    for (const chromePath of possiblePaths) {
      if (fs.existsSync(chromePath)) {
        console.log('Found Chrome at:', chromePath);
        return chromePath;
      }
    }
    
    // Try using 'where' command on Windows
    try {
      const { execSync } = require('child_process');
      const result = execSync('where chrome', { encoding: 'utf8' }).trim();
      if (result && fs.existsSync(result)) {
        console.log('Found Chrome via where command:', result);
        return result;
      }
    } catch (error) {
      console.log('Could not find Chrome via where command');
    }
    
    console.log('Chrome not found, will use Puppeteer default');
    return null;
  }

  /**
   * Launch browser with persistent profile
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<void>}
   */
  async launchBrowser(progressCallback) {
    try {
      console.log('🚀 Launching Chrome browser...');
      
      if (progressCallback) {
        progressCallback({
          phase: 'browser',
          progress: 20,
          message: 'Launching Chrome browser...'
        });
      }
      
      // Use persistent profile for login session
      const userDataDir = path.join(os.homedir(), 'AppData', 'Local', 'ProjectCreator', 'ChromeProfile');
      await fs.ensureDir(userDataDir);
      
      const chromeExecutable = this.findChromeExecutable();
      
      const launchOptions = {
        headless: false, // Keep visible for user interaction
        userDataDir: userDataDir, // Persistent profile for login sessions
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-default-apps',
          '--disable-extensions-except',
          '--disable-extensions',
          '--window-size=1200,800'
        ],
        defaultViewport: null,
        ignoreDefaultArgs: ['--enable-automation']
      };
      
      // Use system Chrome if found
      if (chromeExecutable) {
        launchOptions.executablePath = chromeExecutable;
        console.log('Using system Chrome:', chromeExecutable);
      } else {
        console.log('Using Puppeteer bundled Chromium');
      }
      
      console.log('Launch options:', {
        headless: launchOptions.headless,
        userDataDir: launchOptions.userDataDir,
        executablePath: launchOptions.executablePath || 'default'
      });
      
      this.browser = await puppeteer.launch(launchOptions);
      this.page = await this.browser.newPage();
      
      // Set user agent to avoid bot detection
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
      
      console.log('✅ Browser launched successfully');
      
      if (progressCallback) {
        progressCallback({
          phase: 'browser',
          progress: 30,
          message: 'Browser launched successfully'
        });
      }
      
    } catch (error) {
      console.error('❌ Failed to launch browser:', error);
      throw new Error(`Failed to launch browser: ${error.message}`);
    }
  }

  /**
   * Navigate to SharePoint and handle login
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<void>}
   */
  async navigateToSharePoint(progressCallback) {
    try {
      if (!this.settings?.sharePointUrl) {
        throw new Error('SharePoint URL not configured');
      }
      
      console.log('🌐 Navigating to SharePoint...');
      
      if (progressCallback) {
        progressCallback({
          phase: 'browser',
          progress: 40,
          message: 'Navigating to SharePoint...'
        });
      }
      
      // Parse URL to get proper documents page
      const urlInfo = this.parseSharePointUrl(this.settings.sharePointUrl);
      const targetUrl = urlInfo.documentsUrl;
      
      console.log('🔍 DEBUGGING NAVIGATION:');
      console.log('Original URL:', this.settings.sharePointUrl);
      console.log('Parsed URL Info:', urlInfo);
      console.log('Target URL for navigation:', targetUrl);
      
      // Navigate to SharePoint
      console.log('📍 Navigating to target URL...');
      await this.page.goto(targetUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Check actual final URL after navigation
      const finalUrl = this.page.url();
      console.log('📍 Final URL after navigation:', finalUrl);
      
      // Handle potential login
      await this.handleLoginIfRequired();
      
      // Check URL again after login
      const postLoginUrl = this.page.url();
      console.log('📍 URL after login handling:', postLoginUrl);
      
      // Verify we're on the correct page and can see upload functionality
      await this.verifySharePointPage();
      
      // Final URL verification
      const verifiedUrl = this.page.url();
      console.log('📍 Final verified URL:', verifiedUrl);
      
      // Check if we ended up in the correct folder
      const isInCorrectFolder = await this.verifyCorrectFolder();
      if (!isInCorrectFolder) {
        console.log('⚠️  WARNING: Not in the expected SharePoint folder!');
      }
      
      console.log('✅ Successfully navigated to SharePoint');
      
      if (progressCallback) {
        progressCallback({
          phase: 'browser',
          progress: 60,
          message: 'Successfully accessed SharePoint'
        });
      }
      
    } catch (error) {
      console.error('❌ Failed to navigate to SharePoint:', error);
      throw new Error(`Failed to navigate to SharePoint: ${error.message}`);
    }
  }

  /**
   * Handle Microsoft login if required
   * @returns {Promise<void>}
   */
  async handleLoginIfRequired() {
    try {
      console.log('🔐 Checking for login requirement...');
      
      // Wait a moment for page to load
      await this.page.waitForFunction(() => true, { timeout: 3000 }).catch(() => {});
      
      const currentUrl = this.page.url();
      console.log('Current URL:', currentUrl);
      
      // Check if we're on a Microsoft login page
      if (currentUrl.includes('login.microsoftonline.com') || 
          currentUrl.includes('login.microsoft.com') ||
          currentUrl.includes('account.microsoft.com')) {
        
        console.log('🔐 Microsoft login page detected, waiting for user authentication...');
        
        // Wait for user to complete login (up to 5 minutes)
        let loginCompleted = false;
        const maxWaitTime = 5 * 60 * 1000; // 5 minutes
        const startTime = Date.now();
        
        while (!loginCompleted && (Date.now() - startTime) < maxWaitTime) {
          await this.page.waitForFunction(() => true, { timeout: 5000 }).catch(() => {});
          
          const currentUrl = this.page.url();
          
          // Check if we've been redirected away from login
          if (!currentUrl.includes('login.microsoftonline.com') && 
              !currentUrl.includes('login.microsoft.com') &&
              !currentUrl.includes('account.microsoft.com')) {
            loginCompleted = true;
            console.log('✅ Login completed, redirected to:', currentUrl);
          }
        }
        
        if (!loginCompleted) {
          throw new Error('Login timeout - please complete authentication faster');
        }
      } else {
        console.log('✅ No login required or already authenticated');
      }
      
    } catch (error) {
      console.error('❌ Login handling failed:', error);
      throw error;
    }
  }

  /**
   * Verify we're on the correct SharePoint page
   * @returns {Promise<void>}
   */
  async verifySharePointPage() {
    try {
      console.log('🔍 Verifying SharePoint page...');
      
      // Wait for page elements to load
      await this.page.waitForFunction(() => true, { timeout: 5000 }).catch(() => {});
      
      // Check for SharePoint indicators
      const pageContent = await this.page.content();
      const isSharePointPage = pageContent.includes('SharePoint') || 
                              pageContent.includes('_spPageContextInfo') ||
                              this.page.url().includes('sharepoint.com');
      
      if (!isSharePointPage) {
        throw new Error('Not on a SharePoint page');
      }
      
      // Look for upload functionality
      const hasUploadButton = await this.page.evaluate(() => {
        const uploadSelectors = [
          'button[name="Upload"]',
          'button[data-automation-id="uploadButton"]',
          'button[aria-label*="Upload"]',
          '[data-automation-id="newCommand"]'
        ];
        
        return uploadSelectors.some(selector => document.querySelector(selector));
      });
      
      if (!hasUploadButton) {
        console.log('⚠️  Upload button not immediately visible, but continuing...');
      } else {
        console.log('✅ Upload functionality detected');
      }
      
    } catch (error) {
      console.error('❌ SharePoint page verification failed:', error);
      throw error;
    }
  }

  /**
   * Verify we're in the correct SharePoint folder
   * @returns {Promise<boolean>}
   */
  async verifyCorrectFolder() {
    try {
      console.log('🔍 Verifying correct SharePoint folder...');
      
      const currentUrl = this.page.url();
      const expectedFolder = 'LnT'; // The folder we want to be in
      
      // Check if URL contains the expected folder path
      const urlContainsFolder = currentUrl.includes(expectedFolder) || 
                               currentUrl.includes(encodeURIComponent(expectedFolder));
      
      // Check page content for folder indicators
      const folderIndicators = await this.page.evaluate((folderName) => {
        const pageText = document.body.innerText;
        const title = document.title;
        
        // Check breadcrumb or navigation elements
        const breadcrumbs = Array.from(document.querySelectorAll('nav, .ms-Breadcrumb, [role="navigation"]'));
        const hasFolderInBreadcrumb = breadcrumbs.some(nav => 
          nav.textContent && nav.textContent.includes(folderName)
        );
        
        // Check page title or heading
        const hasFolderInTitle = title.includes(folderName);
        
        // Check for folder name in page content
        const hasFolderInContent = pageText.includes(folderName);
        
        return {
          inBreadcrumb: hasFolderInBreadcrumb,
          inTitle: hasFolderInTitle,
          inContent: hasFolderInContent,
          pageTitle: title,
          currentPath: window.location.pathname
        };
      }, expectedFolder);
      
      console.log('📁 Folder verification results:', {
        urlContainsFolder,
        folderIndicators,
        currentUrl
      });
      
      const isInCorrectFolder = urlContainsFolder || 
                               folderIndicators.inBreadcrumb || 
                               folderIndicators.inTitle;
      
      if (isInCorrectFolder) {
        console.log(`✅ Confirmed: In correct folder (${expectedFolder})`);
      } else {
        console.log(`❌ WARNING: Not in expected folder (${expectedFolder})`);
        console.log('Current location indicators:', folderIndicators);
      }
      
      return isInCorrectFolder;
      
    } catch (error) {
      console.error('❌ Folder verification failed:', error);
      return false;
    }
  }

  /**
   * Perform automated upload
   * @param {string} filePath - Path to file to upload
   * @param {string} fileName - Name of file
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<boolean>}
   */
  async automatedUpload(filePath, fileName, progressCallback) {
    try {
      console.log('📤 Starting automated upload process...');
      
      if (progressCallback) {
        progressCallback({
          phase: 'uploading',
          progress: 70,
          message: 'Starting automated upload...'
        });
      }
      
      // Try different upload strategies
      const uploadSuccess = await this.tryUploadStrategies(filePath, progressCallback);
      
      if (!uploadSuccess) {
        // Fallback to manual upload with instructions
        console.log('🔄 Automated upload failed, falling back to manual process...');
        return await this.fallbackToManualUpload(filePath, fileName, progressCallback);
      }
      
      // Monitor upload completion
      const monitorResult = await this.monitorUploadCompletion(fileName, progressCallback);
      
      // Cleanup browser after completion
      await this.cleanupBrowser();
      
      return monitorResult.includes('successful');
      
    } catch (error) {
      console.error('❌ Automated upload failed:', error);
      
      // Try manual fallback
      return await this.fallbackToManualUpload(filePath, fileName, progressCallback);
    }
  }

  /**
   * Try different upload strategies
   * @param {string} filePath - Path to file to upload
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<boolean>}
   */
  async tryUploadStrategies(filePath, progressCallback) {
    const strategies = [
      () => this.uploadViaCommandBar(filePath, progressCallback),
      () => this.uploadViaUploadButton(filePath, progressCallback),
      () => this.uploadViaFileInput(filePath, progressCallback)
    ];
    
    for (let i = 0; i < strategies.length; i++) {
      try {
        console.log(`🔄 Trying upload strategy ${i + 1}/${strategies.length}...`);
        
        const success = await strategies[i]();
        if (success) {
          console.log(`✅ Upload strategy ${i + 1} succeeded`);
          return true;
        }
        
        console.log(`❌ Upload strategy ${i + 1} failed, trying next...`);
      } catch (error) {
        console.log(`❌ Upload strategy ${i + 1} error:`, error.message);
      }
    }
    
    return false;
  }

  /**
   * Upload via command bar (Upload > Files)
   * @param {string} filePath - Path to file to upload
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<boolean>}
   */
  async uploadViaCommandBar(filePath, progressCallback) {
    try {
      console.log('🔄 Attempting upload via command bar...');
      
      // Look for Upload button by text content first
      const uploadButton = await this.page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"], [data-automation-id*="upload"], [data-automation-id*="Upload"]'));
        return buttons.find(btn => {
          const text = btn.textContent || btn.innerText || btn.getAttribute('aria-label') || '';
          return text.toLowerCase().includes('upload');
        });
      });
      
      if (!uploadButton.asElement()) {
        console.log('Upload button not found via command bar');
        return false;
      }
      
      console.log('📤 Found Upload button, clicking...');
      await uploadButton.click();
      
      // Wait for menu to appear and look for "Files" option
      await this.page.waitForFunction(() => true, { timeout: 3000 }).catch(() => {});
      
      // Look for Files menu option by text content
      const filesOption = await this.page.evaluateHandle(() => {
        const menuItems = Array.from(document.querySelectorAll('button, [role="menuitem"], [role="option"], li, div[data-automation-id], span'));
        return menuItems.find(item => {
          const text = item.textContent || item.innerText || '';
          return text.trim().toLowerCase() === 'files';
        });
      });
      
      if (!filesOption.asElement()) {
        console.log('Files option not found in upload menu');
        return false;
      }
      
      console.log('📁 Found Files option, clicking...');
      await filesOption.click();
      
      // Wait longer for file dialog to appear
      console.log('⏳ Waiting for file dialog to open...');
      await this.page.waitForFunction(() => true, { timeout: 15000 }).catch(() => {});
      
      // Try multiple times to find and use file input
      let fileInput = null;
      const maxAttempts = 10;
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`🔍 Looking for file input (attempt ${attempt}/${maxAttempts})...`);
        
        fileInput = await this.page.$('input[type="file"]');
        
        if (fileInput) {
          console.log('✅ File input found!');
          break;
        }
        
        // Wait between attempts
        await this.page.waitForFunction(() => true, { timeout: 2000 }).catch(() => {});
      }
      
      if (!fileInput) {
        console.log('❌ File input not found after waiting');
        return false;
      }
      
      // Verify file exists before upload
      if (!await fs.pathExists(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      console.log('✅ File exists, uploading...');
      await fileInput.uploadFile(filePath);
      console.log('✅ File uploaded via command bar method');
      
      return true;
      
    } catch (error) {
      console.log('❌ Command bar upload failed:', error.message);
      return false;
    }
  }

  /**
   * Upload via generic upload button
   * @param {string} filePath - Path to file to upload
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<boolean>}
   */
  async uploadViaUploadButton(filePath, progressCallback) {
    try {
      console.log('🔄 Attempting upload via upload button...');
      
      const uploadSelectors = [
        'button[data-automation-id="uploadButton"]',
        'button[name="Upload"]',
        'button[aria-label*="Upload"]',
        '[data-automation-id="newCommand"]'
      ];
      
      for (const selector of uploadSelectors) {
        const button = await this.page.$(selector);
        if (button) {
          console.log(`📤 Found upload button: ${selector}`);
          await button.click();
          
          // Wait for file input
          await this.page.waitForFunction(() => true, { timeout: 5000 }).catch(() => {});
          
          const fileInput = await this.page.$('input[type="file"]');
          if (fileInput) {
            console.log('✅ File input found, uploading...');
            await fileInput.uploadFile(filePath);
            return true;
          }
        }
      }
      
      return false;
      
    } catch (error) {
      console.log('❌ Upload button method failed:', error.message);
      return false;
    }
  }

  /**
   * Upload via direct file input
   * @param {string} filePath - Path to file to upload
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<boolean>}
   */
  async uploadViaFileInput(filePath, progressCallback) {
    try {
      console.log('🔄 Attempting upload via direct file input...');
      
      const fileInput = await this.page.$('input[type="file"]');
      if (!fileInput) {
        console.log('No file input found');
        return false;
      }
      
      console.log('📁 Found file input, uploading...');
      await fileInput.uploadFile(filePath);
      
      // Try to trigger upload submission
      await this.triggerUploadSubmission();
      
      return true;
      
    } catch (error) {
      console.log('❌ File input upload failed:', error.message);
      return false;
    }
  }

  /**
   * Trigger upload submission after file selection
   * @returns {Promise<void>}
   */
  async triggerUploadSubmission() {
    try {
      // Look for submit/upload buttons
      const submitSelectors = [
        'button[type="submit"]',
        'button[data-automation-id*="submit"]',
        'button[data-automation-id*="upload"]',
        'input[type="submit"]'
      ];
      
      for (const selector of submitSelectors) {
        const button = await this.page.$(selector);
        if (button) {
          console.log(`Clicking submit button: ${selector}`);
          await button.click();
          return;
        }
      }
      
      console.log('No submit button found, upload may be automatic');
      
    } catch (error) {
      console.log('Error triggering submission:', error.message);
    }
  }

  /**
   * Monitor upload completion
   * @param {string} fileName - Name of uploaded file
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<string>}
   */
  async monitorUploadCompletion(fileName, progressCallback) {
    try {
      console.log('📊 Starting STRICT upload monitoring for:', fileName);
      
      const maxWaitTime = 5 * 60 * 1000; // 5 minutes
      const checkInterval = 5000; // 5 seconds (longer interval for more reliable checks)
      let waitTime = 0;
      let consecutiveFailures = 0;
      const maxConsecutiveFailures = 3; // Require multiple confirmations
      
      return new Promise(async (resolve) => {
        const checkProgress = async () => {
          try {
            waitTime += checkInterval;
            
            const completed = await this.page.evaluate((fileName) => {
              console.log('🔍 STRICT CHECK: Looking for uploaded file:', fileName);
              
              // EXTREMELY STRICT file detection - must find actual file in SharePoint document library
              let foundElements = [];
              
              // 1. Look for the file in SharePoint document list with EXACT filename
              const exactFileSelectors = [
                `a[href*="${fileName}"][data-automation-id="ItemName"]`,
                `button[title="${fileName}"][data-automation-id="ItemName"]`,
                `a[title="${fileName}"]`,
                `span[title="${fileName}"]`
              ];
              
              for (const selector of exactFileSelectors) {
                const elements = Array.from(document.querySelectorAll(selector));
                for (const element of elements) {
                  if (element.title === fileName || 
                      (element.href && element.href.endsWith(fileName)) ||
                      element.textContent?.trim() === fileName) {
                    foundElements.push({
                      selector,
                      element: {
                        tagName: element.tagName,
                        title: element.title,
                        href: element.href,
                        textContent: element.textContent?.trim()
                      }
                    });
                  }
                }
              }
              
              if (foundElements.length > 0) {
                console.log('✅ CONFIRMED: Found exact file match:', foundElements);
                return { 
                  success: true, 
                  method: 'exact_file_match', 
                  elements: foundElements,
                  confidence: 'high'
                };
              }
              
              // 2. Check document library table/grid for the file (more specific)
              const documentRows = Array.from(document.querySelectorAll(
                'tr[data-automationid="DetailsRow"], div[data-list-index], div[role="row"]'
              ));
              
              for (const row of documentRows) {
                const rowText = row.textContent || '';
                const rowLinks = Array.from(row.querySelectorAll('a[href]'));
                
                // Check if this row contains our exact filename
                if (rowText.includes(fileName)) {
                  for (const link of rowLinks) {
                    if (link.href && link.href.includes(fileName)) {
                      console.log('✅ CONFIRMED: Found file in document row:', {
                        rowText: rowText.substring(0, 100),
                        linkHref: link.href
                      });
                      return { 
                        success: true, 
                        method: 'document_row_match',
                        confidence: 'high'
                      };
                    }
                  }
                }
              }
              
              // 3. Check for upload progress/errors before declaring failure
              const progressElements = document.querySelectorAll(
                'div[role="progressbar"], div[data-automation-id*="progress"], div[class*="progress"]'
              );
              
              if (progressElements.length > 0) {
                console.log('⏳ Upload still in progress - found progress indicators');
                return { success: false, error: null, inProgress: true };
              }
              
              // 4. Check for upload errors
              const errorElements = document.querySelectorAll(
                'div[role="alert"], div[data-automation-id*="error"], div[class*="error"]'
              );
              
              for (const errorEl of errorElements) {
                const errorText = errorEl.textContent?.toLowerCase() || '';
                if (errorText.includes('upload') && 
                   (errorText.includes('failed') || errorText.includes('error'))) {
                  console.log('❌ Upload error detected:', errorText);
                  return { success: false, error: 'Upload failed - error detected in UI' };
                }
              }
              
              // 5. Check page title and breadcrumb to ensure we're in right location
              const pageTitle = document.title;
              const currentUrl = window.location.href;
              
              if (!currentUrl.includes('LnT') && !pageTitle.includes('LnT')) {
                console.log('❌ Not in correct SharePoint folder - URL/title check failed');
                return { success: false, error: 'Not in correct SharePoint folder' };
              }
              
              console.log('❌ STRICT CHECK FAILED: File not found in SharePoint');
              console.log('Current URL:', currentUrl);
              console.log('Page title:', pageTitle);
              console.log('Looking for file:', fileName);
              
              return { success: false, error: 'File not found after strict verification' };

            }, fileName);

            if (completed.success) {
              console.log(`✅ UPLOAD CONFIRMED via ${completed.method} with ${completed.confidence} confidence`);
              consecutiveFailures = 0; // Reset failure counter
              
              if (progressCallback) {
                progressCallback({
                  phase: 'complete',
                  progress: 100,
                  message: 'Upload verified successfully in SharePoint!'
                });
              }

              // Don't close browser here - let the calling method handle it
              resolve(`Upload successful: ${fileName}`);
              return;
            }

            if (completed.error) {
              console.log('❌ Upload error detected:', completed.error);
              throw new Error(completed.error);
            }

            // Track consecutive failures to avoid infinite monitoring
            if (!completed.inProgress) {
              consecutiveFailures++;
              console.log(`⚠️  File not found (attempt ${consecutiveFailures}/${maxConsecutiveFailures})`);
              
              if (consecutiveFailures >= maxConsecutiveFailures) {
                console.log('❌ Multiple consecutive failures - upload likely failed');
                throw new Error(`File not found after ${maxConsecutiveFailures} attempts - upload failed`);
              }
            } else {
              consecutiveFailures = 0; // Reset if upload is still in progress
              console.log('⏳ Upload in progress - continuing to monitor...');
            }

            // Check timeout
            if (waitTime >= maxWaitTime) {
              console.log('⏰ Upload monitoring timeout reached');
              throw new Error('Upload monitoring timeout - file was not verified in SharePoint');
            }

            // Update progress
            const progress = Math.min(95, 70 + (waitTime / maxWaitTime) * 25);
            const remainingTime = Math.ceil((maxWaitTime - waitTime) / 60000);
            
            if (progressCallback && waitTime % 15000 === 0) { // Update every 15 seconds
              progressCallback({
                phase: 'monitoring',
                progress: progress,
                message: `Strict verification in progress... (${remainingTime} min remaining)`
              });
            }

            // Continue monitoring
            setTimeout(checkProgress, checkInterval);

          } catch (error) {
            console.error('❌ Upload monitoring error:', error);
            resolve(`Upload monitoring failed: ${error.message}`);
          }
        };

        checkProgress();
      });
      
    } catch (error) {
      console.error('❌ Upload monitoring failed:', error);
      return `Upload monitoring failed: ${error.message}`;
    }
  }

  /**
   * Fallback to manual upload with instructions
   * @param {string} filePath - Path to file to upload
   * @param {string} fileName - Name of file
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<boolean>}
   */
  async fallbackToManualUpload(filePath, fileName, progressCallback) {
    try {
      console.log('🔄 Starting manual upload fallback...');
      
      if (progressCallback) {
        progressCallback({
          phase: 'manual',
          progress: 80,
          message: 'Automated upload failed - displaying manual instructions...'
        });
      }
      
      // Show manual upload instructions
      await this.showManualUploadInstructions(filePath, fileName);
      
      // Wait for manual upload completion
      const result = await this.waitForManualUpload(fileName, progressCallback);
      
      return result.includes('successful');
      
    } catch (error) {
      console.error('❌ Manual upload fallback failed:', error);
      throw error;
    }
  }

  /**
   * Show manual upload instructions modal
   * @param {string} filePath - Path to file to upload
   * @param {string} fileName - Name of file
   * @returns {Promise<void>}
   */
  async showManualUploadInstructions(filePath, fileName) {
    try {
      console.log('📋 Displaying manual upload instructions...');
      
      // Copy file path to clipboard for user convenience
      const { clipboard } = require('electron');
      clipboard.writeText(filePath);
      
      // Inject modal into page
      await this.page.evaluate((filePath, fileName) => {
        // Remove any existing modal
        const existingModal = document.getElementById('manual-upload-modal');
        if (existingModal) {
          existingModal.remove();
        }
        
        // Create modal HTML
        const modalHTML = `
          <div id="manual-upload-modal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          ">
            <div style="
              background: white;
              padding: 30px;
              border-radius: 12px;
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
              max-width: 600px;
              width: 90%;
              max-height: 80%;
              overflow-y: auto;
            ">
              <h2 style="
                color: #d32f2f;
                margin: 0 0 20px 0;
                font-size: 24px;
                font-weight: 600;
                display: flex;
                align-items: center;
              ">
                ⚠️ Automated Upload Failed
              </h2>
              
              <div style="margin-bottom: 25px; line-height: 1.6; color: #333;">
                <p style="margin: 0 0 15px 0; font-size: 16px;">
                  The automated upload could not complete. Please upload the file manually using these steps:
                </p>
                
                <ol style="margin: 15px 0; padding-left: 25px; color: #555;">
                  <li style="margin-bottom: 8px;"><strong>Click the "Upload" button</strong> on this SharePoint page</li>
                  <li style="margin-bottom: 8px;"><strong>Select "Files"</strong> from the upload menu</li>
                  <li style="margin-bottom: 8px;"><strong>Navigate to:</strong> <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-family: monospace; word-break: break-all;">${filePath}</code></li>
                  <li style="margin-bottom: 8px;"><strong>Select the file:</strong> <code style="background: #e3f2fd; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${fileName}</code></li>
                  <li style="margin-bottom: 8px;"><strong>Click "Upload"</strong> to complete the process</li>
                </ol>
                
                <div style="
                  background: #e8f5e8;
                  border: 1px solid #4caf50;
                  border-radius: 6px;
                  padding: 12px;
                  margin: 15px 0;
                  font-size: 14px;
                ">
                  📋 <strong>File path copied to clipboard!</strong> You can paste it in the file dialog.
                </div>
              </div>
              
              <button id="manual-upload-continue" style="
                background: #2196f3;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 16px;
                font-weight: 500;
                transition: background 0.2s ease;
                width: 100%;
              ">
                I've Uploaded the File - Continue
              </button>
            </div>
          </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add button event listeners with multiple approaches
        const continueButton = document.getElementById('manual-upload-continue');
        if (continueButton) {
          // Multiple event binding approaches for better compatibility
          continueButton.addEventListener('click', function() {
            console.log('Continue button clicked');
            document.getElementById('manual-upload-modal').style.display = 'none';
            window.manualUploadComplete = true;
          });
          
          continueButton.onclick = function() {
            console.log('Continue button onclick');
            document.getElementById('manual-upload-modal').style.display = 'none';
            window.manualUploadComplete = true;
          };
          
          continueButton.onkeydown = function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
              console.log('Continue button keydown');
              document.getElementById('manual-upload-modal').style.display = 'none';
              window.manualUploadComplete = true;
            }
          };
          
          // Hover effect
          continueButton.addEventListener('mouseenter', function() {
            this.style.background = '#1976d2';
          });
          
          continueButton.addEventListener('mouseleave', function() {
            this.style.background = '#2196f3';
          });
          
          // Focus the button for accessibility
          continueButton.focus();
        }
        
        // Initialize completion flag
        window.manualUploadComplete = false;
        
      }, filePath, fileName);
      
      console.log('✅ Manual upload instructions displayed');
      
    } catch (error) {
      console.error('❌ Failed to show manual upload instructions:', error);
      throw error;
    }
  }

  /**
   * Wait for manual upload completion
   * @param {string} fileName - Name of uploaded file
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<string>}
   */
  async waitForManualUpload(fileName, progressCallback) {
    try {
      console.log('⏳ Waiting for manual upload completion...');
      
      const maxWaitTime = 10 * 60 * 1000; // 10 minutes for manual upload
      const checkInterval = 2000; // 2 seconds
      let waitTime = 0;
      
      return new Promise((resolve) => {
        const checkForFile = async () => {
          try {
            waitTime += checkInterval;
            
            // Check if user clicked continue button
            const userCompleted = await this.page.evaluate(() => {
              return window.manualUploadComplete === true;
            });
            
            if (userCompleted) {
              console.log('✅ User indicated manual upload completed');
              
              if (progressCallback) {
                progressCallback({
                  phase: 'complete',
                  progress: 100,
                  message: 'Manual upload completed successfully!'
                });
              }
              
              resolve(`Manual upload successful: ${fileName}`);
              return;
            }
            
            // Also check if file actually appears in SharePoint
            const fileFound = await this.page.evaluate((fileName) => {
              const pageText = document.body.innerText;
              return pageText.includes(fileName) || 
                     pageText.includes(fileName.replace('.zip', ''));
            }, fileName);
            
            if (fileFound) {
              console.log('✅ File detected in SharePoint after manual upload');
              
              // Hide modal if still visible
              await this.page.evaluate(() => {
                const modal = document.getElementById('manual-upload-modal');
                if (modal) modal.style.display = 'none';
              });
              
              if (progressCallback) {
                progressCallback({
                  phase: 'complete',
                  progress: 100,
                  message: 'Manual upload detected and completed!'
                });
              }
              
              resolve(`Manual upload successful: ${fileName}`);
              return;
            }
            
            // Check timeout
            if (waitTime >= maxWaitTime) {
              console.log('⏰ Manual upload timeout reached');
              resolve(`Manual upload monitoring timeout: ${fileName}`);
              return;
            }
            
            // Update progress
            const remaining = Math.ceil((maxWaitTime - waitTime) / 60000);
            
            if (progressCallback && waitTime % 10000 === 0) { // Update every 10 seconds
              progressCallback({
                phase: 'manual',
                progress: 70,
                message: `Waiting for manual upload... (${remaining} min remaining)`
              });
            }
            
            // Continue checking
            if (waitTime < maxWaitTime) {
              setTimeout(checkForFile, checkInterval);
            } else {
              resolve(`Manual upload monitoring failed: ${fileName}`);
            }
          } catch (error) {
            console.error('❌ Error during manual upload monitoring:', error);
            resolve(`Manual upload monitoring error: ${error.message}`);
          }
        };

        checkForFile();
      });
      
    } catch (error) {
      console.error('❌ Manual upload monitoring failed:', error);
      return `Manual upload monitoring failed: ${error.message}`;
    }
  }

  /**
   * Clean up browser resources
   * @returns {Promise<void>}
   */
  async cleanupBrowser() {
    try {
      console.log('🧹 Cleaning up browser...');
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        console.log('✅ Browser closed successfully');
      }
      
    } catch (error) {
      console.error('⚠️  Error closing browser:', error.message);
    }
  }

  /**
   * Main method to perform complete upload process
   * @param {string} zipPath - Path to ZIP file to upload
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<string>} SharePoint URL of uploaded file
   */
  async performUpload(zipPath, progressCallback) {
    try {
      console.log('🚀 Starting SharePoint browser upload process...');
      
      const fileName = require('path').basename(zipPath);
      
      // Launch browser
      await this.launchBrowser(progressCallback);
      
      // Navigate to SharePoint
      await this.navigateToSharePoint(progressCallback);
      
      // Perform upload and monitoring
      const uploadSuccess = await this.automatedUpload(zipPath, fileName, progressCallback);
      
      if (!uploadSuccess) {
        console.log('❌ Upload process failed, cleaning up...');
        await this.cleanupBrowser();
        throw new Error('Upload process failed');
      }
      
      console.log('✅ SharePoint upload completed successfully');
      
      // Browser cleanup is handled in automatedUpload after monitoring
      return `Upload successful: ${fileName}`;
      
    } catch (error) {
      console.error('❌ SharePoint upload failed:', error);
      
      // Clean up browser on error
      await this.cleanupBrowser();
      
      throw error;
    }
  }
}

module.exports = SharePointBrowserUploadService;
