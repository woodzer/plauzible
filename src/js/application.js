import { CURRENT_VERSION,
         fetchApplicationVersionDetails,
         showInfo } from "./utilities.js";

const App = window.__TAURI__.app;
const Menu = window.__TAURI__.menu.Menu;
const { exit } = window.__TAURI__.process;
const { invoke } = window.__TAURI__.core;
const TrayIcon = window.__TAURI__.tray.TrayIcon;
const Window = window.__TAURI__.window;

const  TRAY_ICON_MENU_OPTIONS = {
    items: [{action: showApplicationClicked, id: "show", text: "Open"}, {action: exitMenuItemClicked, id: "exit", text: "Exit"}]
};

async function exitMenuItemClicked() {
    invoke("update_exit_on_close", { exitOnClose: false })
        .then(() => {
            // exit(0);
            return Window.getAllWindows();
        })
        .then((windows) => {
            let window = windows.find((window) => window.label === "main");
            if(!window) {
                throw new Error("Main window not found.");
            }
            window.close();
        })
        .catch((error) => {
            console.error("Error updating exit on close:", error);
        });
}

async function showApplicationClicked() {
    Window.getAllWindows()
        .then((windows) => {
            let window = windows.find((window) => window.label === "main");

            if(!window) {
                throw new Error("Main window not found.");
            }
            window.show();
        })
        .catch((error) => {
            console.error("Error showing application:", error);
        });
}

function initializeApplication() {
    console.log("Application initializing.");
    let trayIconMenu = NodeList;

    let currentWindow = Window.getCurrentWindow();
    console.log("Current window:", currentWindow);

    invoke("update_exit_on_close", { exitOnClose: true })
        .then(() => {
            return Menu.new(TRAY_ICON_MENU_OPTIONS);
        })
        .then((menu) => {
            trayIconMenu = menu;
            return App.defaultWindowIcon();
        })
        .then((icon) => {
            const options = {
                icon: icon,
                menu: trayIconMenu,
                menuOnLeftClick: true,
            };
            return TrayIcon.new(options)
                .then((trayIcon) => {
                    console.log("Tray icon initialized:", trayIcon);
                })
                .catch((error) => {
                    console.error("Error initializing tray icon:", error);
                });
        })
        .catch((error) => {
            console.error("Error initializing tray icon:", error);
        });
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
