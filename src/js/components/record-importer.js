import View from "./view.js";
import { importBitwardenJSONFile } from "../imports.js";
import RecordAPI from "../record_api.js";
import ImportReport from "../import_report.js";
import RecordImportExecutor from "../record_import_executor.js";
const { invoke } = window.__TAURI__.core;
const { open } = window.__TAURI__.dialog;
import { showError, showSuccess } from "../utilities.js";

const RECORD_IMPORTER_STYLES = `
<style>
</style>
`;

const RECORD_IMPORTER_TEMPLATE = `
<div class="record-importer">
    <slot name="interface"></slot>
</div>
`;

class RecordImporter extends View {
    constructor() {
        super();
        this.shadowRoot.innerHTML = `${RECORD_IMPORTER_STYLES} ${RECORD_IMPORTER_TEMPLATE}`;
    }

    
    /**
     * Invoked whenever the view is activated (i.e. shown).
     */
    activated(data={}) {
        console.log("activated() called for record importer.");
        this.resetInterface();
    }


    connectedCallback() {
        let slot = this.shadowRoot.querySelector('slot');
        let elements = Array.from(slot.assignedElements())[0];

        super.connectedCallback();
        console.log("connectedCallback() called for record importer.");

        elements.querySelectorAll('.close-file-import').forEach((button) => {
            button.addEventListener("click", (event) => {
                this.viewSwitcher.close();
            });
        });

        let filePathField = elements.querySelector('input[name="importFilePath"]');

        filePathField.addEventListener("change", (event) => {
            this.validateImportSettings();
        });
        filePathField.addEventListener("click", (event) => {
            this.stateManager.touchApplicationTimeOut();
            this.onOpenFileButtonClicked(event, filePathField);
        });

        elements.querySelector('select[name="fileType"]').addEventListener("change", (event) => {
            this.validateImportSettings();
        });

        elements.querySelector('select[name="duplicateRecords"]').addEventListener("change", (event) => {
            this.validateImportSettings();
        });

        elements.querySelector(".open-file-button").addEventListener("click", (event) => {
            this.onOpenFileButtonClicked(event, filePathField);
        });

        elements.querySelector(".submit-file-import").addEventListener("click", (event) => {
            this.doImport(event);
        });
    }

    doImport(event) {
        if(this.validateImportSettings()) {
            this.runImport();
        } else {
            showError("Please fill in all the import settings.");
        }
    }

    handleImportCompletionEvent(event, elements) {
        let section = elements.querySelector("#file_importer_progress");
    
        showSuccess("File records were imported successfully.");
        if(section) {
            section.querySelector(".close-file-import").disabled = false;
        }    
    }

    handleImportLogEvent(event, elements) {
        let log = elements.querySelector("#import_log");
        let template = elements.querySelector("#import_log_template");
    
        if(log && template) {
            let line = template.content.cloneNode(true);
    
            line.querySelector("p").innerText = event.detail.message;
            line.firstElementChild.classList.add(`${event.detail.level}-log-line`);
            log.appendChild(line);
            log.scrollTop = log.scrollHeight;
        }    
    }

    onOpenFileButtonClicked(event, field) {
        let settings = {
            directory: false,
            extensions: ["json"],
            multiple: false,
            name: "Import File"
        };
    
        event.preventDefault();
        this.stateManager.touchApplicationTimeOut();
        open(settings)
            .then((file) => {
                if(file) {
                    field.value = file;
                    field.dispatchEvent(new Event("change"));
                }
            })
            .catch((error) => showError(`Failed to open the import file. Cause: ${error}`));    
    }

    resetInterface() {
        let slot = this.shadowRoot.querySelector('slot');
        let elements = Array.from(slot.assignedElements())[0];
        let formSection = elements.querySelector("#file_importer_form");
        let progressSection = elements.querySelector("#file_importer_progress");
        let progressBar = progressSection.querySelector("#file_importer_progress_bar");
        let log = progressSection.querySelector("#import_log");

        formSection.classList.remove("is-hidden");
        progressSection.classList.add("is-hidden");

        elements.querySelectorAll('input').forEach((input) => {
            input.value = "";
        });

        elements.querySelectorAll('select[name="fileType"]').forEach((select) => {
            select.value = "bitwarden";
        });

        elements.querySelectorAll('select[name="duplicateRecords"]').forEach((select) => {
            select.value = "ignore";
        });

        elements.querySelectorAll('.close-file-import').forEach((button) => {
            button.disabled = false;
        });

        if(progressBar) {
            progressBar.value = 0;
        }

        if(log) {
            log.innerHTML = "";
        }

        this.validateImportSettings();
    }

    runImport() {
        let slot = this.shadowRoot.querySelector('slot');
        let elements = Array.from(slot.assignedElements())[0];
        let pathField = elements.querySelector('input[name="importFilePath"]');
        let typeField = elements.querySelector('select[name="fileType"]');
        let duplicateField = elements.querySelector('select[name="duplicateRecords"]');
        let report = new ImportReport();
    
        if(typeField.value === "bitwarden") {
            let formSection = elements.querySelector("#file_importer_form");
            let progressSection = elements.querySelector("#file_importer_progress");

            importBitwardenJSONFile(pathField.value, report)
                .then((records) => {
                    const settings  = {mode: this.stateManager.getValue("mode"),
                                       passwordHash: this.stateManager.getValue("passwordHash")};
                    const existingRecords = this.stateManager.getValue("records");
                    let api = new RecordAPI(settings, invoke);
                    let importer = new RecordImportExecutor(api, existingRecords, records, settings.passwordHash, report, (duplicateField.value === "ignore"));
    
                    importer.addProgressListener((event) => {
                        let progress = progressSection.querySelector("#file_importer_progress_bar");
    
                        if(progress) {
                            progress.value = event.detail.percentage;
                        }
                    });
    
                    report.addEventListener("log", (e) => this.handleImportLogEvent(e, elements));
                    importer.addCompletionListener((e) => this.handleImportCompletionEvent(e, elements));
    
                    formSection.classList.add("is-hidden");
                    progressSection.querySelector(".close-file-import").disabled = true;
                    progressSection.classList.remove("is-hidden");

    
                    importer.import();
                })
                .catch((error) => showError(`Failed to import the file. Cause: ${error}`));
        } else {
            showError("The import type requested is currently not supported.");
        }    
    }

    validateImportSettings() {
        let slot = this.shadowRoot.querySelector('slot');
        let elements = Array.from(slot.assignedElements())[0];
        let pathField = elements.querySelector('input[name="importFilePath"]');
        let importButton = elements.querySelector('.submit-file-import');

        if(pathField.value.trim() === "") {
            importButton.disabled = true;
            return(false);
        } else {
            importButton.disabled = false;
            return(true);
        }
    }
}

customElements.define('record-importer', RecordImporter);

export {
    RecordImporter
}
