const { invoke } = window.__TAURI__.core;
const { writeText } = window.__TAURI__.clipboardManager;
const { open } = window.__TAURI__.dialog;

import { camelCaseString,
         CHARACTER_SETS,
         CURRENT_VERSION,
         fetchApplicationVersionDetails,
         showError,
         showInfo,
         showSuccess,
         uniqueAndSortStringList,
         watchSpecificClass } from "./utilities.js";
import { importBitwardenJSONFile } from "./imports.js";
import RecordImporter from "./record_importer.js";
import ImportReport from "./import_report.js";
import RecordAPI from "./record_api.js";

const MINIMUM_PASSWORD_LENGTH = 10;
const RECORD_PROPERTIES_TO_IGNORE = [];

let settings = {
    activeSection: null,
    passwordHash: null,
    previousSection: null,
    records: [],
    tags: [],
    timeoutFunction: null
};


function applyRecordFilter(event) {
    let nameField = document.querySelector('input[name="nameFilter"]');
    let tagsField = document.querySelector('input[name="tagFilter"]');

    if(event) {
        event.preventDefault();
    }
    touchTimeout();
    setTimeout(() => {
        if(nameField.value.trim() !== "" || tagsField.value.trim() !== "" || settings.filterByNoTags) {
            settings.filter = (record) => {
                let tags = tagsField.value.split(", ").map((tag) => tag.trim().toLowerCase()).filter((tag) => tag !== "");
                let nameSearch = nameField.value.toLowerCase();

                let matchedOnName = nameSearch === "" || record.name.toLowerCase().includes(nameSearch);
                let matchedOnTags = tags.length === 0 || record.tags.some((tag) => tags.includes(tag.toLowerCase()));
                let matchedOnNoTags = settings.filterByNoTags && record.tags.length === 0;

                return(matchedOnName && (matchedOnTags || matchedOnNoTags));
            };
        } else {
            settings.filter = () => true;
        }
        populateRecordListTable();
    }, 250);
}

function clearAllFormErrors(section) {
    section.querySelectorAll(".field .help").forEach((element) => element.classList.add("is-hidden"));
}

function clearAllFilters() {
    let fields = [document.querySelector('input[name="nameFilter"]'),
                  document.querySelector('input[name="tagFilter"]')];
    let dropdown = document.querySelector("#tag_filter_dropdown");

    fields.forEach((field) => {
        field.value = "";
    });
    settings.filterByNoTags = false;
    dropdown.classList.add("is-hidden");
    clearSelectedTags();
}

function clearRecordListTable() {
    let recordListTable = document.querySelector(".record-list-table-body");

    if(recordListTable) {
        recordListTable.innerHTML = "";
    } else {
        console.error("Failed to find the record list table body element on the page.");
    }
}

function clearSelectedTags() {
    let element = document.querySelector("#tag_filter_field");

    if(element) {
        element.querySelectorAll('input[type="checkbox"]').forEach((element) => {
            element.checked = false;
        });
        settings.filterByNoTags = false;
    }
}

