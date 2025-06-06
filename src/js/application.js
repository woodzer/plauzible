const { invoke } = window.__TAURI__.core;
const { writeText } = window.__TAURI__.clipboardManager;

import { camelCaseString, CHARACTER_SETS, showError, showSuccess } from "./utilities.js";

const MINIMUM_PASSWORD_LENGTH = 10;
const RECORD_PROPERTIES_TO_IGNORE = [];

let settings = {
    passwordHash: null,
    records: [],
    timeoutFunction: null
};

function clearAllFormErrors(section) {
    section.querySelectorAll(".field .help").forEach((element) => element.classList.add("is-hidden"));
}

function clearRecordListTable() {
    let recordListTable = document.querySelector(".record-list-table-body");

    if(recordListTable) {
        recordListTable.innerHTML = "";
    } else {
        console.error("Failed to find the record list table body element on the page.");
    }
}


function createRecord(event) {
    event.preventDefault();
    touchTimeout();
    if(validateRecordForm()) {
        if(settings.passwordHash) {
            let data = getRecordContent();

            delete data.id;
            delete data.passwordCopy;
            invoke("store_record", {passwordHashHex: settings.passwordHash, record: JSON.stringify(data)})
                .then((output) => {
                    let listRecord = JSON.parse(output);
                    settings.records.push(listRecord);
                    settings.record = settings.records.sort((rhs, lhs) => rhs.name.localeCompare(lhs.name));
                    populateRecordListTable();
                    showSection("application_section")
                        .then(() => {
                            showSuccess("Record successfully created.");
                        });
                })
                .catch((error) => showError(`Record creation failed. Cause: ${error}`));
        } else {
            showError("Call to create record failed because the password hash has not been set.");
        }
    }
}

function copyPasswordToTheClipboard(event) {
    let target = event.target;

    event.preventDefault();
    touchTimeout();
    if(!target.dataset.recordId) {
        target = event.target.closest(".button") || event.target.closest(".icon");
    }

    if(target.dataset.recordId) {
        let record = settings.records.find((entry) => `${entry.id}` === target.dataset.recordId);

        if(record) {
            invoke("decrypt_record", {passwordHash: settings.passwordHash, record: record.data})
                .then((json) => {
                    let object = JSON.parse(json);
                    return(writeText(object.password));
                })
                .then(() => {
                    showSuccess("Password copied to the clipboard.");
                })
                .catch((error) => {
                    showError(error);
                });
        } else {
            console.error(`Unable to locate a record with an id of '${target.dataset.recordId}'.`);
        }
    } else {
        console.error("Copy password element does not possess a record id data attribute.");
    }
}

function deleteRecord(event) {
    let modal = document.querySelector("#delete_confirmation_modal");

    event.preventDefault();
    touchTimeout();
    if(modal) {
        let source = event.target;

        if(!source.dataset.recordId) {
            source = source.closest("span.icon");
        }

        if(source.dataset.recordId) {
            modal.querySelector(".submit-button").dataset.recordId = source.dataset.recordId;
            modal.classList.add("is-active");
        } else {
            showError("Unable to delete the specified entry, record id not found. Please contact support.");
        }
    } else {
        console.error("Unable to locate the delete confirmation modal on the page.");
    }
}

function editRecord(recordId) {
    let record = settings.records.find((record) => record.id === recordId);

    touchTimeout();
    if(record) {
        invoke("decrypt_record", {passwordHash: settings.passwordHash, record: record.data})
            .then((json) => {
                let object = JSON.parse(json);

                object.id = recordId;
                resetForm("update");
                populateRecordForm(object);
                showSection("record_form")
                    .then(() => {
                        setTimeout(() => {
                            document.querySelector('input[name="name"]').select();
                        }, 250);
                    });
            })
            .catch((error) => {
                showError(error);
            });
    } else {
        console.error(`Unable to locate a record with the id ${recordId}.`);
        showError("Edit request failed. Request record could not be located.");
    }
}

