const { invoke } = window.__TAURI__.core;

import { CURRENT_VERSION,
         fetchApplicationVersionDetails,
         showError,
         showInfo } from "./utilities.js";

function initializeApplication() {
    console.log("Application initializing.");
}

function runVersionCheck(settings) {
    fetchApplicationVersionDetails(settings)
        .then((data) => {
            if(data.version !== CURRENT_VERSION) {
                showInfo(`<p>A new version of the Plauzible client application is available <a href="${data.url}" target="_blank">here</a>.</p>`);
            }
        });
}

window.addEventListener("DOMContentLoaded", () => {
    initializeApplication();
});
