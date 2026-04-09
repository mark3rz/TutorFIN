"use strict";
const electron = require("electron");
const path = require("path");
const Database = require("better-sqlite3");
const fs = require("fs");
const is = {
  dev: !electron.app.isPackaged
};
const platform = {
  isWindows: process.platform === "win32",
  isMacOS: process.platform === "darwin",
  isLinux: process.platform === "linux"
};
const electronApp = {
  setAppUserModelId(id) {
    if (platform.isWindows)
      electron.app.setAppUserModelId(is.dev ? process.execPath : id);
  },
  setAutoLaunch(auto) {
    if (platform.isLinux)
      return false;
    const isOpenAtLogin = () => {
      return electron.app.getLoginItemSettings().openAtLogin;
    };
    if (isOpenAtLogin() !== auto) {
      electron.app.setLoginItemSettings({
        openAtLogin: auto,
        path: process.execPath
      });
      return isOpenAtLogin() === auto;
    } else {
      return true;
    }
  },
  skipProxy() {
    return electron.session.defaultSession.setProxy({ mode: "direct" });
  }
};
const optimizer = {
  watchWindowShortcuts(window, shortcutOptions) {
    if (!window)
      return;
    const { webContents } = window;
    const { escToCloseWindow = false, zoom = false } = shortcutOptions || {};
    webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown") {
        if (!is.dev) {
          if (input.code === "KeyR" && (input.control || input.meta))
            event.preventDefault();
        } else {
          if (input.code === "F12") {
            if (webContents.isDevToolsOpened()) {
              webContents.closeDevTools();
            } else {
              webContents.openDevTools({ mode: "undocked" });
              console.log("Open dev tool...");
            }
          }
        }
        if (escToCloseWindow) {
          if (input.code === "Escape" && input.key !== "Process") {
            window.close();
            event.preventDefault();
          }
        }
        if (!zoom) {
          if (input.code === "Minus" && (input.control || input.meta))
            event.preventDefault();
          if (input.code === "Equal" && input.shift && (input.control || input.meta))
            event.preventDefault();
        }
      }
    });
  },
  registerFramelessWindowIpc() {
    electron.ipcMain.on("win:invoke", (event, action) => {
      const win = electron.BrowserWindow.fromWebContents(event.sender);
      if (win) {
        if (action === "show") {
          win.show();
        } else if (action === "showInactive") {
          win.showInactive();
        } else if (action === "min") {
          win.minimize();
        } else if (action === "max") {
          const isMaximized = win.isMaximized();
          if (isMaximized) {
            win.unmaximize();
          } else {
            win.maximize();
          }
        } else if (action === "close") {
          win.close();
        }
      }
    });
  }
};
let db;
function initDatabase() {
  const dbPath = path.join(electron.app.getPath("userData"), "frenchpet.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS pet_state (
      id INTEGER PRIMARY KEY DEFAULT 1,
      health INTEGER NOT NULL DEFAULT 100,
      mood INTEGER NOT NULL DEFAULT 100,
      hunger INTEGER NOT NULL DEFAULT 100,
      intelligence INTEGER NOT NULL DEFAULT 0,
      happiness INTEGER NOT NULL DEFAULT 100,
      evolution_stage INTEGER NOT NULL DEFAULT 1,
      coins INTEGER NOT NULL DEFAULT 100,
      last_fed_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_progress (
      id INTEGER PRIMARY KEY DEFAULT 1,
      current_level INTEGER NOT NULL DEFAULT 1,
      current_chapter INTEGER NOT NULL DEFAULT 1,
      total_xp INTEGER NOT NULL DEFAULT 0,
      streak_count INTEGER NOT NULL DEFAULT 0,
      last_session_at TEXT
    );

    CREATE TABLE IF NOT EXISTS srs_items (
      item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      easiness_factor REAL NOT NULL DEFAULT 2.5,
      interval INTEGER NOT NULL DEFAULT 1,
      next_review_date TEXT NOT NULL DEFAULT (date('now')),
      times_seen INTEGER NOT NULL DEFAULT 0,
      times_correct INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS session_log (
      session_id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL DEFAULT (datetime('now')),
      questions_answered INTEGER NOT NULL DEFAULT 0,
      correct_count INTEGER NOT NULL DEFAULT 0,
      xp_earned INTEGER NOT NULL DEFAULT 0,
      errors_json TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory (
      item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      equipped INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS lesson_progress (
      lesson_id TEXT PRIMARY KEY,
      completed INTEGER NOT NULL DEFAULT 0,
      best_score REAL NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT
    );
  `);
  const petRow = db.prepare("SELECT id FROM pet_state WHERE id = 1").get();
  if (!petRow) {
    db.prepare("INSERT INTO pet_state (id) VALUES (1)").run();
  }
  const progressRow = db.prepare("SELECT id FROM user_progress WHERE id = 1").get();
  if (!progressRow) {
    db.prepare("INSERT INTO user_progress (id) VALUES (1)").run();
  }
  return db;
}
function getPetState() {
  return db.prepare("SELECT * FROM pet_state WHERE id = 1").get();
}
function updatePetState(updates) {
  const fields = Object.keys(updates).filter((k) => k !== "id");
  if (fields.length === 0) return getPetState();
  const setClause = fields.map((f) => `${f} = @${f}`).join(", ");
  db.prepare(`UPDATE pet_state SET ${setClause} WHERE id = 1`).run(updates);
  return getPetState();
}
function getUserProgress() {
  return db.prepare("SELECT * FROM user_progress WHERE id = 1").get();
}
function updateUserProgress(updates) {
  const fields = Object.keys(updates).filter((k) => k !== "id");
  if (fields.length === 0) return getUserProgress();
  const setClause = fields.map((f) => `${f} = @${f}`).join(", ");
  db.prepare(`UPDATE user_progress SET ${setClause} WHERE id = 1`).run(updates);
  return getUserProgress();
}
function getLessonProgress() {
  return db.prepare("SELECT * FROM lesson_progress").all();
}
function upsertLessonProgress(lessonId, score) {
  const existing = db.prepare("SELECT * FROM lesson_progress WHERE lesson_id = ?").get(lessonId);
  if (existing) {
    db.prepare(`
      UPDATE lesson_progress
      SET completed = 1,
          best_score = MAX(best_score, ?),
          attempts = attempts + 1,
          last_attempt_at = datetime('now')
      WHERE lesson_id = ?
    `).run(score, lessonId);
  } else {
    db.prepare(`
      INSERT INTO lesson_progress (lesson_id, completed, best_score, attempts, last_attempt_at)
      VALUES (?, 1, ?, 1, datetime('now'))
    `).run(lessonId, score);
  }
}
function insertSessionLog(data) {
  db.prepare(`
    INSERT INTO session_log (questions_answered, correct_count, xp_earned, errors_json)
    VALUES (?, ?, ?, ?)
  `).run(data.questions_answered, data.correct_count, data.xp_earned, data.errors_json);
}
function getKeyPath() {
  return path.join(electron.app.getPath("userData"), "api-key.enc");
}
function saveApiKey(key) {
  if (!electron.safeStorage.isEncryptionAvailable()) {
    throw new Error("Encryption is not available on this system");
  }
  const encrypted = electron.safeStorage.encryptString(key);
  fs.writeFileSync(getKeyPath(), encrypted);
}
function loadApiKey() {
  const keyPath = getKeyPath();
  if (!fs.existsSync(keyPath)) return null;
  if (!electron.safeStorage.isEncryptionAvailable()) return null;
  const encrypted = fs.readFileSync(keyPath);
  return electron.safeStorage.decryptString(encrypted);
}
function deleteApiKey() {
  const keyPath = getKeyPath();
  if (fs.existsSync(keyPath)) {
    fs.unlinkSync(keyPath);
  }
}
function clamp$1(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function registerIpcHandlers() {
  electron.ipcMain.handle("get-pet-state", () => {
    return getPetState();
  });
  electron.ipcMain.handle("update-pet-state", (_event, updates) => {
    return updatePetState(updates);
  });
  electron.ipcMain.handle("get-user-progress", () => {
    return getUserProgress();
  });
  electron.ipcMain.handle("update-user-progress", (_event, updates) => {
    return updateUserProgress(updates);
  });
  electron.ipcMain.handle("feed-pet", () => {
    const state = getPetState();
    if (state.health <= 0) return state;
    if (state.coins < 5) return state;
    return updatePetState({
      hunger: clamp$1(state.hunger + 20, 0, 100),
      coins: state.coins - 5
    });
  });
  electron.ipcMain.handle("play-with-pet", () => {
    const state = getPetState();
    if (state.health <= 0) return state;
    return updatePetState({
      mood: clamp$1(state.mood + 15, 0, 100),
      happiness: clamp$1(state.happiness + 10, 0, 100)
    });
  });
  electron.ipcMain.handle("get-api-key", () => {
    return loadApiKey();
  });
  electron.ipcMain.handle("set-api-key", (_event, key) => {
    saveApiKey(key);
    return true;
  });
  electron.ipcMain.handle("delete-api-key", () => {
    deleteApiKey();
    return true;
  });
  electron.ipcMain.handle("reset-pet", () => {
    return updatePetState({
      health: 100,
      mood: 100,
      hunger: 100,
      happiness: 100,
      coins: 100,
      last_fed_at: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  electron.ipcMain.handle("complete-lesson", (_event, result) => {
    const state = getPetState();
    const updatedPet = updatePetState({
      hunger: clamp$1(state.hunger + 40, 0, 100),
      mood: clamp$1(state.mood + 10, 0, 100),
      intelligence: clamp$1(state.intelligence + Math.floor(result.correctCount / result.questionsAnswered * 10), 0, 100),
      coins: state.coins + result.coinsEarned,
      last_fed_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    const progress = getUserProgress();
    const updatedProgress = updateUserProgress({
      total_xp: progress.total_xp + result.xpEarned,
      last_session_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    insertSessionLog({
      questions_answered: result.questionsAnswered,
      correct_count: result.correctCount,
      xp_earned: result.xpEarned,
      errors_json: JSON.stringify(result.wrongAnswers)
    });
    const score = result.questionsAnswered > 0 ? result.correctCount / result.questionsAnswered * 100 : 0;
    upsertLessonProgress(result.lessonId, score);
    return { petState: updatedPet, userProgress: updatedProgress };
  });
  electron.ipcMain.handle("get-lesson-progress", () => {
    return getLessonProgress();
  });
}
const DECAY_INTERVAL_MS = 6e4;
const HUNGER_DECAY = 2;
const MOOD_DECAY = 1;
const HAPPINESS_DECAY = 1;
const HEALTH_DECAY_WHEN_STARVING = 1;
let timerHandle = null;
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function applyRetroactiveDecay() {
  const state = getPetState();
  if (state.health <= 0) return;
  const lastFed = (/* @__PURE__ */ new Date(state.last_fed_at + "Z")).getTime();
  const now = Date.now();
  const elapsedMs = now - lastFed;
  const elapsedMinutes = Math.floor(elapsedMs / 6e4);
  const cappedMinutes = Math.min(elapsedMinutes, 1440);
  if (cappedMinutes <= 0) return;
  let hunger = state.hunger;
  let mood = state.mood;
  let happiness = state.happiness;
  let health = state.health;
  for (let i = 0; i < cappedMinutes; i++) {
    hunger = clamp(hunger - HUNGER_DECAY, 0, 100);
    mood = clamp(mood - MOOD_DECAY, 0, 100);
    happiness = clamp(happiness - HAPPINESS_DECAY, 0, 100);
    if (hunger === 0) {
      health = clamp(health - HEALTH_DECAY_WHEN_STARVING, 0, 100);
    }
    if (health === 0) break;
  }
  updatePetState({ hunger, mood, happiness, health, last_fed_at: (/* @__PURE__ */ new Date()).toISOString() });
}
function startDecayTimer(mainWindow) {
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = setInterval(() => {
    const state = getPetState();
    if (state.health <= 0) return;
    let hunger = clamp(state.hunger - HUNGER_DECAY, 0, 100);
    let mood = clamp(state.mood - MOOD_DECAY, 0, 100);
    let happiness = clamp(state.happiness - HAPPINESS_DECAY, 0, 100);
    let health = state.health;
    if (hunger === 0) {
      health = clamp(health - HEALTH_DECAY_WHEN_STARVING, 0, 100);
    }
    const updated = updatePetState({ hunger, mood, happiness, health });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("pet-state-updated", updated);
    }
  }, DECAY_INTERVAL_MS);
}
function stopDecayTimer() {
  if (timerHandle) {
    clearInterval(timerHandle);
    timerHandle = null;
  }
}
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 480,
    height: 720,
    minWidth: 480,
    minHeight: 720,
    maxWidth: 480,
    maxHeight: 720,
    resizable: false,
    title: "FrenchPet",
    backgroundColor: "#1a1a2e",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  return mainWindow;
}
electron.app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.frenchpet");
  electron.app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });
  initDatabase();
  applyRetroactiveDecay();
  registerIpcHandlers();
  const mainWindow = createWindow();
  startDecayTimer(mainWindow);
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      const newWindow = createWindow();
      startDecayTimer(newWindow);
    }
  });
});
electron.app.on("window-all-closed", () => {
  stopDecayTimer();
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