function endSession(event) {
    if(event) {
        event.preventDefault();
    }

    settings.passwordHash = null;
    settings.records = [];
    clearRecordListTable();
    showPasswordSection();
    settings.timeoutFunction = null;
}

function generatePassword(event) {
    let modal = document.querySelector("#password_generator_modal");

    event.preventDefault();
    touchTimeout();
    if(modal) {
        let passwordLength = parseInt(modal.querySelector('input[name="passwordLength"]').value);
        let characterSetKey = modal.querySelector('select[name="characterSet"]').value;
        let characterSet = CHARACTER_SETS[characterSetKey];

        console.log(`Password length: ${passwordLength}`);
        console.log(`Character set: ${characterSet}`);
        invoke("select_random_characters", {text: characterSet, length: passwordLength})
            .then((output) => {
                modal.querySelector('input[name="generatedPassword"]').value = output;
                modal.querySelector("button.submit-button").disabled = false;
            })
            .catch((error) => showError(`Failed to generate password. Cause: ${error}`));
    } else {
        console.error("Unable to locate the password generator modal on the page.");
    }
}


function getRecordContent() {
    let record = null;
    let section = document.querySelector("#record_form");

    if(section) {
        record = {};
        section.querySelectorAll("input").forEach((field) => {
            let propertyName = camelCaseString(field.name);

            if(!RECORD_PROPERTIES_TO_IGNORE.includes(propertyName)) {
                record[propertyName] = field.value.trim();
            }
        });
        section.querySelectorAll("textarea").forEach((field) => {
            let propertyName = camelCaseString(field.name);

            if(!RECORD_PROPERTIES_TO_IGNORE.includes(propertyName)) {
                record[propertyName] = field.value;
            }
        });
    } else {
        console.error("Unable to get record content as form section not found on the page.");
    }

    return(record);
}

function getSection(sectionId) {
    return(new Promise((resolve, reject) => {
        let section = document.querySelector(`#${sectionId}`);

        section !== null ? resolve(section) : reject(`Failed to find the '${sectionId}' section on the page.`);
    }));
}

function getVisibleSection() {
    return(new Promise((resolve, reject) => {
        let target;
        document.querySelectorAll(".ui-section").forEach((section) => {
            if(!section.classList.contains("is-hidden")) {
                target = section;
                resolve(target);
            }
        });

        if(!target) {
            reject("No visible section found.");
        }
    }));
}

function hideFieldHelp(element) {
    let field = element.closest(".field");

    if(field) {
        let help = field.querySelector(".help");
        if(help) {
            help.classList.add("is-hidden");
        }
    }
}

function hideVisibleSection() {
    return(getVisibleSection()
        .then((section) => {
            section.classList.add("is-hidden");
        }));
}

function initializeApplication() {
    setupPasswordHandling();
    setupModals();
    setupRecordForm();
    setupNavigationBar();
    showPasswordSection();
    touchTimeout();
}

function onDeleteRecordConfirmed(event) {
    let source = event.target;

    event.preventDefault();
    touchTimeout();
    if(source.dataset.recordId) {
        let recordId = parseInt(source.dataset.recordId);

        if(!isNaN(recordId)) {
            invoke("delete_record", {recordId: recordId})
                .then((id) => {
                    settings.records = settings.records.filter((record) => record.id !== id);
                    source.closest(".modal").classList.remove("is-active");
                    populateRecordListTable();
                })
                .catch((error) => {
                    showError(`Record deletion failed. Cause: ${error}`);
                });
        } else {
            showError("Unable to delete the specified entry, invalid record id encountered. Please contact support.");
        }
    } else {
        showError("Unable to delete the specified entry, record id not found. Please contact support.");
    }
}

