"use strict";
const electron = require("electron");
const api = {
  getPetState: () => electron.ipcRenderer.invoke("get-pet-state"),
  updatePetState: (updates) => electron.ipcRenderer.invoke("update-pet-state", updates),
  getUserProgress: () => electron.ipcRenderer.invoke("get-user-progress"),
  updateUserProgress: (updates) => electron.ipcRenderer.invoke("update-user-progress", updates),
  feedPet: () => electron.ipcRenderer.invoke("feed-pet"),
  playWithPet: () => electron.ipcRenderer.invoke("play-with-pet"),
  resetPet: () => electron.ipcRenderer.invoke("reset-pet"),
  completeLesson: (result) => electron.ipcRenderer.invoke("complete-lesson", result),
  getLessonProgress: () => electron.ipcRenderer.invoke("get-lesson-progress"),
  getApiKey: () => electron.ipcRenderer.invoke("get-api-key"),
  setApiKey: (key) => electron.ipcRenderer.invoke("set-api-key", key),
  deleteApiKey: () => electron.ipcRenderer.invoke("delete-api-key"),
  onPetStateUpdate: (callback) => {
    const handler = (_event, state) => {
      callback(state);
    };
    electron.ipcRenderer.on("pet-state-updated", handler);
    return () => electron.ipcRenderer.removeListener("pet-state-updated", handler);
  }
};
electron.contextBridge.exposeInMainWorld("api", api);