function createRecord(event) {
    event.preventDefault();
    touchTimeout();
    if(validateRecordForm()) {
        if(settings.passwordHash) {
            let data = getRecordContent();
            let api = new RecordAPI(settings, invoke);

            api.create(data)
                .then((listRecord) => {
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
            let api = new RecordAPI(settings, invoke);

            api.decrypt(record)
                .then((object) => {
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

function copyUserNameToTheClipboard(event) {
    let target = event.target;

    event.preventDefault();
    touchTimeout();
    if(!target.dataset.recordId) {
        target = event.target.closest(".button") || event.target.closest(".icon");
    }

    if(target.dataset.recordId) {
        let record = settings.records.find((entry) => `${entry.id}` === target.dataset.recordId);

        if(record) {
            let api = new RecordAPI(settings, invoke);

            api.decrypt(record)
                .then((object) => {
                    return(writeText(object.userName));
                })
                .then(() => {
                    showSuccess("User name copied to the clipboard.");
                })
                .catch((error) => {
                    showError(error);
                });
        }
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
        let api = new RecordAPI(settings, invoke);

        api.decrypt(record)
            .then((object) => {
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
    clearAllFilters();
    clearRecordListTable();
    document.querySelectorAll(".modal").forEach((modal) => modal.classList.remove("is-active"));
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
                if(propertyName === "tags") {
                    record[propertyName] = field.value.split(", ").map((tag) => tag.trim());
                } else {
                    record[propertyName] = field.value.trim();
                }
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
    invoke("get_application_settings")
        .then((data) => {
            console.log("Application settings:", data);
            let object = JSON.parse(data);
            settings.mode = object.operationMode;
            settings.termsAccepted = object.termsAccepted;
            settings.termsRemoted = object.termsRemoted;

            setupPageHandlers();
            setupTermsOfService();
            setupPasswordHandling();
            setupModals();
            setupRecordForm();
            setupFileImporter();
            setupNavigationBar();
            showPasswordSection();
            setupDropdownSelects();
            setupRecordFilters();
            runVersionCheck();
            touchTimeout();
        })
        .catch((error) => showError(`Failed to get application settings. Cause: ${error}`));
}

function launchURL(url) {
    return(invoke("open_url", {url: url}));
}

function onDeleteRecordConfirmed(event) {
    let source = event.target;

    event.preventDefault();
    touchTimeout();
    if(source.dataset.recordId) {
        let recordId = parseInt(source.dataset.recordId);

        if(!isNaN(recordId)) {
            let api = new RecordAPI(settings, invoke);

            api.delete(recordId)
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

function onImportCompletionEvent(event) {
    let report = event.detail.report;
    let section = document.querySelector("#file_importer_progress");

    settings.records = report.result;
    showSuccess("File record were imported successfully.");
    if(section) {
        section.querySelector(".close-file-import").disabled = false;
    }
}

function onImportLogEvent(event) {
    let log = document.querySelector("#import_log");
    let template = document.querySelector("#import_log_template");

    if(log && template) {
        let line = template.content.cloneNode(true);

        line.querySelector("p").innerText = event.detail.message;
        line.firstElementChild.classList.add(`${event.detail.level}-log-line`);
        log.appendChild(line);
        log.scrollTop = log.scrollHeight;
    }
}

function onLaunchURL(event) {
    let target = event.target;

    event.preventDefault();
    touchTimeout();
    if(!target.dataset.recordId) {
        target = event.target.closest(".button") || event.target.closest(".icon");
    }

    if(target.dataset.recordId) {
        let record = settings.records.find((entry) => `${entry.id}` === target.dataset.recordId);

        if(record) {
            let api = new RecordAPI(settings, invoke);

            api.decrypt(record)
                .then((object) => {
                    return(launchURL(object.url));
                })
                .catch((error) => showError(`Failed to open URL. Cause: ${error}`));
        } else {
            console.error(`Unable to locate a record with an id of '${target.dataset.recordId}'.`);
        }
    } else {
        console.error("Copy password element does not possess a record id data attribute.");
    }
}

function onOpenImportFile(event) {
    let section = document.querySelector("#file_importer");
    let field = section.querySelector('input[name="importFilePath"]');
    let settings = {
        directory: false,
        extensions: ["json"],
        multiple: false,
        name: "Import File"
    };

    event.preventDefault();
    touchTimeout();
    open(settings)
        .then((file) => {
            if(file) {
                field.value = file;
                field.dispatchEvent(new Event("change"));
            }
        })
        .catch((error) => showError(`Failed to open the import file. Cause: ${error}`));
}

function onStartImport(event) {
    let section = document.querySelector("#file_importer");
    let pathField = section.querySelector('input[name="importFilePath"]');
    let typeField = section.querySelector('select[name="fileType"]');
    let duplicateField = section.querySelector('select[name="duplicateRecords"]');
    let formSection = section.querySelector("#file_importer_form");
    let progressSection = section.querySelector("#file_importer_progress");
    let report = new ImportReport();

    if(typeField.value === "bitwarden") {
        importBitwardenJSONFile(pathField.value, report)
            .then((records) => {
                let api = new RecordAPI(settings, invoke);
                let importer = new RecordImporter(api, settings.records, records, settings.passwordHash, report, (duplicateField.value === "ignore"));

                importer.addProgressListener((event) => {
                    let progress = section.querySelector("#file_importer_progress_bar");

                    if(progress) {
                        progress.value = event.detail.percentage;
                    }
                });

                report.addEventListener("log", onImportLogEvent);
                importer.addCompletionListener(onImportCompletionEvent);

                formSection.classList.add("is-hidden");
                progressSection.classList.remove("is-hidden");

                importer.import()
                    .then((report) => {
                        settings.records = report.result;
                        populateRecordListTable();
                        showSuccess("File record were imported successfully.");
                    });
            })
            .catch((error) => showError(`Failed to import the file. Cause: ${error}`));
    } else {
        showError("The import type requested is currently not supported.");
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
                if(fieldName === "tags") {
                    field.value = record[fieldName].join(", ");
                } else {
                    field.value = record[fieldName];
                }
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
            let filter = () => true;
            let fragment = document.createDocumentFragment();

            if(settings.filter) {
                filter = settings.filter;
            }

            settings.records.filter(filter).forEach((record) => {
                let row     = rowTemplate.content.cloneNode(true);
                let columns = row.querySelectorAll(".table-column");

                columns[0].innerText = record.name;
                row.querySelector("div.table-row").dataset.id = `${record.id}`;
                setupRowEventHandlers(row, record);
                fragment.appendChild(row);
            });

            clearRecordListTable();
            recordListTable.appendChild(fragment);
        } else {
            console.error("Failed to find the record list table row template element on the page.");
        }
    } else {
        console.error("Failed to find the record list table element on the page.");
    }
}

function populateAvailableTagsList() {
    let listControl = document.querySelector("#tag_selector_list");

    if(listControl) {
        let labels = uniqueAndSortStringList([].concat(settings.tags));
        let template = document.querySelector("#tag_filter_list_entry");
        let fragment = document.createDocumentFragment();

        listControl.innerHTML = "";
        labels.filter((label) => label.trim() !== "").forEach((label) => {
            let entry = template.content.cloneNode(true);
            let checkbox = entry.querySelector(".tag-checkbox");

            entry.querySelector(".tag-label").innerText = label;
            checkbox.setAttribute("value", label);
            fragment.appendChild(entry);
        });
        listControl.appendChild(fragment);
    }
}

function populateTagFilterList() {
    let list = document.querySelector("#tag_filter_field");

    if(list) {
        let labels = uniqueAndSortStringList([].concat(settings.tags));
        let template = document.querySelector("#tag_filter_list_entry");
        let listControl = list.querySelector(".dropdown-select-list");

        listControl.innerHTML = "";
        let noneEntry = template.content.cloneNode(true);
        noneEntry.id = "none_tag_entry";
        noneEntry.querySelector(".tag-label").innerText = "Has No Tags";
        noneEntry.querySelector(".tag-checkbox").setAttribute("value", "");
        noneEntry.querySelector(".tag-checkbox").addEventListener("change", (event) => {
            event.preventDefault();
            settings.filterByNoTags = event.target.checked;
            applyRecordFilter(event);
        });
        listControl.appendChild(noneEntry);

        labels.forEach((label) => {
            let entry = template.content.cloneNode(true);
            let checkbox = entry.querySelector(".tag-checkbox");
            let field = list.querySelector('input[name="tagFilter"]');

            entry.querySelector(".tag-label").innerText = label;
            checkbox.setAttribute("value", label);
            checkbox.addEventListener("change", (event) => {
                let tags = [];

                listControl.querySelectorAll(".tag-checkbox:checked").forEach((checkbox) => {
                    tags.push(checkbox.value);
                });
                field.value = tags.join(", ");
                applyRecordFilter(event);
            });
            listControl.appendChild(entry);
        });
    }
}

function requireTermsAcceptance(onAcceptance) {
    let modal = document.querySelector("#terms_of_service_modal");
    let eventListener = (event) => {
        event.preventDefault();
        modal.classList.remove("is-active");
        onAcceptance();
    };

    modal.querySelector("button.submit-button").addEventListener("click", eventListener);
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

function runVersionCheck() {
    fetchApplicationVersionDetails()
        .then((data) => {
            console.log("Version Data:", data);
            if(data.version !== CURRENT_VERSION) {
                console.log("New version available:", data.version);
                showInfo(`<p>A new version of the Plauzible client application is available <a href="${data.url}" target="_blank">here</a>.</p>`);
            }
        });
}

function setupDropdownSelects() {
    let controls = document.querySelectorAll(".dropdown-select");

    controls.forEach((control) => {
        control.querySelector(".toggle-list").addEventListener("click", (event) => {
            let list = control.querySelector(".dropdown-select-list");
            list.classList.toggle("is-hidden");
        });
    });
}

function setupFileImporter() {
    let section = document.querySelector("#file_importer");
    let importButton = section.querySelector(".submit-file-import");
    let closeButton = section.querySelector(".close-file-import");
    let field = section.querySelector('input[name="importFilePath"]');

    if(section) {
        field.addEventListener("change", () => {
            touchTimeout();
            importButton.disabled = (field.value.trim() === "");
        });
        section.querySelector(".open-file-button").addEventListener("click", onOpenImportFile);
        importButton.addEventListener("click", onStartImport);
        closeButton.addEventListener("click", () => {
            showApplicationSection(settings.passwordHash);
        });
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

    modal = document.querySelector("#tag_selector_modal");
    if(modal) {
        let addButton = modal.querySelector("button.add-tag");
        let submitButton = modal.querySelector("button.submit-button");

        addButton.addEventListener("click", (event) => {
            let newTagField = modal.querySelector('input[name="newTag"]');

            if(newTagField.value.trim().length > 0) {
                let tagList = modal.querySelector(".tag-selector-list");

                if(tagList) {
                    let template = document.querySelector("#tag_filter_list_entry");
                    let entry = template.content.cloneNode(true);
                    let checkbox = entry.querySelector(".tag-checkbox");

                    entry.querySelector(".tag-label").innerText = newTagField.value.trim();
                    checkbox.setAttribute("value", newTagField.value.trim());
                    checkbox.checked = true;
                    tagList.insertBefore(entry, tagList.firstChild);
                    newTagField.value = "";
                    newTagField.focus();
                }
            }
        });

        submitButton.addEventListener("click", (event) => {
            let tagList = modal.querySelector(".tag-selector-list");
            let selectedTags = Array.from(tagList.querySelectorAll(".tag-checkbox:checked")).map((checkbox) => checkbox.value);
            let hiddenField = modal.querySelector('input[name="selectedTags"]');

            hiddenField.value = selectedTags.join(", ");
            modal.classList.remove("is-active");
        });
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

    document.querySelector(".file-importer").addEventListener("click", (event) => {
        event.preventDefault();
        showFileImporterSection();
    });

    document.querySelectorAll(".end-session").forEach((element) => {
        element.addEventListener("click", endSession);
    });

    document.querySelectorAll(".settings-button").forEach((element) => {
        element.addEventListener("click", (event) => {
            event.preventDefault();
            showSettings();
        });
    });
}

function setupPageHandlers() {
    window.addEventListener("message", (event) => {
        let message = event.data;
        let emptyIFrame = () => {
            document.querySelector("#subpage_iframe").src = "/empty.html";
        };

        if(message.source === "settings") {
            if(message.action === "closed") {
                switch(settings.previousSection) {
                    case "application_section":
                        showApplicationSection(settings.passwordHash);
                        setTimeout(emptyIFrame, 500);
                        break;
                    case "file_importer":
                        showFileImporterSection();
                        setTimeout(emptyIFrame, 500);
                        break;
                    case "password_section":
                        showPasswordSection();
                        setTimeout(emptyIFrame, 500);
                        break;
                    case "record_form":
                        showRecordFormSection();
                        setTimeout(emptyIFrame, 500);
                        break;
                    default:
                        console.error(`Unknown previous section: ${settings.previousSection}`);
                        break;
                }
            } else {
                console.error(`Unknown message action received from settings: ${message.source}.${message.action}`);
            }
        }
    });

    let element = document.querySelector(".close-frame-link");
    if(element) {
        element.addEventListener("click", (event) => {
            let section = settings.previousSection || "password_section";

            event.preventDefault();
            showSection(section);
        });
    }
}

function setupPasswordHandling() {
    let passwordSection = document.querySelector("#password_section");

    if(passwordSection) {
        passwordSection.querySelector('input[name="sessionPassword"]').addEventListener("keypress", (event) => {
            const keyCode = event.code || event.key;
            if(keyCode === 'Enter') {
                verifyTermsAcceptance(() => submitPassword(event));
            }
        });
        password_section.querySelector("#submit_password_button").addEventListener("click", (event) => verifyTermsAcceptance(() => submitPassword(event)));
    } else {
        console.error("Unable to locate the password section on the page.");
    }
}

function setupRecordFilters() {
    let elements = [document.querySelector("#name_filter_field"),
                    document.querySelector("#tag_filter_field")];

    if(elements.length > 0) {
        let fields = [elements[0].querySelector('input[name="nameFilter"]'),
                      elements[1].querySelector('input[name="tagFilter"]')];
        let clearButtons = [elements[0].querySelector(".clear-name-filter"),
                            elements[1].querySelector(".clear-tags-filter")];

        fields[0].addEventListener("input", applyRecordFilter);
        fields[1].addEventListener("change", applyRecordFilter);
        clearButtons[0].addEventListener("click", (e) => {
            fields[0].value = "";
            applyRecordFilter(e);
        });
        clearButtons[1].addEventListener("click", (e) => {
            clearSelectedTags();
            fields[1].value = "";
            applyRecordFilter(e);
        });
        document.querySelector(".button.clear-filters").addEventListener("click", (e) => {
            clearAllFilters();
            applyRecordFilter(e);
        });
    }
}

function setupRecordForm() {
    let section = document.querySelector("#record_form");

    if(section) {
        section.querySelector('input[name="tags"]').addEventListener("click", (event) => {
            let selectedTags = section.querySelector('input[name="tags"]').value.split(", ");

            event.preventDefault();
            touchTimeout();
            showTagSelectorModal(selectedTags, (tags) => section.querySelector('input[name="tags"]').value = tags);
        });
        section.querySelector(".submit-record-create").addEventListener("click", createRecord);
        section.querySelector(".submit-record-update").addEventListener("click", updateRecord);
        section.querySelectorAll(".cancel-record-form").forEach((element) => {
            element.addEventListener("click", () => {
                resetForm("create");
                showSection("application_section");
            });
        });
        section.querySelector("button.copy-user-name").addEventListener("click", copyUserNameToTheClipboard);
        section.querySelector("button.copy-password").addEventListener("click", copyPasswordToTheClipboard);
        section.querySelector("button.open-url-link").addEventListener("click", (event) => {
            event.preventDefault();
            touchTimeout();
            let urlField = section.querySelector('input[name="url"]');

            if(urlField && urlField.value.trim() !== "") {
                launchURL(urlField.value);
            }
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
            link.dataset.recordId = record.id;
            link.addEventListener("click", onLaunchURL);
        } else {
            link.classList.add("is-hidden");
        }
    }
}

function setupTermsOfService() {
    let modal = document.querySelector("#terms_of_service_modal");

    if(modal) {
        let checkbox = modal.querySelector('input[name="termsAccepted"]');
        let submitButton = modal.querySelector("button.submit-button");

        checkbox.addEventListener("change", (event) => {
            submitButton.disabled = !checkbox.checked;
        });
    }
}

function showApplicationSection(passwordHash) {
    showSection("loading_section")
        .then(() => {
            let api = new RecordAPI(settings, invoke);

            return(api.getAll());
        })
        .then((records) => {
            settings.records = records;
            updateRecordTags();
            populateRecordListTable();
            populateTagFilterList();
            showSection("application_section");
        })
        .catch((error) => {
            console.error(`Load of reccords failed. Cause: ${error}`);
            showError(`${error}`);
            setTimeout(() => {
                showPasswordSection();
            }, 2500);
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

function showFileImporterSection() {
    return(showSection("file_importer")
        .then((section) => {
            let fileField = section.querySelector('input[name="importFilePath"]');
            let button = section.querySelector(".submit-file-import");

            fileField.value = "";
            button.disabled = true;
            setTimeout(() => {
                fileField.focus();
            }, 250);
        }));
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
            clearAllFilters();
            applyRecordFilter(null);
            settings.previousSection = settings.activeSection;
            settings.activeSection = null;
            return(getSection(sectionName));
        })
        .then((section) => {
            settings.activeSection = sectionName;
            section.classList.remove("is-hidden");
            return(section);
        })
        .catch((error) => {
            console.error(`Failed to show the '${sectionName}' UI section. Cause: ${error}`)
        }));
}

function showSettings() {
    return(showSection("iframe_section")
        .then((section) => {
            section.querySelector("#subpage_iframe").src = "/settings.html";
        }));
}

function showTagSelectorModal(selectedTags=[], callback=null) {
    let modal = document.querySelector("#tag_selector_modal");

    if(modal) {
        let newTagField = modal.querySelector('input[name="newTag"]');

        populateAvailableTagsList();
        modal.querySelectorAll(".tag-checkbox").forEach((checkbox) => {
            checkbox.checked = selectedTags.includes(checkbox.value);
        });

        
        modal.classList.add("is-active");
        let observer = watchSpecificClass(modal, "is-hidden", (isHidden) => {
            if(!isHidden) {
                observer.disconnect();
                updateRecordTags();
                if(callback) {
                    callback(modal.querySelector('input[name="selectedTags"]').value);
                }
            }
        });
        newTagField.focus();
    } else {
        console.error("Unable to locate the tag selector modal on the page.");
    }
}

function submitPassword(event) {
    let passwordField = document.querySelector('input[name="sessionPassword"]');

    event.preventDefault();
    touchTimeout();
    if(passwordField) {
        let passwordValue = passwordField.value;

        if(passwordValue.trim().length >= MINIMUM_PASSWORD_LENGTH) {
            showSection("loading_section");
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
            let api = new RecordAPI(settings, invoke);

            api.update(recordId, settings.records[recordOffset], record)
                .then((listRecord) => {
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

function updateRecordTags() {
    settings.tags = uniqueAndSortStringList(settings.records.map((r) => [].concat(r.tags)).flat().sort((rhs, lhs) => rhs.localeCompare(lhs)));
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

function verifyTermsAcceptance(onAcceptance) {
    if(settings.termsAccepted === "false") {
        let modal = document.querySelector("#terms_of_service_modal");
        let submitButton = modal.querySelector("button.submit-button");
        let cancelButtons = modal.querySelectorAll(".cancel-modal");
        let submitHandler = (event) => {
            event.preventDefault();
            touchTimeout();
            invoke("terms_accepted")
                .then((result) => {
                    settings.termsAccepted = result;
                    modal.classList.remove("is-active");
                    onAcceptance();
                })
                .catch((error) => {
                    console.warn(`Failed to accept terms of service. Cause: ${error}`);
                });
        };
        let cancelHandler = (event) => {
            submitButton.removeEventListener("click", onAcceptance);
        };

        submitButton.addEventListener("click", submitHandler, {once: true});
        cancelButtons.forEach((button) => {
            button.addEventListener("click", cancelHandler, {once: true});
        });
        modal.classList.add("is-active");
    } else if(settings.termsRemoted === "false") {
        let modal = document.querySelector("#terms_of_service_modal");
        invoke("terms_accepted")
                .then((result) => {
                    settings.termsAccepted = result;
                    modal.classList.remove("is-active");
                    onAcceptance();
                })
                .catch((error) => {
                    console.warn(`Failed to accept terms of service. Cause: ${error}`);
                });
    } else {
        onAcceptance();
    }
}

window.addEventListener("DOMContentLoaded", () => {
    console.log("Application starting...");
    initializeApplication();
});
