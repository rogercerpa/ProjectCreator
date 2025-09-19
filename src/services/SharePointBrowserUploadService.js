const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

/**
 * SharePointBrowserUploadService - Automated browser upload to SharePoint Online
 * Uses Puppeteer to automate file uploads through the SharePoint web interface
 */
class SharePointBrowserUploadService {
  constructor() {
    this.settings = null;
    this.browser = null;
    this.page = null;
  }

  /**
   * Initialize the service with settings
   * @param {Object} settings - SharePoint settings from app configuration
   */
  initialize(settings) {
    this.settings = settings;
    
    if (!settings || !settings.enabled) {
      console.log('SharePoint browser upload is disabled');
      return;
    }

    console.log('SharePoint browser upload service initialized');
  }

  /**
   * Parse SharePoint URL to get the upload URL
   * @param {string} sharePointUrl - SharePoint folder URL
   * @returns {Object} - Parsed URL information
   */
  parseSharePointUrl(sharePointUrl) {
    try {
      const url = new URL(sharePointUrl);
      
      // Extract site name and folder path
      const pathParts = url.pathname.split('/');
      const sitesIndex = pathParts.findIndex(part => part === 'sites');
      
      if (sitesIndex === -1) {
        throw new Error('Invalid SharePoint URL: cannot find site');
      }
      
      const siteName = pathParts[sitesIndex + 1];
      
      // For :f: URLs, get the folder path from after /r/
      const pathAfterR = url.pathname.split('/r/')[1];
      if (pathAfterR) {
        const decodedPath = decodeURIComponent(pathAfterR);
        const pathSegments = decodedPath.split('/').filter(segment => segment);
        
        // Remove sites/siteName
        const siteIndex = pathSegments.findIndex(segment => segment === 'sites');
        if (siteIndex !== -1) {
          pathSegments.splice(siteIndex, 2);
        }
        
        const libraryName = pathSegments[0] || 'Shared Documents';
        const folderPath = pathSegments.slice(1).join('/') || '';
        
        return {
          tenant: url.hostname,
          siteName,
          libraryName,
          folderPath,
          siteUrl: `${url.protocol}//${url.hostname}/sites/${siteName}`,
          // Create upload URL for SharePoint Online
          uploadUrl: `${url.protocol}//${url.hostname}/sites/${siteName}/_layouts/15/upload.aspx?List=%7B${this.generateListGuid()}%7D&RootFolder=%2Fsites%2F${siteName}%2F${encodeURIComponent(libraryName)}${folderPath ? '%2F' + encodeURIComponent(folderPath) : ''}`
        };
      }
      
      throw new Error('Could not parse folder path from URL');
      
    } catch (error) {
      console.error('Failed to parse SharePoint URL:', error);
      throw new Error('Invalid SharePoint URL format');
    }
  }

  /**
   * Generate a GUID for the document library (placeholder)
   * In production, this would need to be the actual library GUID
   */
  generateListGuid() {
    return 'XXXXXXXX-XXXX-4XXX-YXXX-XXXXXXXXXXXX'.replace(/[XY]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'X' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Launch browser and navigate to SharePoint
   * @param {Function} progressCallback - Progress callback function
   * @returns {Promise<void>}
   */
  async launchBrowser(progressCallback) {
    try {
      if (progressCallback) {
        progressCallback({
          phase: 'browser',
          progress: 10,
          message: 'Launching Chrome browser...'
        });
      }

      // Try to find and use system Chrome first
      let chromeExecutable = null;
      try {
        console.log('🔍 Attempting to find Chrome browser...');
        chromeExecutable = await this.findChromeExecutable();
        console.log('✅ Using system Chrome:', chromeExecutable);
      } catch (error) {
        console.log('❌ Chrome detection failed:', error.message);
        console.log('🔄 Falling back to bundled Chromium');
      }

      // Launch browser with visible window so user can see the upload
      const launchOptions = {
        headless: false, // Visible browser so user can see upload progress
        defaultViewport: { width: 1200, height: 800 },
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-features=VizDisplayCompositor',
          '--start-maximized',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-extensions',
          '--disable-plugins'
        ]
      };

      // Use system Chrome if found
      if (chromeExecutable) {
        launchOptions.executablePath = chromeExecutable;
        
        // Create a separate profile directory for Project Creator to maintain login sessions
        // This avoids conflicts with the main Chrome profile
        try {
          const projectCreatorProfileDir = path.join(os.homedir(), 'AppData', 'Local', 'ProjectCreator', 'ChromeProfile');
          
          // Ensure directory exists
          await fs.ensureDir(projectCreatorProfileDir);
          launchOptions.userDataDir = projectCreatorProfileDir;
          console.log('✅ Using Project Creator Chrome profile for login persistence');
          console.log('📁 Profile location:', projectCreatorProfileDir);
        } catch (error) {
          console.log('⚠️  Could not create Project Creator profile:', error.message);
          console.log('🔄 Using temporary profile instead');
        }
      }

      this.browser = await puppeteer.launch(launchOptions);
      this.page = await this.browser.newPage();
      
      // Set a realistic user agent
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      console.log('Browser launched successfully');

    } catch (error) {
      console.error('Failed to launch browser:', error);
      throw error;
    }
  }

  /**
   * Find Chrome executable on the system
   * @returns {Promise<string>} - Path to Chrome executable
   */
  async findChromeExecutable() {
    const { execSync } = require('child_process');
    
    try {
      // Windows Chrome locations (check most common first)
      const windowsPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
        process.env.USERPROFILE + '\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'
      ];

      console.log('Searching for Chrome browser...');
      
      for (const chromePath of windowsPaths) {
        try {
          console.log('Checking:', chromePath);
          if (await fs.pathExists(chromePath)) {
            console.log('✅ Found Chrome at:', chromePath);
            return chromePath;
          } else {
            console.log('❌ Not found at:', chromePath);
          }
        } catch (e) {
          console.log('❌ Error checking:', chromePath, e.message);
        }
      }

      // Try to find Chrome via registry (Windows)
      try {
        console.log('Trying registry lookup...');
        const regOutput = execSync('reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe" /ve', { encoding: 'utf8' });
        const match = regOutput.match(/REG_SZ\s+(.+)/);
        if (match && match[1]) {
          const chromePath = match[1].trim().replace(/"/g, ''); // Remove quotes
          console.log('Registry returned:', chromePath);
          if (await fs.pathExists(chromePath)) {
            console.log('✅ Found Chrome via registry:', chromePath);
            return chromePath;
          }
        }
      } catch (e) {
        console.log('❌ Registry lookup failed:', e.message);
      }

      // Try using 'where' command as last resort
      try {
        console.log('Trying where command...');
        const whereOutput = execSync('where chrome.exe', { encoding: 'utf8' }).trim();
        if (whereOutput && await fs.pathExists(whereOutput)) {
          console.log('✅ Found Chrome via where command:', whereOutput);
          return whereOutput;
        }
      } catch (e) {
        console.log('❌ Where command failed:', e.message);
      }

      throw new Error('Chrome not found in any location');
      
    } catch (error) {
      console.warn('❌ Could not find Chrome executable:', error.message);
      throw error;
    }
  }

  /**
   * Navigate to SharePoint folder
   * @param {Function} progressCallback - Progress callback function
   * @returns {Promise<void>}
   */
  async navigateToSharePoint(progressCallback) {
    try {
      if (progressCallback) {
        progressCallback({
          phase: 'browser',
          progress: 20,
          message: 'Navigating to SharePoint...'
        });
      }

      const urlInfo = this.parseSharePointUrl(this.settings.sharePointUrl);
      console.log('🔍 Target SharePoint URL:', this.settings.sharePointUrl);
      
      // Navigate to the SharePoint folder URL (user will see the interface)
      await this.page.goto(this.settings.sharePointUrl, { 
        waitUntil: 'networkidle2', 
        timeout: 30000 
      });

      // Check if login is required
      await this.handleLoginIfRequired(progressCallback);

      // Verify we're on the correct page after login/navigation
      const currentUrl = this.page.url();
      console.log('🔍 Current URL after navigation:', currentUrl);
      
      // Check if we got redirected to home page or wrong location
      if (currentUrl.includes('/sites/') && !currentUrl.includes('Documents')) {
        console.log('⚠️  Detected redirect to home/wrong page, navigating back to documents...');
        
        // Try to navigate directly to the documents folder
        console.log('📂 Navigating to documents folder:', this.settings.sharePointUrl);
        
        await this.page.goto(this.settings.sharePointUrl, { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        });
        
        const finalUrl = this.page.url();
        console.log('📂 Final URL after documents navigation:', finalUrl);
        
        // Additional check - if still on wrong page, try alternative URL format
        if (!finalUrl.includes('Documents')) {
          console.log('🔄 Still on wrong page, trying alternative URL format...');
          
          // Convert sharing URL to direct documents URL if needed
          const alternativeUrl = this.settings.sharePointUrl.replace(':f:/r/', '').replace('?csf=1&web=1', '/Forms/AllItems.aspx');
          console.log('🔄 Trying alternative URL:', alternativeUrl);
          
          await this.page.goto(alternativeUrl, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
          });
          
          console.log('🔄 Alternative navigation URL:', this.page.url());
        }
      }
      
      // Wait for page to be fully loaded and check for upload functionality
      await this.page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 });
      
