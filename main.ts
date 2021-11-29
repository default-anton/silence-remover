import { app, BrowserWindow, ipcMain } from "electron";
import { join as join_path } from "path";

const createWindow = () => {
  const win = new BrowserWindow({
    width: 900,
    height: 825,
    useContentSize: true,
    webPreferences: {
      preload: join_path(__dirname, "preload.js"),
      nodeIntegration: true,
    },
  });

  win.loadFile("index.html");
};

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});

ipcMain.on("getTemp", (event) => {
  event.returnValue = app.getPath("temp");
});
