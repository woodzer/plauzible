const { invoke } = window.__TAURI__.core;

import { camelCaseString } from "./utilities.js";

const MINIMUM_PASSWORD_LENGTH = 10;

let settings = {
    passwordHash: null,
    records: []
};

function clearRecordListTable() {
    let recordListTable = document.querySelector("#record_list_table");

    if(recordListTable) {
        let tableBody = recordListTable.querySelector("tbody");

        if(tableBody) {
            tableBody.innerHTML = "";
        }
    } else {
        console.error("Failed to find the record list table element on the page.");
    }
}


function createRecord(event) {
    event.preventDefault();
    if(validateRecordForm()) {
        if(settings.passwordHash) {
            let data = getRecordContent();

            invoke("store_record", {passwordHashHex: settings.passwordHash, record: JSON.stringify(data)})
                .then((output) => {
                    let listRecord = JSON.parse(output);
                    settings.records.push(listRecord);
                    settings.record = settings.records.sort((rhs, lhs) => rhs.name.localeCompare(lhs.name));
                    populateRecordListTable();
                    showSection("application_section");
                });
        } else {
            console.error("Call to create record failed because the password hash has not been set.");
        }
    }
}

function editRecord(recordId) {
    let record = settings.records.find((record) => record.id === recordId);

    if(record) {
        invoke("decrypt_record", {passwordHash: settings.passwordHash, record: record.data})
            .then((json) => {
                let object = JSON.parse(json);

                resetForm("update");
                populateRecordForm(object);
                showSection("record_form");
            })
            .catch((error) => {
                showError(error);
            });
    } else {
        console.error(`Unable to locate a record with the id ${recordId}.`);
    }
}

function endSession(event) {
    event.preventDefault();
    settings.passwordHash = null;
    settings.records = [];
    clearRecordListTable();
    showPasswordSection();
}

function getRecordContent() {
    let record = null;
    let section = document.querySelector("#record_form");

    if(section) {
        record = {};
        section.querySelectorAll("input").forEach((field) => {
            record[camelCaseString(field.name)] = field.value.trim();
        });
        section.querySelectorAll("textarea").forEach((field) => {
            record[camelCaseString(field.name)] = field.value;
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
    setupRecordForm();
    setupNavigationBar();
    showPasswordSection();
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
                let columns = [row.querySelector("tr td:first-child"), row.querySelector("tr td:last-child")];

                columns[0].innerText = record.name;
                row.querySelector("tr").dataset.id = `${record.id}`;
                setupRowEventHandlers(row, record);
                tableBody.appendChild(row);
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
        let submitButton = document.querySelector("#submit_password_button");

        submitButton.addEventListener("click", submitPassword);
    } else {
        console.error("Unable to locate the password section on the page.");
    }
}

function setupRecordForm() {
    let section = document.querySelector("#record_form");

    if(section) {
        section.querySelector(".submit-record-create").addEventListener("click", createRecord);
        section.querySelectorAll(".cancel-record-form").forEach((element) => {
            element.addEventListener("click", () => {
                resetForm("create");
                showSection("application_section");
            });
        });


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
        console.log("Delete record link handler would be set up here!");
    }

    link = row.querySelector(".copy-password-link");
    if(link) {
        console.log("Copy password link handler would be set up here!");
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

function showError(message) {
    console.error("ERROR:", message);
    // TBD: SHOW ERRORS TO USER!!!
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
            let passwordField = section.querySelector('input[name="password"]');

            if(passwordField) {
                hideFieldHelp(passwordField);
                setTimeout(() => {
                    let passwordField = section.querySelector('input[name="password"]');

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
    let passwordField = document.querySelector('input[name="password"]');

    event.preventDefault();
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

function validateRecordForm() {
    let valid = true;
    let section = document.querySelector("#record_form");

    if(section) {
        let field = section.querySelector('input[name="name"]');


        if(field) {
            let value = field.value.trim();
            if(value === "") {
                valid = false;
            } else {
                let found = settings.records.find((entry) => entry.name === value);

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