function openPasswordGeneratorModal(event) {
    let modal = document.querySelector("#password_generator_modal");

    event.preventDefault();
    touchTimeout();
    modal.querySelector("button.submit-button").disabled = true;
    if(modal) {
        invoke("get_standard_settings")
            .then((data) => {
                let object = JSON.parse(data);
                let setting = object.find((s) => s.key === "password.length");

                if(setting) {
                    modal.querySelector('input[name="passwordLength"]').value = parseInt(setting.value);
                }

                setting = object.find((s) => s.key === "password.character_set");
                if(setting) {
                    modal.querySelector('select[name="characterSet"]').value = setting.value;
                }

                modal.querySelector('input[name="generatedPassword"]').value = "";
                modal.classList.add("is-active");
            })
            .catch((error) => showError(`Failed to get password settings. Cause: ${error}`));
    } else {
        console.error("Unable to locate the password generator modal on the page.");
    }
}

function populateRecordForm(record) {
    let section = document.querySelector("#record_form");

    if(section) {
        section.querySelectorAll("input").forEach((field) => {
            let fieldName = camelCaseString(field.name);

            if(record[fieldName]) {
                field.value = record[fieldName];
            } else {
                field.value = "";
            }
        });

        section.querySelectorAll("textarea").forEach((field) => {
            let fieldName = camelCaseString(field.name);

            if(record[fieldName]) {
                field.value = record[fieldName];
            } else {
                field.value = "";
            }
        });

        section.querySelector('input[name="passwordCopy"]').value = `${record.password}`;
        section.querySelectorAll(".uses-record-id").forEach((e) => e.dataset.recordId = record.id);
    } else {
        console.error("Unable to locate the record form section on the page.");
    }
}

function populateRecordListTable() {
    let recordListTable = document.querySelector("#record_list_table");

    if(recordListTable) {
        let rowTemplate = document.querySelector("#list_table_row_template");

        if(rowTemplate) {
            let tableBody = recordListTable.querySelector("tbody");

            clearRecordListTable();
            settings.records.forEach((record) => {
                let row     = rowTemplate.content.cloneNode(true);
                let columns = row.querySelectorAll(".table-column");

                columns[0].innerText = record.name;
                row.querySelector("div.table-row").dataset.id = `${record.id}`;
                setupRowEventHandlers(row, record);
                recordListTable.appendChild(row);
            });
        } else {
            console.error("Failed to find the record list table row template element on the page.");
        }
    } else {
        console.error("Failed to find the record list table element on the page.");
    }
}

function resetForm(mode) {
    let section = document.querySelector("#record_form");

    if(section) {
        clearAllFormErrors(section);
        section.querySelectorAll("input").forEach((field) => {
            field.value = "";
            hideFieldHelp(field);
        });
        section.querySelectorAll("textarea").forEach((field) => {
            field.value = "";
            hideFieldHelp(field);
        });

        if(mode === "update") {
            section.querySelector(".submit-record-create").classList.add("is-hidden");
            section.querySelector(".submit-record-update").classList.remove("is-hidden");
            section.querySelector(".create-title").classList.add("is-hidden");
            section.querySelector(".update-title").classList.remove("is-hidden");
        } else {
            section.querySelector(".submit-record-update").classList.add("is-hidden");
            section.querySelector(".submit-record-create").classList.remove("is-hidden");
            section.querySelector(".update-title").classList.add("is-hidden");
            section.querySelector(".create-title").classList.remove("is-hidden");
        }
    } else {
        console.error("Unable to get record content as form section not found on the page.");
    }
}

function setupModals() {
    let modal;

    document.querySelectorAll(".cancel-modal").forEach((element) => {
        element.addEventListener("click", (event) => {
            event.preventDefault();
            element.closest(".modal").classList.remove("is-active");
        })
    });

    modal = document.querySelector("#delete_confirmation_modal");
    if(modal) {
        modal.querySelector("button.submit-button").addEventListener("click", onDeleteRecordConfirmed);
    }

    modal = document.querySelector("#password_generator_modal");
    if(modal) {
        modal.querySelector("button.generate-password-button").addEventListener("click", generatePassword);
        document.querySelectorAll("button.open-password-generator").forEach((element) => {
            element.addEventListener("click", openPasswordGeneratorModal);
        });

        let field = modal.querySelector('input[name="generatedPassword"');
        field.addEventListener("change", (event) => {
            modal.querySelector("button.submit-button").disabled = (field.value === "");
        });

        modal.querySelector("button.submit-button").addEventListener("click", useGeneratedPassword);
    }
}

