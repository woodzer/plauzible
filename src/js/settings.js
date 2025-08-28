const { invoke } = (window.__TAURI__ || window.parent.window.__TAURI__).core;

import { showError, showSuccess } from "./utilities.js";

let localSettings = {};

function hideSensitiveSettings(event) {
    let fieldSection = document.querySelector("#encryption_settings_details");
    let field = fieldSection.querySelector('input[name="encryptionSettings"]');
    let buttons = document.querySelector("#encryption_settings_reveal");

    event.preventDefault();
    field.value = "";
    fieldSection.classList.add("is-hidden");
    buttons.classList.remove("is-hidden");
    fieldSection.querySelector("button.update-encryption-settings").disabled = true;
}

function loadSubscribePage() {
    return(invoke("open_url", {url: "https://plauzible.com/checkout"}));
}

function loadUnsubscribePage() {
    let key = localSettings["service.key"];
    return(invoke("open_url", {url: `https://plauzible.com/unsubscribe?key=${key}`}));
}

function initializeSettings() {
    invoke("get_standard_settings")
        .then((json) => {
            let records = JSON.parse(json);

            records.forEach((record) => {
                localSettings[record.key] = record.value;
            });

            setUpEventHandlers();
            populateSettings(records);
            showSettings();
        })
        .catch((error) => showError(`Failed to load setting values. Cause: ${error}`));
}

function populateSettings(records) {
    let field = document.querySelector('input[name="serviceKey"]');
    let record = records.find((r) => r.key === "service.key");
    let serviceURLSet = false;
    let serviceKeySet = false;

    if(field && record) {
        field.value = record.value;
        serviceKeySet = (`${record.value}`.trim() !== "");
    }

    field = document.querySelector('input[name="serviceURL"]');
    record = records.find((r) => r.key === "service.url");
    if(field && record) {
        field.value = record.value;
        serviceURLSet = (`${record.value}`.trim() !== "");
    }

    let button = document.querySelector("button.update-encryption-settings")
    button.disabled = true;

    field = document.querySelector('input[name="passwordLength"]');
    record = records.find((r) => r.key === "password.length");
    if(field && record) {
        field.value = parseInt(record.value);
    }

    field = document.querySelector('select[name="defaultCharacterSet"]');
    record = records.find((r) => r.key === "password.character_set");
    if(field && record) {
        field.value = record.value;
    }

    if(!serviceKeySet && !serviceURLSet) {
        document.querySelector("button.create-subscription").disabled = false;
    }
}

function setUpEventHandlers() {
    let element = document.querySelector("button.reveal-settings");

    if(element) {
        element.addEventListener("click", showSensitiveSettings);
    }

    element = document.querySelector("#encryption_settings_details");
    if(element) {
        element.querySelector("button.hide-settings").addEventListener("click", hideSensitiveSettings);
    }

    let button = document.querySelector("button.update-encryption-settings");
    if(button) {
        button.addEventListener("click", updateEncryptionSettings);
    }

    element = document.querySelector('input[name="encryptionSettings"]');
    if(element) {
        element.addEventListener("input", () => {
            document.querySelector("button.update-encryption-settings").disabled = false;
        });
    }

    updateSubscriptionButtons();
    document.querySelector("button.create-subscription").addEventListener("click", loadSubscribePage);
    document.querySelector("button.end-subscription").addEventListener("click", loadUnsubscribePage);

    button = document.querySelector("button.update-service-settings");
    if(button) {
        button.addEventListener("click", updateRemoteServiceSettings);
    }

    button = document.querySelector("button.update-password-generator-settings");
    if(button) {
        button.addEventListener("click", updatePasswordGeneratorSettings);
    }

    document.querySelectorAll(".close-button").forEach((element) => {
        element.addEventListener("click", (event) => {
            event.preventDefault();
            window.parent.postMessage({ source: "settings", action: "closed" }, "*");
        });
    });
}

