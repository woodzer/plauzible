const { invoke } = window.__TAURI__.core;
const Database = window.__TAURI__.sql;

const NONCE_KEY = "encryption.nonce";
const SALT_KEY = "encryption.salt";
const SERVICE_KEY_KEY = "service.key";
const PASSWORD_LENGTH_KEY = "password.length";
const PASSWORD_CHARACTER_SET_KEY = "password.character_set";
const ALL_KEYS = [NONCE_KEY, PASSWORD_LENGTH_KEY, PASSWORD_CHARACTER_SET_KEY, SALT_KEY, SERVICE_KEY_KEY];

import { DEFAULT_CHARACTER_SET, DEFAULT_PASSWORD_LENGTH } from "./js/utilities.js";

const INSERT_CONFIGURATION_SQL = `
    insert into settings(key, value, sensitive)
    values($1, $2, $3)
`;

function addBaseSettings(settings) {
    let databaseURL = `sqlite:${settings.database}`;
    let connection;

    console.log(`Database URL: ${databaseURL}`);
    Database.load(databaseURL)
        .then((c) => {
            connection = c;
            return connection.execute(INSERT_CONFIGURATION_SQL, [NONCE_KEY, settings.nonce, 1])
        })
        .then(() => {
            return connection.execute(INSERT_CONFIGURATION_SQL, [SALT_KEY, settings.salt, 1]);
        })
        .then(() => {
            return connection.execute(INSERT_CONFIGURATION_SQL, [SERVICE_KEY_KEY, settings.serviceKey, 0]);
        })
        .then(() => {
            return connection.execute(INSERT_CONFIGURATION_SQL, [PASSWORD_LENGTH_KEY, `${DEFAULT_PASSWORD_LENGTH}`, 0]);
        })
        .then(() => {
            return connection.execute(INSERT_CONFIGURATION_SQL, [PASSWORD_CHARACTER_SET_KEY, DEFAULT_CHARACTER_SET, 0]);
        })
        .then(() => {
            console.log("Base settings successfully stored.");
            connection.close();
            window.location.href = "application.html";
        })
        .catch((error) => {
            let message = `Error creating base configuration, Cause: ${error}`;
            console.error(message);
            showError(message);
        });
}

function getCurrentStep() {
    let output;
    document.querySelectorAll(".step-section").forEach((section) => {
        if(section.classList.contains("is-hidden") === false) {
            output = section;
        }
    });
    return(output);
}

function getStep(stepNumber) {
    let output;
    document.querySelectorAll(".step-section").forEach((section) => {
        if(section.dataset.order === `${stepNumber}`) {
            output = section;
        }
    });
    return(output);
}

function hideError() {
    let errorSection = document.querySelector(".error-section");

    if(errorSection) {
        errorSection.classList.add("is-hidden");
    }
}

function initializeApplication() {
    let salt = document.querySelector('input[name="salt"]').value;
    let serviceKey = document.querySelector('input[name="service_key"]').value;

    showNextStep();
    invoke("initialize_application", {salt: salt, serviceKey: serviceKey})
        .then((data) => {
            let json = JSON.parse(data);

            console.log("Base Settings:", json);
            addBaseSettings(json);
        })
        .catch((error) => {
            showError(error);
        });
}

function resetProcess() {
    invoke("delete_database")
        .then(() => {
            showStep(2);
        })
        .catch((error) => {
            showError(error);
        });
}

function setupNextButtons() {
    document.querySelectorAll(".next-button").forEach((button) => {
        button.addEventListener("click", () => showNextStep());
    });
}

function setupPreviousButtons() {
    document.querySelectorAll(".previous-button").forEach((button) => {
        button.addEventListener("click", () => showPreviousStep());
    });
}

function showError(message) {
    let errorSection = document.querySelector(".error-section");

    console.error(message);
    if(errorSection) {
        let messageBody = errorSection.querySelector(".message-body");

        messageBody.innerText = message;
        document.querySelectorAll(".step-section").forEach((section) => section.classList.add("is-hidden"));
        errorSection.classList.remove("is-hidden");
    } else {
        console.error("Failed to locate the error section on the page.");
    }
}

function showNextStep() {
    let current = getCurrentStep();

    if(current) {
        let currentStepNumber = current.dataset.order;

        if(currentStepNumber) {
            currentStepNumber = parseInt(currentStepNumber);

            if(!isNaN(currentStepNumber)) {
                let step = getStep(currentStepNumber + 1);

                if(step) {
                    hideError();
                    current.classList.toggle("is-hidden");
                    step.classList.toggle("is-hidden");
                } else {
                    console.error(`Unable to move to the next step. Step number ${currentStepNumber + 1} does not exist.`);
                }
            } else {
                console.error(`Unable to move to the next step. Invalid step number '${current.dataset.order}' found on the current step.`);
            }
        } else {
            console.error(`Unable to move to the next step.No step order number found on the current step.`);
        }
    } else {
        console.error("Unable to move to the next step. The current step could not be found.");
    }
}

function showPreviousStep() {
    let current = getCurrentStep();

    if(current) {
        let currentStepNumber = current.dataset.order;

        if(currentStepNumber) {
            currentStepNumber = parseInt(currentStepNumber);

            if(!isNaN(currentStepNumber)) {
                let step = getStep(currentStepNumber - 1);

                if(step) {
                    hideError();
                    current.classList.toggle("is-hidden");
                    step.classList.toggle("is-hidden");
                } else {
                    console.error(`Unable to move to the next step. Step number ${currentStepNumber - 1} does not exist.`);
                }
            } else {
                console.error(`Unable to move to the next step. Invalid step number '${current.dataset.order}' found on the current step.`);
            }
        } else {
            console.error(`Unable to move to the next step.No step order number found on the current step.`);
        }
    } else {
        console.error("Unable to move to the next step. The current step could not be found.");
    }
}

function showStep(stepNumber) {
    let target = getStep(stepNumber);

    if(target) {
        let current = getCurrentStep();

        hideError();
        if(current) {
            current.classList.toggle("is-hidden");
        }
        target.classList.toggle("is-hidden");
    } else {
        console.error(`Activation of step number ${stepNumber} requested but step section could not be located.`);
    }
}

window.addEventListener("DOMContentLoaded", () => {
    let initializeButton = document.querySelector(".initialize-app-button");
    let restartButton = document.querySelector(".restart-button");

    setupNextButtons();
    setupPreviousButtons();
    initializeButton.addEventListener("click", initializeApplication);
    restartButton.addEventListener("click", resetProcess);

    invoke("has_been_initialized").then((result) => {
        if(result) {
            window.location.href = "application.html";
        } else {
            showNextStep();
        }
    });
});