      // Verify upload button is present
      const uploadButtonExists = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(btn => btn.innerText && btn.innerText.toLowerCase().includes('upload'));
      });
      
      if (uploadButtonExists) {
        console.log('✅ Upload button found - on correct documents page');
      } else {
        console.log('⚠️  Upload button not found - may be on wrong page');
        console.log('🔍 Page title:', await this.page.title());
      }

      if (progressCallback) {
        progressCallback({
          phase: 'browser',
          progress: 40,
          message: 'SharePoint loaded successfully'
        });
      }

      console.log('Successfully navigated to SharePoint');

    } catch (error) {
      console.error('Failed to navigate to SharePoint:', error);
      throw error;
    }
  }

  /**
   * Handle Microsoft login if required
   * @param {Function} progressCallback - Progress callback function
   */
  async handleLoginIfRequired(progressCallback) {
    try {
      // Check for common Microsoft login indicators
      const loginSelectors = [
        'input[type="email"]', // Microsoft login email field
        'input[name="loginfmt"]', // Microsoft specific email field
        '#i0116', // Microsoft email input ID
        'input[type="password"]', // Password field
        '#passwordInput', // Password input ID
        '.sign-in-box', // General sign-in container
        '[data-test-id="loginForm"]' // Login form
      ];

      // Wait a bit for page to stabilize
      await this.page.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 });

      // Check if any login elements are present
      let loginDetected = false;
      for (const selector of loginSelectors) {
        try {
          const element = await this.page.$(selector);
          if (element) {
            loginDetected = true;
            console.log('Login required - detected login element:', selector);
            break;
          }
        } catch (e) {
          // Continue checking other selectors
        }
      }

      if (loginDetected) {
        console.log('Microsoft login detected - waiting for user to complete login');
        
        if (progressCallback) {
          progressCallback({
            phase: 'browser',
            progress: 25,
            message: 'Login required - please sign in to Microsoft in the browser window'
          });
        }

        // Wait for login to complete by checking for SharePoint-specific elements
        // or URL change that indicates successful login
        await this.waitForLoginCompletion(progressCallback);
      }

    } catch (error) {
      console.warn('Error checking for login:', error.message);
      // Continue anyway - user might be already logged in
    }
  }

  /**
   * Wait for user to complete login
   * @param {Function} progressCallback - Progress callback function
   */
  async waitForLoginCompletion(progressCallback) {
    const maxWaitTime = 120000; // 2 minutes max wait for login
    const checkInterval = 2000; // Check every 2 seconds
    let waitTime = 0;

    return new Promise((resolve) => {
      const checkLogin = async () => {
        try {
          // Check if we're now on a SharePoint page (successful login)
          const currentUrl = this.page.url();
          
          // Look for SharePoint-specific elements that indicate successful access
          const sharePointIndicators = [
            '[data-automationid="UploadMenu"]', // Upload menu
            '[data-automationid="DetailsListView"]', // File list view
            '.od-TopBar', // OneDrive/SharePoint top bar
            '.ms-CommandBar', // SharePoint command bar
            '.o365cs-nav-appTitle' // Office 365 app title
          ];

          let sharePointLoaded = false;
          for (const selector of sharePointIndicators) {
            try {
              const element = await this.page.$(selector);
              if (element) {
                sharePointLoaded = true;
                break;
              }
            } catch (e) {
              // Continue checking
            }
          }

          if (sharePointLoaded || currentUrl.includes('sharepoint.com') && !currentUrl.includes('login')) {
            console.log('Login completed successfully - SharePoint interface detected');
            
            if (progressCallback) {
              progressCallback({
                phase: 'browser',
                progress: 35,
                message: 'Login successful - accessing SharePoint...'
              });
            }
            
            resolve();
            return;
          }

          // Check if we've exceeded max wait time
          if (waitTime >= maxWaitTime) {
            console.log('Login wait timeout reached - proceeding anyway');
            resolve();
            return;
          }

          // Update progress message
          if (progressCallback && waitTime % 10000 === 0) { // Update every 10 seconds
            const remainingTime = Math.ceil((maxWaitTime - waitTime) / 1000);
            progressCallback({
              phase: 'browser',
              progress: 25,
              message: `Waiting for login completion... (${remainingTime}s remaining)`
            });
          }

          // Continue waiting
          waitTime += checkInterval;
          setTimeout(checkLogin, checkInterval);

        } catch (error) {
          console.warn('Error checking login status:', error.message);
          // Continue waiting
          waitTime += checkInterval;
          if (waitTime < maxWaitTime) {
            setTimeout(checkLogin, checkInterval);
          } else {
            resolve();
          }
        }
      };

      // Start checking
      checkLogin();
    });
  }

  /**
   * Upload file to SharePoint through browser automation
   * @param {string} filePath - Path to the ZIP file to upload
   * @param {Function} progressCallback - Progress callback function
   * @returns {Promise<string>} - SharePoint file URL
   */
  async uploadFile(filePath, progressCallback) {
    try {
      if (progressCallback) {
        progressCallback({
          phase: 'browser',
          progress: 50,
          message: 'Preparing file upload...'
        });
      }

      // Wait a moment for the page to fully load
      await this.page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 });

      // Try to find the upload button/area in SharePoint
      // SharePoint Online has multiple possible upload interfaces
      const uploadSelectors = [
        'input[type="file"]', // File input
        '[data-automationid="uploadButton"]', // Upload button
        '[data-automationid="UploadFileCommand"]', // Another upload button variant
        'button[name="Upload"]', // Generic upload button
        '.ms-CommandBar-item button:contains("Upload")', // Command bar upload
        '[aria-label*="Upload"]' // Any element with Upload in aria-label
      ];

      let uploadElement = null;
      let fileInput = null;

      // Try to find upload elements
      for (const selector of uploadSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          uploadElement = await this.page.$(selector);
          if (uploadElement) {
            console.log(`Found upload element with selector: ${selector}`);
            break;
          }
        } catch (error) {
          // Continue to next selector
          continue;
        }
      }

      if (!uploadElement) {
        // Try alternative approach: look for file input or create one
        console.log('Standard upload selectors not found, trying alternative approach...');
        
        // Check if there's a file input we can use
        fileInput = await this.page.$('input[type="file"]');
        
        if (!fileInput) {
          // Create a file input if none exists (some SharePoint interfaces create them dynamically)
          await this.page.evaluate(() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.id = 'customFileUpload';
            input.style.position = 'absolute';
            input.style.left = '-9999px';
            document.body.appendChild(input);
          });
          
          fileInput = await this.page.$('#customFileUpload');
        }
      }

      if (progressCallback) {
        progressCallback({
          phase: 'uploading',
          progress: 60,
          message: 'Uploading file to SharePoint...'
        });
      }

      // Upload the file
      if (fileInput) {
        // Use file input approach
        await fileInput.uploadFile(filePath);
        console.log('File uploaded via file input');
        
        // Look for submit button or trigger upload
        try {
          const submitSelectors = [
            'button[type="submit"]',
            'button:contains("Upload")',
            'button:contains("OK")',
            '[data-automationid="UploadButton"]'
          ];
          
          for (const selector of submitSelectors) {
            try {
              const submitButton = await this.page.$(selector);
              if (submitButton) {
                await submitButton.click();
                console.log('Clicked upload submit button');
                break;
              }
            } catch (e) {
              continue;
            }
          }
        } catch (error) {
          console.log('No submit button found, file may auto-upload');
        }
        
      } else if (uploadElement) {
        // Click upload element and handle file dialog
        await uploadElement.click();
        await this.page.waitForFunction(() => true, { timeout: 1000 }).catch(() => {});
        
        // This approach would require additional handling for file dialogs
        console.log('Upload element clicked - user may need to manually select file');
      } else {
        throw new Error('Could not find upload interface in SharePoint');
      }

      if (progressCallback) {
        progressCallback({
          phase: 'uploading',
          progress: 80,
          message: 'Monitoring upload progress...'
        });
      }

      // Wait for upload to complete (look for success indicators)
      try {
        await this.page.waitForSelector('.ms-MessageBar--success, .ms-MessageBar--complete, [aria-label*="successfully"], [aria-label*="uploaded"]', 
          { timeout: 30000 }
        );
        console.log('Upload success indicator found');
      } catch (error) {
        console.log('No success indicator found, assuming upload completed');
      }

      if (progressCallback) {
        progressCallback({
          phase: 'complete',
          progress: 100,
          message: 'Upload completed successfully!'
        });
      }

      // Get the file URL (best effort)
      const fileName = path.basename(filePath);
      const urlInfo = this.parseSharePointUrl(this.settings.sharePointUrl);
      const fileUrl = `${urlInfo.siteUrl}/_layouts/15/Doc.aspx?sourcedoc=${fileName}&file=${fileName}`;

      console.log('File upload completed successfully');
      return fileUrl;

    } catch (error) {
      console.error('File upload failed:', error);
      throw error;
    }
  }

  /**
   * Close browser
   * @returns {Promise<void>}
   */
  async closeBrowser() {
    try {
      if (this.browser) {
        // Wait a moment so user can see the result
        await new Promise(resolve => setTimeout(resolve, 3000));
        await this.browser.close();
        this.browser = null;
        this.page = null;
        console.log('Browser closed');
      }
    } catch (error) {
      console.error('Error closing browser:', error);
    }
  }

  /**
   * Full upload workflow
   * @param {string} filePath - Path to ZIP file
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<string>} - SharePoint file URL
   */
  async performUpload(filePath, progressCallback) {
    try {
      console.log('Starting SharePoint upload workflow');

      // Verify file exists
      if (!(await fs.pathExists(filePath))) {
        throw new Error(`File not found: ${filePath}`);
      }

      const fileName = path.basename(filePath);
      console.log('Uploading file:', fileName);

      // Launch browser (Chrome or fallback)
      await this.launchBrowser(progressCallback);

      // Navigate to SharePoint and handle login
      await this.navigateToSharePoint(progressCallback);

      // Perform automated upload
      const result = await this.automatedUpload(filePath, fileName, progressCallback);

      return result;

    } catch (error) {
      // Ensure browser is closed on error
      await this.closeBrowser();
      throw error;
    }
  }

  /**
   * Perform fully automated upload
   * @param {string} filePath - Full file path
   * @param {string} fileName - Just the filename
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<string>} - Upload result
   */
  async automatedUpload(filePath, fileName, progressCallback) {
    try {
      console.log('Starting automated upload for:', fileName);
      
      if (progressCallback) {
        progressCallback({
          phase: 'uploading',
          progress: 60,
          message: 'Locating upload interface...'
        });
      }

      // Wait for page to be fully loaded
      await this.page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 });
      
      // Comprehensive page analysis for debugging
      console.log('🔍 Starting comprehensive SharePoint page analysis...');
      try {
        await this.analyzeSharePointPage();
      } catch (error) {
        console.error('❌ Page analysis failed:', error.message);
      }
      
      // Try multiple strategies to find and use upload interface
      const uploadSuccess = await this.tryUploadStrategies(filePath, fileName, progressCallback);
      
      if (uploadSuccess) {
        // Monitor for completion
        return await this.monitorUploadCompletion(fileName, progressCallback);
      } else {
        console.log('🔄 All automated upload strategies failed, switching to manual mode...');
        return await this.fallbackToManualUpload(filePath, fileName, progressCallback);
      }

    } catch (error) {
      console.error('Automated upload failed:', error);
      throw error;
    }
  }

  /**
   * Comprehensive analysis of SharePoint page for debugging
   */
  async analyzeSharePointPage() {
    try {
      console.log('🔍 === SHAREPOINT PAGE ANALYSIS ===');
      
      const analysis = await this.page.evaluate(() => {
        const result = {
          url: window.location.href,
          title: document.title,
          buttons: [],
          fileInputs: [],
          uploadElements: [],
          menuItems: [],
          commandBar: null,
          dropZones: []
        };

        // Analyze all buttons
        const buttons = document.querySelectorAll('button');
        buttons.forEach((btn, index) => {
          if (index < 20) { // Limit to first 20 buttons
            result.buttons.push({
              index,
              text: btn.innerText?.trim() || '',
              title: btn.title || '',
              ariaLabel: btn.getAttribute('aria-label') || '',
              dataAutomationId: btn.getAttribute('data-automation-id') || '',
              className: btn.className || '',
              id: btn.id || '',
              disabled: btn.disabled,
              type: btn.type || '',
              contains_upload: (btn.innerText?.toLowerCase().includes('upload') || 
                              btn.title?.toLowerCase().includes('upload') || 
                              btn.getAttribute('aria-label')?.toLowerCase().includes('upload'))
            });
          }
        });

        // Analyze file inputs
        const fileInputs = document.querySelectorAll('input[type="file"]');
        fileInputs.forEach((input, index) => {
          result.fileInputs.push({
            index,
            id: input.id || '',
            name: input.name || '',
            accept: input.accept || '',
            multiple: input.multiple,
            className: input.className || '',
            style_display: input.style.display,
            hidden: input.hidden,
            offsetParent: input.offsetParent !== null
          });
        });

        // Look for upload-related elements
        const uploadSelectors = [
          '[data-automation-id*="upload" i]',
          '[aria-label*="upload" i]',
          '[title*="upload" i]',
          '.upload',
          '[class*="upload" i]'
        ];

        uploadSelectors.forEach(selector => {
          try {
            const elements = document.querySelectorAll(selector);
            elements.forEach((el, index) => {
              if (index < 5) { // Limit results
                result.uploadElements.push({
                  selector,
                  tagName: el.tagName,
                  text: el.innerText?.trim().substring(0, 50) || '',
                  className: el.className || '',
                  id: el.id || ''
                });
              }
            });
          } catch (e) {
            // Skip invalid selectors
          }
        });

        // Look for menu items
        const menuItems = document.querySelectorAll('[role="menuitem"], .ms-ContextualMenu-item, .od-MenuItem');
        menuItems.forEach((item, index) => {
          if (index < 10) {
            result.menuItems.push({
              index,
              text: item.innerText?.trim() || '',
              ariaLabel: item.getAttribute('aria-label') || '',
              className: item.className || ''
            });
          }
        });

        // Look for command bar
        const commandBars = document.querySelectorAll('.ms-CommandBar, [data-automation-id*="CommandBar"]');
        if (commandBars.length > 0) {
          result.commandBar = {
            found: true,
            count: commandBars.length,
            className: commandBars[0].className || ''
          };
        }

        // Look for drop zones
        const dropZoneSelectors = [
          '.od-DropZone', '.ms-DropZone', '[data-automation-id*="DropZone"]',
          '[role="button"][aria-label*="drag"]', '.dropzone'
        ];

        dropZoneSelectors.forEach(selector => {
          try {
            const zones = document.querySelectorAll(selector);
            zones.forEach((zone, index) => {
              if (index < 3) {
                result.dropZones.push({
                  selector,
                  className: zone.className || '',
                  ariaLabel: zone.getAttribute('aria-label') || ''
                });
              }
            });
          } catch (e) {
            // Skip invalid selectors
          }
        });

        return result;
      });

      console.log('📄 PAGE INFO:');
      console.log('   URL:', analysis.url);
      console.log('   Title:', analysis.title);
      
      console.log('🔘 BUTTONS WITH "UPLOAD":');
      const uploadButtons = analysis.buttons.filter(btn => btn.contains_upload);
      if (uploadButtons.length > 0) {
        uploadButtons.forEach(btn => {
          console.log(`   [${btn.index}] "${btn.text}" (${btn.ariaLabel}) - ${btn.dataAutomationId}`);
        });
      } else {
        console.log('   ❌ No buttons containing "upload" found');
      }
      
      console.log('📁 FILE INPUTS:');
      if (analysis.fileInputs.length > 0) {
        analysis.fileInputs.forEach(input => {
          console.log(`   [${input.index}] id="${input.id}" name="${input.name}" visible=${input.offsetParent}`);
        });
      } else {
        console.log('   ❌ No file inputs found');
      }
      
      console.log('📤 UPLOAD ELEMENTS:');
      if (analysis.uploadElements.length > 0) {
        analysis.uploadElements.forEach(el => {
          console.log(`   ${el.tagName} via "${el.selector}" - "${el.text}"`);
        });
      } else {
        console.log('   ❌ No upload elements found');
      }
      
      console.log('📋 COMMAND BAR:');
      if (analysis.commandBar) {
        console.log('   ✅ Command bar found');
      } else {
        console.log('   ❌ No command bar found');
      }
      
      console.log('🎯 DROP ZONES:');
      if (analysis.dropZones.length > 0) {
        analysis.dropZones.forEach(zone => {
          console.log(`   Found via "${zone.selector}" - ${zone.ariaLabel}`);
        });
      } else {
        console.log('   ❌ No drop zones found');
      }

      console.log('📊 ALL BUTTONS (first 10):');
      analysis.buttons.slice(0, 10).forEach(btn => {
        console.log(`   [${btn.index}] "${btn.text}" | title="${btn.title}" | aria="${btn.ariaLabel}" | data-id="${btn.dataAutomationId}"`);
      });
      
      console.log('🔍 === END ANALYSIS ===');

    } catch (error) {
      console.error('❌ Page analysis failed:', error.message);
    }
  }

  /**
   * Try different upload strategies for SharePoint
   * @param {string} filePath - File path
   * @param {string} fileName - File name
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<boolean>} - Success status
   */
  async tryUploadStrategies(filePath, fileName, progressCallback) {
    const strategies = [
      () => this.uploadViaCommandBar(filePath, progressCallback),
      () => this.uploadViaUploadButton(filePath, progressCallback),
      () => this.uploadViaDragDrop(filePath, progressCallback),
      () => this.uploadViaFileInput(filePath, progressCallback)
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        console.log(`Trying upload strategy ${i + 1}/${strategies.length}`);
        
        if (progressCallback) {
          progressCallback({
            phase: 'uploading',
            progress: 65 + (i * 5),
            message: `Trying upload method ${i + 1}...`
          });
        }

        const success = await strategies[i]();
        if (success) {
          console.log(`Upload strategy ${i + 1} succeeded`);
          return true;
        }
      } catch (error) {
        console.log(`Upload strategy ${i + 1} failed:`, error.message);
        // Continue to next strategy
      }
    }

    return false;
  }

  /**
   * Upload via SharePoint command bar
   * @param {string} filePath - File path
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<boolean>} - Success status
   */
  async uploadViaCommandBar(filePath, progressCallback) {
    try {
      console.log('🔍 Strategy 1: Looking for SharePoint command bar upload...');
      
      // First try to find the Upload button by text content (from analysis)
      console.log('   Looking for Upload button by text content...');
      const uploadByText = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => 
          btn.innerText && btn.innerText.trim().toLowerCase().includes('upload')
        );
      });
      
      if (uploadByText) {
        console.log('✅ Found Upload button by text content');
        
        // Click the upload button
        await this.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const uploadBtn = buttons.find(btn => 
            btn.innerText && btn.innerText.trim().toLowerCase().includes('upload')
          );
          if (uploadBtn) {
            uploadBtn.click();
          }
        });
        
        console.log('   Clicked Upload button, waiting for interface...');
        
        // Wait longer and look for various upload interfaces that might appear
        let uploadSuccess = false;
        
        // Strategy 1: Look for immediate file input
        await this.page.waitForFunction(() => true, { timeout: 2000 }).catch(() => {});
        let fileInput = await this.page.$('input[type="file"]');
        if (fileInput) {
          console.log('✅ Found immediate file input');
          await fileInput.uploadFile(filePath);
          console.log('✅ File uploaded via immediate file input');
          return true;
        }
        
        // Strategy 2: Look for upload menu options (classic SharePoint)
        console.log('   Looking for upload menu options (Files option)...');
        
        // Wait a bit longer for the menu to appear after Upload click
        await this.page.waitForFunction(() => true, { timeout: 2000 }).catch(() => {});
        
        // First try to find "Files" option by text content
        console.log('   Looking for "Files" option by text...');
        
        // Wait a bit more for menu to fully load
        await this.page.waitForFunction(() => true, { timeout: 3000 }).catch(() => {});
        
        // Debug: Let's see what menu items are actually available after Upload click
        const allMenuItems = await this.page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('*'));
          return elements
            .filter(el => {
              const text = el.innerText && el.innerText.trim();
              return text && text.length < 50 && // Reasonable text length
                     (text.toLowerCase().includes('file') || 
                      text.toLowerCase().includes('upload') ||
                      text.toLowerCase().includes('browse') ||
                      text.toLowerCase().includes('choose')) &&
                     el.offsetParent !== null; // Visible
            })
            .map(el => ({
              tagName: el.tagName,
              text: el.innerText.trim(),
              className: el.className,
              role: el.getAttribute('role'),
              title: el.title || '',
              ariaLabel: el.getAttribute('aria-label') || '',
              clickable: el.tagName === 'BUTTON' || el.tagName === 'A' || el.onclick || el.getAttribute('role') === 'button'
            }))
            .slice(0, 15); // Limit to first 15
        });
        
        console.log('🔍 POTENTIAL FILES/UPLOAD MENU ITEMS:');
        allMenuItems.forEach((item, index) => {
          console.log(`   [${index}] ${item.tagName}(${item.role || 'no-role'}): "${item.text}" ${item.clickable ? '✅' : '❌'} clickable`);
          if (item.title) console.log(`       title: "${item.title}"`);
          if (item.ariaLabel) console.log(`       aria: "${item.ariaLabel}"`);
        });
        
        // Try to find and click the actual Files option
        const filesMenuByText = await this.page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('*'));
          
          // Look for "Files" in the menu structure (from debug output we see it)
          let filesEl = elements.find(el => {
            const text = el.innerText && el.innerText.trim();
            return text && 
                   (text.toLowerCase() === 'files' || 
                    (text.includes('Files') && text.includes('Folder') && text.includes('Template'))) &&
                   el.offsetParent !== null && // Visible
                   el.tagName === 'LI'; // List item in menu
          });
          
          // If not found, try looking for specific menu roles
          if (!filesEl) {
            filesEl = elements.find(el => 
              el.innerText && 
              el.innerText.trim().toLowerCase() === 'files' &&
              el.offsetParent !== null &&
              (el.getAttribute('role') === 'menuitem' || el.getAttribute('role') === 'presentation')
            );
          }
          
          // If not found, look for buttons with exact "Files" text
          if (!filesEl) {
            filesEl = elements.find(el => 
              el.innerText && 
              el.innerText.trim().toLowerCase() === 'files' &&
              el.offsetParent !== null &&
              (el.tagName === 'BUTTON' || el.tagName === 'A' || el.onclick || el.getAttribute('role') === 'button')
            );
          }
          
          if (filesEl) {
            return {
              found: true,
              text: filesEl.innerText.trim(),
              tagName: filesEl.tagName,
              className: filesEl.className
            };
          }
          
          return { found: false };
        });
        
        if (filesMenuByText && filesMenuByText.found) {
          console.log(`✅ Found Files option: ${filesMenuByText.tagName} with text "${filesMenuByText.text}"`);
          
          const clickResult = await this.page.evaluate((targetText) => {
            const elements = Array.from(document.querySelectorAll('*'));
            
            // Find the exact element we detected
            const filesEl = elements.find(el => 
              el.innerText && el.innerText.trim() === targetText &&
              el.offsetParent !== null &&
              (el.tagName === 'BUTTON' || el.tagName === 'A' || el.onclick || el.getAttribute('role') === 'button')
            );
            
            if (filesEl) {
              console.log('Clicking Files element:', filesEl.tagName, filesEl.className);
              filesEl.click();
              return { success: true, element: filesEl.tagName };
            }
            return { success: false };
          }, filesMenuByText.text);
          
          if (clickResult.success) {
            console.log(`✅ Successfully clicked Files option (${clickResult.element})`);
          } else {
            console.log('❌ Failed to click Files option');
          }
          
          console.log('   Clicked Files option, waiting for file explorer...');
          // Wait longer for file explorer to appear
          await this.page.waitForFunction(() => true, { timeout: 5000 }).catch(() => {});
          
          // Check if file input appeared
          fileInput = await this.page.$('input[type="file"]');
          if (fileInput) {
            console.log('✅ Found file input after Files click');
            console.log('📁 Attempting to upload file via Files option:', filePath);
            
            // Check if file exists before upload
            const fs = require('fs');
            if (!fs.existsSync(filePath)) {
              console.error('❌ File does not exist:', filePath);
              throw new Error(`File not found: ${filePath}`);
            }
            
            console.log('✅ File exists, uploading via Files option...');
            await fileInput.uploadFile(filePath);
            console.log('✅ File uploaded via Files menu option');
            
            // Upload initiated, monitor for completion - DON'T close browser yet
            console.log('⏳ Files upload initiated, monitoring for completion...');
            
            // Monitor for completion and handle cleanup
            const uploadResult = await this.monitorUploadCompletion(require('path').basename(filePath), progressCallback);
            
            // Ensure browser cleanup happens regardless of monitoring result
            console.log('🔄 Files upload monitoring complete, cleaning up browser...');
            if (this.browser) {
              try {
                await this.browser.close();
                this.browser = null;
                this.page = null;
                console.log('✅ Browser closed successfully after Files upload');
              } catch (closeError) {
                console.log('⚠️  Error closing browser:', closeError.message);
              }
            }
            
            return uploadResult;
              
              return true;
          } else {
            console.log('   No file input found, but Files option was clicked - checking for hidden inputs...');
            // Sometimes the file input is hidden, try to trigger it
            const hiddenFileInput = await this.page.evaluate(() => {
              const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
              return inputs.length > 0;
            });
            if (hiddenFileInput) {
              console.log('✅ Found hidden file input, attempting upload...');
              await this.page.evaluate((filePath) => {
                const input = document.querySelector('input[type="file"]');
                if (input) {
                  // Create a fake file selection event
                  const event = new Event('change', { bubbles: true });
                  input.dispatchEvent(event);
                }
              }, filePath);
              return true;
            }
          }
        }
        
        // Fallback: Look for menu items that might contain "Files"
        console.log('   Trying broader Files menu detection...');
        const menuOptions = [
          'a[title*="Files"]',
          'div[role="menuitem"]',
          '.ms-ContextualMenu-item',
          '[aria-label*="Files"]',
          'li[role="menuitem"]',
          '.ms-Nav-link'
        ];
        
        // Fallback to selector-based menu options
        console.log('   Trying selector-based menu options...');
        for (const selector of menuOptions) {
          try {
            // Skip :contains selectors to avoid syntax errors
            if (selector.includes(':contains')) continue;
            
            const menuItem = await this.page.$(selector);
            if (menuItem) {
              console.log(`   Found menu option: ${selector}`);
              await menuItem.click();
              console.log('   Clicked menu option, waiting for file explorer dialog...');
              
              // Wait much longer for file explorer dialog to appear
              // SharePoint's file dialog can take several seconds to open
              console.log('   Waiting 10 seconds for file dialog...');
              await this.page.waitForFunction(() => true, { timeout: 10000 }).catch(() => {});
              
              // Try multiple times to find the file input as it may appear dynamically
              for (let attempt = 1; attempt <= 5; attempt++) {
                console.log(`   Attempt ${attempt}/5: Looking for file input...`);
                fileInput = await this.page.$('input[type="file"]');
                if (fileInput) {
                  console.log(`✅ Found file input on attempt ${attempt}`);
                  
                  // Additional check to ensure the input is ready
                  await this.page.waitForFunction(() => true, { timeout: 1000 }).catch(() => {});
                  
                  console.log('📁 Attempting to upload file:', filePath);
                  
                  // Check if file exists before upload
                  const fs = require('fs');
                  if (!fs.existsSync(filePath)) {
                    console.error('❌ File does not exist:', filePath);
                    throw new Error(`File not found: ${filePath}`);
                  }
                  
                  console.log('✅ File exists, uploading...');
                  await fileInput.uploadFile(filePath);
                  console.log('✅ File uploaded via menu-based upload');
                  
                  // Wait for SharePoint to process the upload - DON'T close browser yet
                  console.log('⏳ Upload initiated, monitoring for completion...');
                  
                  // Monitor for completion and handle cleanup
                  const uploadResult = await this.monitorUploadCompletion(require('path').basename(filePath), progressCallback);
                  
                  // Ensure browser cleanup happens regardless of monitoring result
                  console.log('🔄 Upload monitoring complete, cleaning up browser...');
                  if (this.browser) {
                    try {
                      await this.browser.close();
                      this.browser = null;
                      this.page = null;
                      console.log('✅ Browser closed successfully');
                    } catch (closeError) {
                      console.log('⚠️  Error closing browser:', closeError.message);
                    }
                  }
                  
                  return uploadResult;
                  
                  return true;
                }
                
                // Wait between attempts
                await this.page.waitForFunction(() => true, { timeout: 2000 }).catch(() => {});
              }
              
              console.log(`   No file input found after clicking ${selector}, trying next option...`);
            }
          } catch (e) {
            console.log(`   Menu option ${selector} failed:`, e.message);
            continue;
          }
        }
        
        // Strategy 3: Look for file input in any frame/popup (extended wait)
        console.log('   Extended search for file input...');
        for (let i = 0; i < 5; i++) {
          await this.page.waitForFunction(() => true, { timeout: 1000 }).catch(() => {});
          fileInput = await this.page.$('input[type="file"]');
          if (fileInput) {
            console.log(`✅ Found file input on attempt ${i + 1}`);
            await fileInput.uploadFile(filePath);
            console.log('✅ File uploaded via extended search');
            return true;
          }
        }
        
        // Strategy 4: Look for file input using text-based search
        console.log('   Looking for file input by evaluating all inputs...');
        const foundFileInput = await this.page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input'));
          return inputs.some(input => input.type === 'file');
        });
        
        if (foundFileInput) {
          console.log('✅ Found file input via evaluation');
          fileInput = await this.page.$('input[type="file"]');
          if (fileInput) {
            await fileInput.uploadFile(filePath);
            console.log('✅ File uploaded via evaluation method');
            return true;
          }
        }
        
        console.log('❌ No file input found despite Upload button click');
      }
      
      // Fallback to attribute-based selectors
      console.log('   Trying attribute-based selectors...');
      const uploadButtonSelectors = [
        '[data-automation-id="uploadCommand"]',
        '[data-automation-id="UploadMenu"]',
        'button[title*="Upload"]',
        'button[aria-label*="Upload"]',
        'button[name*="Upload"]',
        '.ms-CommandBar-item[title*="Upload"]',
        '.ms-CommandBarItem--hasMenu[title*="Upload"]',
        '[data-testid="upload-button"]',
        '[aria-label*="upload" i]'
      ];

      // Debug: Log all elements we can find
      console.log('📋 Scanning page for upload buttons...');
      const allButtons = await this.page.$$eval('button', buttons => 
        buttons.map(btn => ({
          text: btn.innerText?.trim(),
          title: btn.title,
          ariaLabel: btn.getAttribute('aria-label'),
          dataAutomationId: btn.getAttribute('data-automation-id'),
          className: btn.className
        })).filter(btn => btn.text || btn.title || btn.ariaLabel)
      );
      console.log('🔍 Found buttons:', allButtons.slice(0, 10)); // Show first 10

      for (const selector of uploadButtonSelectors) {
        try {
          console.log(`   Checking selector: ${selector}`);
          const uploadButton = await this.page.$(selector);
          if (uploadButton) {
            console.log('✅ Found upload button with:', selector);
            
            // Click upload button
            await uploadButton.click();
            console.log('   Clicked upload button, waiting for menu...');
            await this.page.waitForFunction(() => true, { timeout: 2000 }).catch(() => {});

            // Look for file upload option
            const fileOptionSelectors = [
              'button[title*="Files"]',
              '[data-automation-id="uploadFileMenuItem"]',
              '[role="menuitem"][title*="Files"]',
              '[role="menuitem"][aria-label*="Files"]',
              'button[aria-label*="Files"]',
              'a[title*="Files"]'
            ];

            for (const fileSelector of fileOptionSelectors) {
              try {
                console.log(`   Looking for file option: ${fileSelector}`);
                const fileOption = await this.page.$(fileSelector);
                if (fileOption) {
                  console.log('✅ Found file option, clicking...');
                  await fileOption.click();
                  await this.page.waitForFunction(() => true, { timeout: 1000 }).catch(() => {});
                  
                  // Look for file input
                  const fileInput = await this.page.$('input[type="file"]');
                  if (fileInput) {
                    console.log('✅ Found file input, uploading...');
                    await fileInput.uploadFile(filePath);
                    console.log('✅ File uploaded via command bar method');
                    return true;
                  } else {
                    console.log('❌ No file input found after clicking file option');
                  }
                }
              } catch (e) {
                console.log(`   File option ${fileSelector} failed:`, e.message);
                continue;
              }
            }
          }
        } catch (e) {
          console.log(`   Selector ${selector} failed:`, e.message);
          continue;
        }
      }
      
      console.log('❌ Command bar upload method failed - no suitable elements found');
      return false;
    } catch (error) {
      console.log('❌ Command bar upload failed:', error.message);
      return false;
    }
  }

  /**
   * Upload via direct upload button
   * @param {string} filePath - File path
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<boolean>} - Success status
   */
  async uploadViaUploadButton(filePath, progressCallback) {
    try {
      // Look for any upload-related buttons
      const buttonSelectors = [
        '.upload-button',
        '[title*="upload"]',
        '[aria-label*="upload"]',
        'button[title*="upload"]',
        'a[title*="upload"]'
      ];

      for (const selector of buttonSelectors) {
        try {
          const button = await this.page.$(selector);
          if (button) {
            await button.click();
            await this.page.waitForFunction(() => true, { timeout: 1000 }).catch(() => {});
            
            const fileInput = await this.page.$('input[type="file"]');
            if (fileInput) {
              await fileInput.uploadFile(filePath);
              console.log('File uploaded via upload button method');
              return true;
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      return false;
    } catch (error) {
      console.log('Upload button method failed:', error.message);
      return false;
    }
  }

  /**
   * Upload via drag and drop simulation
   * @param {string} filePath - File path
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<boolean>} - Success status
   */
  async uploadViaDragDrop(filePath, progressCallback) {
    try {
      console.log('🔍 Strategy 3: Looking for drag & drop zones...');
      
      // Look for drag and drop upload areas
      const dropZoneSelectors = [
        '[data-automationid="FilesUploadDropZone"]',
        '.od-DropZone',
        '.ms-DropZone',
        '[role="button"][aria-label*="drag"]',
        '.dropzone',
        '[data-testid="drop-zone"]'
      ];

      for (const selector of dropZoneSelectors) {
        try {
          console.log(`   Checking drop zone: ${selector}`);
          const dropZone = await this.page.$(selector);
          if (dropZone) {
            console.log('✅ Found drop zone, checking for hidden file input...');
            
            // Look for associated file input
            const nearbyFileInput = await this.page.$(`${selector} input[type="file"], ${selector} + input[type="file"], ${selector} ~ input[type="file"]`);
            if (nearbyFileInput) {
              console.log('✅ Found associated file input');
              await nearbyFileInput.uploadFile(filePath);
              console.log('✅ File uploaded via drag & drop method');
              return true;
            } else {
              console.log('❌ No file input associated with drop zone');
            }
          }
        } catch (e) {
          console.log(`   Drop zone ${selector} failed:`, e.message);
          continue;
        }
      }
      
      console.log('❌ No drag & drop zones found');
      return false;
    } catch (error) {
      console.log('❌ Drag and drop upload failed:', error.message);
      return false;
    }
  }

  /**
   * Upload via hidden file input
   * @param {string} filePath - File path
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<boolean>} - Success status
   */
  async uploadViaFileInput(filePath, progressCallback) {
    try {
      console.log('🔍 Strategy 4: Looking for direct file inputs...');
      
      // Look for any file inputs on the page
      const fileInputs = await this.page.$$('input[type="file"]');
      console.log(`   Found ${fileInputs.length} file input(s)`);
      
      if (fileInputs.length === 0) {
        console.log('❌ No file inputs found on page');
        return false;
      }
      
      for (let i = 0; i < fileInputs.length; i++) {
        const fileInput = fileInputs[i];
        try {
          console.log(`   Trying file input ${i + 1}/${fileInputs.length}`);
          
          // Get input details for debugging
          const inputDetails = await fileInput.evaluate(input => ({
            id: input.id,
            name: input.name,
            className: input.className,
            accept: input.accept,
            multiple: input.multiple,
            style: input.style.display
          }));
          console.log('   Input details:', inputDetails);
          
          // Try to upload file
          await fileInput.uploadFile(filePath);
          console.log('✅ File attached to input, looking for submit...');
          
          // Try to find and click submit button
          const submitted = await this.triggerUploadSubmission();
          if (submitted) {
            console.log('✅ File uploaded via direct file input method');
            return true;
          } else {
            console.log('⚠️  File attached but no submit button found');
            // Continue to next input
          }
        } catch (e) {
          console.log(`   File input ${i + 1} failed:`, e.message);
          continue;
        }
      }
      
      console.log('❌ All file inputs failed');
      return false;
    } catch (error) {
      console.log('❌ File input upload failed:', error.message);
      return false;
    }
  }

  /**
   * Try to trigger upload submission after file selection
   * @returns {Promise<boolean>} - Whether submission was triggered
   */
  async triggerUploadSubmission() {
    try {
      const submitSelectors = [
        'button[type="submit"]',
        'button[title*="Upload"]',
        'button[aria-label*="Upload"]',
        'button[title*="OK"]',
        'button[aria-label*="Submit"]',
        '[data-automation-id="uploadButton"]',
        '.ms-Dialog-action button',
        '.ms-Button--primary',
        '.ms-Button[title*="Upload"]'
      ];

      console.log('   Looking for submit buttons...');
      for (const selector of submitSelectors) {
        try {
          const submitButton = await this.page.$(selector);
          if (submitButton) {
            console.log(`   Found submit button: ${selector}`);
            await submitButton.click();
            console.log('   Clicked submit button');
            return true;
          }
        } catch (e) {
          continue;
        }
      }
      
      console.log('   No submit button found');
      return false;
    } catch (error) {
      console.log('   Submit button search failed:', error.message);
      return false;
    }
  }

  /**
   * Fallback to manual upload when automation fails
   * @param {string} filePath - File path
   * @param {string} fileName - File name
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<string>} - Upload result
   */
  async fallbackToManualUpload(filePath, fileName, progressCallback) {
    try {
      console.log('📋 Switching to manual upload assistance...');
      
      if (progressCallback) {
        progressCallback({
          phase: 'uploading',
          progress: 70,
          message: 'Automated upload failed - please upload manually'
        });
      }

      // Copy file path to clipboard
      try {
        const { clipboard } = require('electron');
        if (clipboard) {
          clipboard.writeText(filePath);
          console.log('📋 File path copied to clipboard');
        }
      } catch (e) {
        console.log('❌ Could not copy to clipboard');
      }

      // Show manual upload instructions
      await this.showManualUploadInstructions(filePath, fileName);

      // Monitor for manual upload completion
      return await this.waitForManualUpload(fileName, progressCallback);

    } catch (error) {
      console.error('Manual upload fallback failed:', error);
      throw error;
    }
  }

  /**
   * Show manual upload instructions
   * @param {string} filePath - File path
   * @param {string} fileName - File name
   */
  async showManualUploadInstructions(filePath, fileName) {
    try {
      await this.page.evaluate((fileName, filePath) => {
        // Remove any existing instructions
        const existing = document.getElementById('manual-upload-instructions');
        if (existing) existing.remove();

        // Create instruction panel
        const panel = document.createElement('div');
        panel.id = 'manual-upload-instructions';
        panel.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: linear-gradient(135deg, #dc3545, #c82333);
          color: white;
          padding: 30px;
          border-radius: 16px;
          box-shadow: 0 12px 32px rgba(0,0,0,0.4);
          z-index: 999999;
          max-width: 500px;
          font-family: 'Segoe UI', system-ui, sans-serif;
          font-size: 15px;
          line-height: 1.6;
          text-align: center;
          animation: popIn 0.3s ease-out;
        `;

        panel.innerHTML = `
          <style>
            @keyframes popIn {
              from { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
              to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            }
          </style>
          <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
          <h2 style="margin: 0 0 20px; font-size: 22px; font-weight: 600;">
            Automated Upload Failed
          </h2>
          
          <div style="background: rgba(255,255,255,0.15); padding: 16px; border-radius: 12px; margin-bottom: 20px;">
            <div style="font-weight: 500; margin-bottom: 8px;">📁 Please upload manually:</div>
            <div style="font-family: 'Courier New', monospace; font-size: 13px; word-break: break-all; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px;">
              ${fileName}
            </div>
          </div>

          <div style="text-align: left; margin-bottom: 20px;">
            <div style="font-weight: 500; margin-bottom: 12px; text-align: center;">📋 Manual Upload Steps:</div>
            <ol style="margin: 0; padding-left: 20px; font-size: 14px;">
              <li style="margin-bottom: 8px;">Look for the <strong>"Upload"</strong> button in SharePoint</li>
              <li style="margin-bottom: 8px;">Click <strong>"Upload" → "Files"</strong> (or drag & drop)</li>
              <li style="margin-bottom: 8px;">Select the ZIP file from your computer</li>
              <li style="margin-bottom: 8px;">Complete the upload process</li>
            </ol>
          </div>

          <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; font-size: 13px; margin-bottom: 20px;">
            💡 <strong>Tip:</strong> File path has been copied to your clipboard
          </div>

          <div style="text-align: center;">
            <button id="manual-upload-btn" style="
              background: rgba(255,255,255,0.2);
              border: 2px solid rgba(255,255,255,0.3);
              color: white;
              padding: 12px 24px;
              border-radius: 8px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
              transition: all 0.2s;
              display: inline-block;
              outline: none;
              user-select: none;
              -webkit-user-select: none;
              -moz-user-select: none;
              -ms-user-select: none;
            " onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='scale(1.05)'" 
               onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='scale(1)'"
               onmousedown="this.style.background='rgba(255,255,255,0.4)'"
               onmouseup="this.style.background='rgba(255,255,255,0.3)'">
              ✅ I'll Upload Manually
            </button>
          </div>
          
          <div style="margin-top: 15px; font-size: 12px; opacity: 0.8; text-align: center;">
            The upload monitoring will continue in the background
          </div>
          
          <script>
            // Ensure button is clickable with multiple event handlers
            function setupButton() {
              const button = document.getElementById('manual-upload-btn');
              if (button) {
                // Remove any existing listeners
                button.onclick = null;
                
                // Add multiple event handlers for reliability
                button.addEventListener('click', function(e) {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Manual upload mode activated - closing modal');
                  const modal = document.getElementById('manual-upload-instructions');
                  if (modal) {
                    modal.remove();
                  }
                }, { once: true });
                
                // Backup onclick handler
                button.onclick = function(e) {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Manual upload mode activated via onclick');
                  const modal = document.getElementById('manual-upload-instructions');
                  if (modal) {
                    modal.remove();
                  }
                };
                
                // Add keyboard support
                button.onkeydown = function(e) {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    button.click();
                  }
                };
                
                console.log('Manual upload button setup complete');
              } else {
                console.error('Manual upload button not found');
              }
            }
            
            // Setup immediately and after a delay for safety
            setupButton();
            setTimeout(setupButton, 100);
          </script>
        `;

        document.body.appendChild(panel);

      }, fileName, filePath);

      console.log('📋 Manual upload instructions displayed');

    } catch (error) {
      console.warn('Could not show manual instructions:', error.message);
    }
  }

  /**
   * Wait for manual upload completion
   * @param {string} fileName - Expected filename
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<string>} - Upload result
   */
  async waitForManualUpload(fileName, progressCallback) {
    const maxWaitTime = 600000; // 10 minutes for manual upload
    const checkInterval = 5000; // Check every 5 seconds
    let waitTime = 0;

    return new Promise((resolve) => {
      const checkForFile = async () => {
        try {
          // Check for uploaded file
          const fileDetected = await this.page.evaluate((fileName) => {
            const selectors = [
              `[title*="${fileName}"]`,
              `[aria-label*="${fileName}"]`,
              `a[href*="${fileName}"]`,
              `[data-automation-key*="${fileName}"]`
            ];

            for (const selector of selectors) {
              if (document.querySelector(selector)) {
                return true;
              }
            }

            // Check for success indicators
            const successMessages = [
              'uploaded successfully',
              'upload complete',
              'has been uploaded'
            ];

            const pageText = document.body.innerText.toLowerCase();
            return successMessages.some(msg => pageText.includes(msg));

          }, fileName);

          if (fileDetected) {
            console.log('✅ Manual upload detected successfully');
            
            if (progressCallback) {
              progressCallback({
                phase: 'complete',
                progress: 100,
                message: 'Manual upload completed successfully!'
              });
            }

            // Close browser after delay
            setTimeout(() => this.closeBrowser(), 5000);
            resolve(`Manual upload successful: ${fileName}`);
            return;
          }

          // Check timeout
          if (waitTime >= maxWaitTime) {
            console.log('⏰ Manual upload timeout reached');
            
            if (progressCallback) {
              progressCallback({
                phase: 'complete',
                progress: 90,
                message: 'Upload monitoring timeout - please verify upload manually'
              });
            }

            resolve(`Manual upload monitoring timeout: ${fileName}`);
            return;
          }

          // Update progress periodically
          if (waitTime % 30000 === 0) { // Every 30 seconds
            const remaining = Math.ceil((maxWaitTime - waitTime) / 1000 / 60);
            if (progressCallback) {
              progressCallback({
                phase: 'uploading',
                progress: 70,
                message: `Waiting for manual upload... (${remaining} min remaining)`
              });
            }
          }

          waitTime += checkInterval;
          setTimeout(checkForFile, checkInterval);

        } catch (error) {
          console.warn('Error checking manual upload:', error.message);
          waitTime += checkInterval;
          
          if (waitTime < maxWaitTime) {
            setTimeout(checkForFile, checkInterval);
          } else {
            resolve(`Manual upload monitoring failed: ${fileName}`);
          }
        }
      };

      checkForFile();
    });
  }

  /**
   * Monitor upload completion
   * @param {string} fileName - Expected filename
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<string>} - Upload result
   */
  async monitorUploadCompletion(fileName, progressCallback) {
    const maxWaitTime = 180000; // 3 minutes for upload
    const checkInterval = 3000; // Check every 3 seconds
    let waitTime = 0;

    if (progressCallback) {
      progressCallback({
        phase: 'uploading',
        progress: 85,
        message: 'Upload in progress...'
      });
    }

    return new Promise((resolve) => {
      const checkProgress = async () => {
        try {
          // Check for upload completion indicators
          const completed = await this.page.evaluate((fileName) => {
            // Look for the uploaded file
            const fileSelectors = [
              `[title*="${fileName}"]`,
              `[aria-label*="${fileName}"]`,
              `a[href*="${fileName}"]`,
              `[data-automation-key*="${fileName}"]`
            ];

            for (const selector of fileSelectors) {
              if (document.querySelector(selector)) {
                return { success: true, method: 'file_found' };
              }
            }

            // Check for success messages
            const successMessages = [
              'uploaded successfully',
              'upload complete',
              'has been uploaded',
              'upload finished'
            ];

            const pageText = document.body.innerText.toLowerCase();
            const hasSuccess = successMessages.some(msg => pageText.includes(msg));
            
            if (hasSuccess) {
              return { success: true, method: 'success_message' };
            }

            // Check for error messages
            const errorMessages = [
              'upload failed',
              'error uploading',
              'upload error',
              'failed to upload'
            ];

            const hasError = errorMessages.some(msg => pageText.includes(msg));
            if (hasError) {
              return { success: false, error: 'Upload error detected' };
            }

            return { success: false, error: null };

          }, fileName);

          if (completed.success) {
            console.log(`Upload completed via ${completed.method}`);
            
            if (progressCallback) {
              progressCallback({
                phase: 'complete',
                progress: 100,
                message: 'Upload completed successfully!'
              });
            }

            // Don't close browser here - let the calling method handle it
            resolve(`Upload successful: ${fileName}`);
            return;
          }

          if (completed.error) {
            throw new Error(completed.error);
          }

          // Check timeout
          if (waitTime >= maxWaitTime) {
            console.log('Upload monitoring timeout reached');
            
            if (progressCallback) {
              progressCallback({
                phase: 'complete',
                progress: 95,
                message: 'Upload monitoring timeout - upload may still be in progress'
              });
            }

            resolve(`Upload monitoring timeout: ${fileName}`);
            return;
          }

          // Update progress
          if (waitTime % 15000 === 0) { // Every 15 seconds
            const remaining = Math.ceil((maxWaitTime - waitTime) / 1000);
            if (progressCallback) {
              progressCallback({
                phase: 'uploading',
                progress: 85,
                message: `Upload in progress... (${remaining}s remaining)`
              });
            }
          }

          waitTime += checkInterval;
          setTimeout(checkProgress, checkInterval);

        } catch (error) {
          console.error('Upload monitoring error:', error.message);
          
          if (progressCallback) {
            progressCallback({
              phase: 'error',
              progress: 0,
              message: `Upload failed: ${error.message}`
            });
          }

          resolve(`Upload failed: ${error.message}`);
        }
      };

      checkProgress();
    });
  }

  /**
   * Check if a file exists in SharePoint (placeholder)
   * @param {string} fileName - File name to check
   * @returns {Promise<boolean>} - Whether file exists
   */
  async checkFileExists(fileName) {
    // This would require additional browser automation
    // For now, return false to allow uploads
    return false;
  }

  /**
   * Delete a file from SharePoint (placeholder)
   * @param {string} fileName - File name to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteFile(fileName) {
    // This would require additional browser automation
    // For now, return false
    return false;
  }
}

module.exports = SharePointBrowserUploadService;
