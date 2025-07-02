// main.js - Main Electron process
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');

class ProtonDocsApp {
  constructor() {
    this.mainWindow = null;
  }

  createWindow() {
    // Create the browser window
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      icon: path.join(__dirname, 'assets', 'icon.png'), // Add your icon
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false
      },
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      show: false // Don't show until ready
    });

    // Load Proton Docs
    this.mainWindow.loadURL('https://docs.proton.me');

    // Show window when ready to prevent visual flash
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      
      // Focus on window
      if (process.platform === 'darwin') {
        this.mainWindow.focus();
      }
    });

    // Inject CSS immediately when page starts loading to prevent flash
    this.mainWindow.webContents.on('dom-ready', () => {
      this.mainWindow.webContents.insertCSS(`
        /* Hide sidebar-header immediately to prevent flash */
        .sidebar-header,
        div[class*="sidebar-header"] {
          display: none !important;
        }
      `);
    });

    // Apply additional fixes after page loads
    this.mainWindow.webContents.on('did-finish-load', () => {
      // Hide the entire sidebar-header div containing both button and icon
      setTimeout(() => {
        this.mainWindow.webContents.executeJavaScript(`
          // Remove with JavaScript as backup
          const sidebarHeader = document.querySelector('.sidebar-header') || 
                               document.querySelector('div[class*="sidebar-header"]');
          
          if (sidebarHeader) {
            sidebarHeader.remove();
            console.log('Removed entire sidebar-header div');
          }
        `).catch(err => console.log('Script error:', err));
        
        console.log('Applied fix for dupes');
      }, 100); // Short delay
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Handle external links
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      // Open external links in default browser
      if (!url.startsWith('https://docs.proton.me') && 
          !url.startsWith('https://account.proton.me')) {
        shell.openExternal(url);
        return { action: 'deny' };
      }
      return { action: 'allow' };
    });

    // Prevent navigation away from Proton domains
    this.mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
      const allowedDomains = [
        'docs.proton.me',
        'account.proton.me',
        'mail.proton.me' // In case of account management redirects
      ];
      
      const url = new URL(navigationUrl);
      if (!allowedDomains.includes(url.hostname)) {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      }
    });

    // Handle download requests
    this.mainWindow.webContents.session.on('will-download', (event, item) => {
      // Set download path
      const downloadsPath = app.getPath('downloads');
      const filename = item.getFilename();
      item.setSavePath(path.join(downloadsPath, filename));
      
      // Show download progress (optional)
      item.on('updated', (event, state) => {
        if (state === 'interrupted') {
          console.log('Download is interrupted but can be resumed');
        } else if (state === 'progressing') {
          if (item.isPaused()) {
            console.log('Download is paused');
          } else {
            console.log(`Received bytes: ${item.getReceivedBytes()}`);
          }
        }
      });
    });
  }

  createMenu() {
    const template = [
      {
        label: 'File',
        submenu: [
          {
            label: 'Refresh',
            accelerator: 'CmdOrCtrl+R',
            click: () => {
              this.mainWindow.reload();
            }
          },
          { type: 'separator' },
          {
            label: process.platform === 'darwin' ? 'Close Window' : 'Quit',
            accelerator: process.platform === 'darwin' ? 'Cmd+W' : 'Ctrl+Q',
            click: () => {
              if (process.platform === 'darwin') {
                this.mainWindow.close();
              } else {
                app.quit();
              }
            }
          }
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'About Proton Docs Desktop',
            click: () => {
              dialog.showMessageBox(this.mainWindow, {
                type: 'info',
                title: 'About',
                message: 'Proton Docs Desktop',
                detail: 'Unofficial Electron wrapper for Proton Docs, perfect for note-taking!\nCreated by Stefan Sommarsjö. '
              });
            }
          },
          {
            label: 'Proton Support',
            click: () => {
              shell.openExternal('https://proton.me/support');
            }
          }
        ]
      }
    ];

    // macOS specific menu adjustments
    if (process.platform === 'darwin') {
      template.unshift({
        label: app.getName(),
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  init() {
    // This method will be called when Electron has finished initialization
    app.whenReady().then(() => {
      this.createWindow();
      this.createMenu();

      app.on('activate', () => {
        // On macOS, re-create window when dock icon is clicked
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createWindow();
        }
      });
    });

    // Quit when all windows are closed
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Security: Prevent new window creation
    app.on('web-contents-created', (event, contents) => {
      contents.on('new-window', (event, navigationUrl) => {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      });
    });
  }
}

// Initialize the app
const protonApp = new ProtonDocsApp();
protonApp.init();