function showLoading() {
    let sections = [document.querySelector("#loading_section"),
                    document.querySelector("#settings_section")];

    sections[1].classList.add("is-hidden");
    sections[0].classList.remove("is-hidden");
}

function showSensitiveSettings(event) {
    let button = event.target;

    event.preventDefault();
    invoke("get_sensitive_settings")
        .then((json) => {
            let records = JSON.parse(json);
            let fieldSection = document.querySelector("#encryption_settings_details");
            let field = fieldSection.querySelector('input[name="encryptionSettings"]');

            let salt = records.find((e) => e.key === "encryption.salt").value;
            let nonce = records.find((e) => e.key === "encryption.nonce").value;
            field.value = `${salt}:${nonce}`;

            button.parentNode.classList.add("is-hidden");
            fieldSection.classList.remove("is-hidden");
        })
        .catch((error) => showError(`Failed to load sensitive setting values, Cause: ${error}`));
}

function showSettings() {
    let sections = [document.querySelector("#loading_section"),
                    document.querySelector("#settings_section")];

    sections[0].classList.add("is-hidden");
    sections[1].classList.remove("is-hidden");
}

function updateEncryptionSettings(event) {
    let field = document.querySelector('input[name="encryptionSettings"]');
    let button = event.target;

    event.preventDefault();
    button.disabled = true;
    if(validateEncryptionSettings(field.value)) {
        invoke("update_sensitive_settings", {
            encryptionSettings: field.value
        })
        .then(() => {
            hideSensitiveSettings(event);
            showSuccess("Encryption settings successfully updated.");
        })
        .catch((error) => showError(`Failed to update encryption settings. Cause: ${error}`));
    }
}

function updatePasswordGeneratorSettings(event) {
    let section = document.querySelector("section.password-generator-settings");

    event.preventDefault();
    if(section) {
        let passwordLengthField = section.querySelector('input[name="passwordLength"]');
        let defaultCharacterSetField = section.querySelector('select[name="defaultCharacterSet"]');

        invoke("update_password_generator_settings", {
            passwordLength: parseInt(passwordLengthField.value),
            defaultCharacterSet: defaultCharacterSetField.value
        })
        .then(() => {
            showSuccess("Password generator settings successfully updated.");
        })
        .catch((error) => showError(`Failed to update password generator settings. Cause: ${error}`));
    }

}

function updateRemoteServiceSettings(event) {
    let section = document.querySelector("section.remote-service-settings");

    event.preventDefault();
    if(section) {
        let serviceKeyField = section.querySelector('input[name="serviceKey"]');
        let serviceURLField = section.querySelector('input[name="serviceURL"]');

        invoke("update_remote_service_settings", {
            serviceKey: serviceKeyField.value,
            serviceUrl: serviceURLField.value
        })
        .then(() => {
            localSettings["service.key"] = serviceKeyField.value;
            localSettings["service.url"] = serviceURLField.value;
            updateSubscriptionButtons();
            showSuccess("Remote service settings successfully updated.");
        })
        .catch((error) => showError(`Failed to update remote service settings. Cause: ${error}`));
    }
}

function updateSubscriptionButtons() {
    let subscriptionButtons = Array.from(document.querySelectorAll("button.create-subscription, button.end-subscription"));

    if(localSettings["service.key"] === "") {
        subscriptionButtons[0].classList.remove("is-hidden");
        subscriptionButtons[1].classList.add("is-hidden");
    } else {
        subscriptionButtons[0].classList.add("is-hidden");
        subscriptionButtons[1].classList.remove("is-hidden");
    }
}

function validateEncryptionSettings(value) {
    let valid = true;
    if(value.indexOf(":") === -1) {
        showError("Your encryption settings are not valid.");
        valid = false;
    }
    return valid;
}

window.addEventListener("DOMContentLoaded", () => {
    initializeSettings();
});
