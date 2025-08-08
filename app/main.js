// /Backend/main.js

const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// 1. Apenas execute o server.js. Ele cuidará de si mesmo.
require('./server.js');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    title: 'Sistema de Pedidos',
    icon: path.join(__dirname, '..', 'Frontend', 'Img', 'icone.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Adiciona um pequeno delay para garantir que o servidor subiu
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:3000/login-gerencia' );
  }, 2000); // Espera 2 segundos

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