function setupNavigationBar() {
    document.querySelectorAll(".create-record").forEach((element) => {
        element.addEventListener("click", (event) => {
            event.preventDefault();
            resetForm("create");
            showRecordFormSection();
        })
    });

    document.querySelectorAll(".end-session").forEach((element) => {
        element.addEventListener("click", endSession);
    });
}

function setupPasswordHandling() {
    let passwordSection = document.querySelector("#password_section");

    if(passwordSection) {
        passwordSection.querySelector('input[name="sessionPassword"]').addEventListener("keypress", (event) => {
            const keyCode = event.code || event.key;
            if(keyCode === 'Enter') {
                submitPassword(event);
            }
        });
        password_section.querySelector("#submit_password_button").addEventListener("click", submitPassword);
    } else {
        console.error("Unable to locate the password section on the page.");
    }
}

function setupRecordForm() {
    let section = document.querySelector("#record_form");

    if(section) {
        section.querySelector(".submit-record-create").addEventListener("click", createRecord);
        section.querySelector(".submit-record-update").addEventListener("click", updateRecord);
        section.querySelectorAll(".cancel-record-form").forEach((element) => {
            element.addEventListener("click", () => {
                resetForm("create");
                showSection("application_section");
            });
        });
        section.querySelector("button.copy-password").addEventListener("click", copyPasswordToTheClipboard);
    } else {
        console.error("Failed to locate the record form section on the page.");
    }
}

function setupRowEventHandlers(row, record) {
    let link = row.querySelector(".edit-record-link");

    if(link) {
        link.addEventListener("click", (event) => {
            editRecord(record.id);
            showSection("record_form");
        });
    }

    link = row.querySelector(".delete-record-link");
    if(link) {
        link.dataset.recordId = record.id;
        link.addEventListener("click", deleteRecord);
    }

    link = row.querySelector(".copy-password-link");
    if(link) {
        link.dataset.recordId = record.id;
        link.addEventListener("click", copyPasswordToTheClipboard);
    }

    link = row.querySelector(".open-url-link");
    if(link) {
        if(record.hasURL) {
            console.log("Open URL link handler would be set up here!");
        } else {
            link.classList.add("is-hidden");
        }
    }
}

function showApplicationSection(passwordHash) {
    invoke("get_records_for_password", {passwordHash: passwordHash})
    .then((data) => {
        let object = JSON.parse(data);
        settings.records = object.records.sort((rhs, lhs) => rhs.name.localeCompare(lhs.name));
        populateRecordListTable();
        showSection("application_section");
    });
}

function showFieldHelp(element) {
    let field = element.closest(".field");

    if(field) {
        let help = field.querySelector(".help");
        if(help) {
            help.classList.remove("is-hidden");
        }
    }
}

function showRecordFormSection() {
    return(showSection("record_form")
        .then((section) => {
            setTimeout(() => {
            let nameField = section.querySelector('input[name="name"]');

            if(nameField) {
                nameField.focus();
            }
        }, 250);                        
        }));
}

function showPasswordSection() {
    return(showSection("password_section")
        .then((section) => {
            let passwordField = section.querySelector('input[name="sessionPassword"]');

            if(passwordField) {
                hideFieldHelp(passwordField);
                setTimeout(() => {
                    let passwordField = section.querySelector('input[name="sessionPassword"]');

                    if(passwordField) {
                        passwordField.focus();
                    }
                }, 250);                        
            }
        }));
}

function showSection(sectionName) {
    return(hideVisibleSection()
        .then(() => {
            return(getSection(sectionName));
        })
        .then((section) => {
            section.classList.remove("is-hidden");
            return(section);
        })
        .catch((error) => {
            console.error(`Failed to show the '${sectionName}' UI section. Cause: ${error}`)
        }));
}

function submitPassword(event) {
    let passwordField = document.querySelector('input[name="sessionPassword"]');

    event.preventDefault();
    touchTimeout();
    if(passwordField) {
        let passwordValue = passwordField.value;

        if(passwordValue.trim().length >= MINIMUM_PASSWORD_LENGTH) {
            passwordField.value = "";
            invoke("hash_password", {password: passwordValue})
                .then((hash) => {
                    settings.passwordHash = hash;
                    showApplicationSection(hash);
                });
        } else {
            showFieldHelp(passwordField);
        }
    } else {
        console.error("Unable to locate the password field.");
    }
}

function touchTimeout() {
    if(settings.timeoutFunction) {
        clearTimeout(settings.timeoutFunction);
    }
    settings.timeoutFunction = setTimeout(() => endSession(null), 600000);
}

function useGeneratedPassword(event) {
    let modal = document.querySelector("#password_generator_modal");

    event.preventDefault();
    touchTimeout();
    if(modal) {
        let generatedPasswordField = document.querySelector('input[name="generatedPassword"]');
        let passwordField = document.querySelector('input[name="password"]');

        if(generatedPasswordField && passwordField) {
            passwordField.value = generatedPasswordField.value;
            generatedPasswordField.value = "";
            modal.querySelector("button.submit-button").disabled = true;
            modal.classList.remove("is-active");
        }
    }
}

function updateRecord(event) {
    let record = getRecordContent();

    event.preventDefault();
    touchTimeout();
    if(validateRecordForm(record.id)) {
        if(settings.passwordHash) {
            let recordId = parseInt(record.id);
            let recordOffset = settings.records.findIndex((r) => r.id == recordId);

            invoke("decrypt_record", {passwordHash: settings.passwordHash, record: settings.records[recordOffset].data})
                .then((recordJSON) => {
                    let object = JSON.parse(recordJSON);

                    if(record.password != record.passwordCopy) {
                        if(!object.passwordHistory) {
                            object.passwordHistory = [];
                        }
                        object.passwordHistory.push({changed: new Date(), password: record.passwordCopy});
                    }

                    delete record.id;
                    delete record.passwordCopy;
                    object = Object.assign(object, record)

                    return(invoke("update_record", {passwordHashHex: settings.passwordHash, recordId: recordId, record: JSON.stringify(object)}));
                })
                .then((output) => {
                    let listRecord = JSON.parse(output);

                    settings.records[recordOffset] = listRecord;
                    settings.record = settings.records.sort((rhs, lhs) => rhs.name.localeCompare(lhs.name));
                    populateRecordListTable();
                    showSection("application_section")
                        .then(() => {
                            showSuccess("Record successfully updated.");
                        });
                })
                .catch((error) => showError(`Record update failed. Cause: ${error}`));
        } else {
            showError("Call to update record failed because the password hash has not been set.");
        }
    }
}

function validateRecordForm(ignoreId) {
    let valid = true;
    let section = document.querySelector("#record_form");

    if(section) {
        let field = section.querySelector('input[name="name"]');

        clearAllFormErrors(section);
        if(field) {
            let value = field.value.trim();
            if(value === "") {
                valid = false;
            } else {
                let found = settings.records.find((entry) => entry.name === value && `${entry.id}` !== `${ignoreId}`);

                if(found) {
                    valid = false;
                }
            }

            if(!valid) {
                showFieldHelp(field);
            }
        }

        field = section.querySelector('input[name="password"]');
        if(field && field.value === "") {
            valid = false;
            showFieldHelp(field);
        }

        field = section.querySelector('input[name="url"]');
        if(field && field.value.trim() !== "" && !field.checkValidity()) {
            valid = false;
            showFieldHelp(field);
        }
    } else {
        valid = false;
        console.error("Failed to validate record form, form section could not be found on the page.");
    }

    return(valid);
}

window.addEventListener("DOMContentLoaded", () => {
    console.log("Application starting...");
    initializeApplication();
});
