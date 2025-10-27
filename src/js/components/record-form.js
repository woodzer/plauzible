const { invoke } = window.__TAURI__.core;
const { writeText } = window.__TAURI__.clipboardManager;
const { open } = window.__TAURI__.dialog;
import View from "./view.js";
import RecordAPI from "../record_api.js";
import {
    CHARACTER_SETS,
    showError,
    showSuccess,
    uniqueAndSortStringList } from "../utilities.js";

const RECORD_FORM_STYLES = `
<style>
    .record-form {
        margin: 0 25px;
    }
</style>
`;

const RECORD_FORM_TEMPLATE = `
<div class="record-form">
    <slot name="form"></slot>
    <slot name="modal"></slot>
    <slot name="template"></slot>
</div>
`;

class RecordForm extends View {
    constructor() {
        super();
        this.shadowRoot.innerHTML = `${RECORD_FORM_STYLES} ${RECORD_FORM_TEMPLATE}`;
    }

    /**
     * Invoked whenever the view is activated (i.e. shown).
     */
    activated(data={}) {
        const action = data.action || "create";
        let formSlot = this.shadowRoot.querySelector('slot[name="form"]');
        let elements = Array.from(formSlot.assignedElements());
        let formElement = elements[0];

        console.log("Record form activated with data:", data);
        this.resetForm();
        if(action === "create") {
            this.querySelector(".create-title").classList.remove("is-hidden");
            this.querySelector(".update-title").classList.add("is-hidden");
            this.querySelector(".submit-record-create").classList.remove("is-hidden");
            this.querySelector(".submit-record-update").classList.add("is-hidden");
        } else {
            this.querySelector(".create-title").classList.add("is-hidden");
            this.querySelector(".update-title").classList.remove("is-hidden");
            this.querySelector(".submit-record-create").classList.add("is-hidden");
            this.querySelector(".submit-record-update").classList.remove("is-hidden");

            if(data.record) {
                let tags = "";

                if(data.record.tags) {
                    if(Array.isArray(data.record.tags)) {
                        tags = data.record.tags.join(", ");
                    } else {
                        tags = data.record.tags;
                    }
                }

                formElement.querySelector("input[name='id']").value = data.record.id;
                formElement.querySelector("input[name='name']").value = data.record.name;
                formElement.querySelector("input[name='userName']").value = data.record.userName;
                formElement.querySelector("input[name='password']").value = data.record.password;
                formElement.querySelector("input[name='url']").value = data.record.url;
                formElement.querySelector('input[name="tags"]').value = tags;
            } else {
                showError("No record provided to populate the form.");
            }
        }

        setTimeout(() => {
            formElement.querySelector("input[name='name']").focus();
        }, 300);
    }

    addTagToTagList(template, tagList, tag, checked=false) {
        let entry = template.content.cloneNode(true);
        let checkbox = entry.querySelector(".tag-checkbox");

        entry.querySelector(".tag-label").innerText = tag.trim();
        checkbox.setAttribute("value", tag.trim());
        checkbox.checked = checked;
        tagList.insertBefore(entry, tagList.firstChild);
    }

    /**
     * Hides all showing form error messages.
     */
    clearAllFormErrors(formElement) {
        formElement.querySelectorAll(".field .help").forEach((element) => element.classList.add("is-hidden"));
    }

    /**
     * Hides the error message for a given field.
     */
    clearFieldError(field) {
        let help = field.closest(".field-container").querySelector(".help");
        if(help) {
            help.classList.add("is-hidden");
        }
    }

    /**
     * Invoked whenever the markup of the component is first added to the DOM.
     */
    connectedCallback() {
        let slots = Array.from(this.shadowRoot.querySelectorAll('slot'));
        let formElement = this.shadowRoot.querySelector('slot[name="form"]').assignedElements()[0];
        let modalElements = Array.from(this.shadowRoot.querySelector('slot[name="modal"]').assignedElements());
        let templateElements = Array.from(this.shadowRoot.querySelector('slot[name="template"]').assignedElements());

        super.connectedCallback();
        this.setUpFormEventHandlers(formElement, modalElements, templateElements);
        this.setUpModalEventHandlers(formElement, modalElements, templateElements);
    }

    generatePassword(event, modal) {
        event.preventDefault();
        this.stateManager.touchApplicationTimeOut();
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

    /**
     * Returns an object containing the data from the form.
     */
    getFormData() {
        let slots = Array.from(this.shadowRoot.querySelectorAll('slot'));
        let formElement = slots[0].assignedElements()[0];
        let data = {};

        formElement.querySelectorAll('input').forEach((input) => {
            data[input.name] = input.value;
        });
        formElement.querySelectorAll('textarea').forEach((textarea) => {
            data[textarea.name] = textarea.value;
        });

        if(data.tags) {
            data.tags = data.tags.split(", ").map((tag) => tag.trim());
        }

        return(data);
    }

    /**
     * Resets the form to its initial empty state and hides all showing form error messages.
     */
    resetForm() {
        let slots= Array.from(this.shadowRoot.querySelectorAll('slot'));
        let formElement = slots[0].assignedElements()[0];

        formElement.querySelectorAll('input').forEach((input) => {
            input.value = "";
        });
        formElement.querySelectorAll('textarea').forEach((textarea) => {
            textarea.value = "";
        });
        this.clearAllFormErrors(formElement);
    }

    /**
     * Sets up event handlers for the form elements.
     */
    setUpFormEventHandlers(formElement, modals, templateElements) {
        let createSubmitButton = formElement.querySelector(".submit-record-create");
        let updateSubmitButton = formElement.querySelector(".submit-record-update");

        formElement.querySelectorAll(".cancel-record-form").forEach((element) => {
            element.addEventListener("click", (event) => {
                this.viewSwitcher.close();
            });
        });

        formElement.querySelectorAll('input[validated]').forEach((input) => {
            switch(input.name) {
                case "name":
                    input.addEventListener("input", (e) => {
                        let recordIdField = formElement.querySelector('input[name="id"]');
                        let ignoredId = recordIdField ? parseInt(recordIdField.value) : null;
                        this.validateNameField(formElement, ignoredId);
                    });
                    break;

                case "password":
                    input.addEventListener("input", (e) => this.validatePasswordField(formElement));
                    break;

                case "url":
                    input.addEventListener("input", (e) => this.validateURLField(formElement));
                    break;
            }
        });

        formElement.querySelector("button.copy-user-name").addEventListener("click", (event) => {
            let userNameField = formElement.querySelector('input[name="userName"]');

            event.preventDefault();
            if(userNameField && userNameField.value.trim() !== "") {
                writeText(userNameField.value);
                showSuccess("User name copied to clipboard.");
            }
        });

        formElement.querySelector("button.copy-password").addEventListener("click", (event) => {
            let passwordField = formElement.querySelector('input[name="password"]');

            event.preventDefault();
            if(passwordField && passwordField.value.trim() !== "") {
                writeText(passwordField.value);
                showSuccess("Password copied to clipboard.");
            }
        });

        formElement.querySelector("button.open-url-link").addEventListener("click", (event) => {
            let urlField = formElement.querySelector('input[name="url"]');
            event.preventDefault();
            if(urlField && urlField.value.trim() !== "" && urlField.checkValidity()) {
                invoke("open_url", {url: urlField.value})
            }
        });

        formElement.querySelector('input[name="tags"]').addEventListener("click", (event) => {
            event.preventDefault();
            this.showTagsModal(modals[1], templateElements[0]);
        });

        formElement.querySelector(".open-password-generator").addEventListener("click", (event) => {
            event.preventDefault();
            this.showPasswordGeneratorModal(modals[0]);
        });

        createSubmitButton.addEventListener("click", (event) => {
            if(this.validateFormContents(formElement)) {
                let data = this.getFormData();
                const settings  = {mode: this.stateManager.getValue("mode"),
                                   passwordHash: this.stateManager.getValue("passwordHash")};
                const recordAPI = new RecordAPI(settings, invoke);

                recordAPI.create(data)
                    .then((record) => {
                        this.viewSwitcher.close();
                        showSuccess("Record successfully created.");
                    })
                    .catch((error) => {
                        console.error("Failed to create record. Cause: ", error);
                        showError("Unexpected error occurred while creating record.");
                    });
            }
        });

        updateSubmitButton.addEventListener("click", (event) => {
            let recordIdField = formElement.querySelector('input[name="id"]');
            const recordId = parseInt(recordIdField.value);

            if(isNaN(recordId)) {
                showError("Record ID is not a valid number.");
                return;
            }

            if(this.validateFormContents(formElement, recordId)) {
                let formData = this.getFormData();
                const settings  = {mode: this.stateManager.getValue("mode"),
                                   passwordHash: this.stateManager.getValue("passwordHash")};
                const recordAPI = new RecordAPI(settings, invoke);
                let record = this.stateManager.getValue("records").find((record) => record.id === recordId);

                if(!record) {
                    showError("Record not found.");
                    return;
                }

                recordAPI.update(recordId, record, formData)
                    .then((listRecord) => {
                        this.viewSwitcher.close();
                        showSuccess("Record successfully updated.");
                    })
                    .catch((error) => {
                        console.error("Failed to update record. Cause: ", error);
                        showError("Unexpected error occurred while updating record.");
                    });
            }
        });
    }

    /**
     * Sets up event handlers for the modal elements.
     */
    setUpModalEventHandlers(formElement, modalElements, templateElements) {
        modalElements.forEach((modal) => {
            modal.querySelectorAll(".cancel-modal").forEach((e) => e.addEventListener("click", (event) => modal.classList.remove("is-active")));
        });

        this.setUpPasswordGeneratorModalEventHandlers(modalElements[0], formElement);
        this.setUpTagsModalEventHandlers(modalElements[1], formElement, templateElements[0]);
    }

    /**
     * Sets up the event handlers for the password generator modal.
     */
    setUpPasswordGeneratorModalEventHandlers(modal, formElement) {
        modal.querySelector(".generate-password-button").addEventListener("click", (event) => this.generatePassword(event, modal));  
        modal.querySelector(".submit-button").addEventListener("click", (event) => {
            let field = formElement.querySelector('input[name="password"]');
            let generatedPasswordField = modal.querySelector('input[name="generatedPassword"]');

            event.preventDefault();
            this.stateManager.touchApplicationTimeOut();
            if(generatedPasswordField && generatedPasswordField.value.trim() !== "") {
                field.value = modal.querySelector('input[name="generatedPassword"]').value;
                modal.classList.remove("is-active");
                this.validatePasswordField(formElement);
            }
        });
    }

    /**
     * Sets up the event handlers for the tags modal.
     */
    setUpTagsModalEventHandlers(modal, formElement, template) {
        let addButton = modal.querySelector("button.add-tag");
        let submitButton = modal.querySelector("button.submit-button");

        addButton.addEventListener("click", (event) => {
            let newTagField = modal.querySelector('input[name="newTag"]');

            if(newTagField.value.trim().length > 0) {
                let tagList = modal.querySelector(".tag-selector-list");

                if(tagList) {
                    this.addTagToTagList(template, tagList, newTagField.value.trim(), true);
                    newTagField.value = "";
                    newTagField.focus();
                }
            }
        });

        submitButton.addEventListener("click", (event) => {
            let tagList = modal.querySelector(".tag-selector-list");
            let selectedTags = Array.from(tagList.querySelectorAll(".tag-checkbox:checked")).map((checkbox) => checkbox.value);
            let formField = formElement.querySelector('input[name="tags"]');

            formField.value = selectedTags.join(", ");
            modal.classList.remove("is-active");
        });
    }

    /**
     * Shows the error message for a given field.
     */
    showFieldHelp(element) {
        let field = element.closest(".field-container");

        if(field) {
            let help = field.querySelector(".help");
            if(help) {
                help.classList.remove("is-hidden");
            }
        }    
    }

    /**
     * Initializes and shows the password generator modal.
     */
    showPasswordGeneratorModal(modal) {
        if(modal) {
            let passwordLengthField = modal.querySelector('input[name="passwordLength"]');
            let characterSetField = modal.querySelector('select[name="characterSet"]');

            passwordLengthField.value = `${this.stateManager.getValue("passwordLength")}`;
            characterSetField.value = this.stateManager.getValue("passwordCharacterSet");
            modal.querySelector('input[name="generatedPassword"]').value = "";
            modal.querySelector("button.submit-button").disabled = true;
            
            modal.classList.add("is-active");
        }
    }

    /**
     * Initializes and shows the tags modal.
     */
    showTagsModal(modal, template) {
        if(modal) {
            let records = this.stateManager.getValue("records", []);
            let tagList = modal.querySelector(".tag-selector-list");
            let selectedTags = uniqueAndSortStringList(records.map((record) => record.tags).flat()).sort().reverse();

            tagList.innerHTML = "";
            selectedTags.forEach((tag) => {
                this.addTagToTagList(template, tagList, tag, false);
            });

            modal.classList.add("is-active");
        }
    }

    /**
     * Validates the contents of the form.
     */
    validateFormContents(formElement, ignoredId=null) {
        this.clearAllFormErrors(formElement);
        return(this.validateNameField(formElement, ignoredId) &&
               this.validatePasswordField(formElement) &&
               this.validateURLField(formElement));
    }

    /**
     * Validates the contents of the name field.
     */
    validateNameField(formElement, ignoreId=null) {
        let field = formElement.querySelector('input[name="name"]');
        let valid = false;

        this.clearFieldError(field);
        if(field) {
            let value = field.value.trim();
            if(value === "") {
                valid = false;
            } else {
                let records = this.stateManager.getValue("records", []);
                valid = !records.some((entry) => entry.name === value && `${entry.id}` !== `${ignoreId}`);
            }

            if(!valid) {
                this.showFieldHelp(field);
            }
        }

        return(valid);
    }

    /**
     * Validates the contents of the password field.
     */
    validatePasswordField(formElement) {
        let field = formElement.querySelector('input[name="password"]');
        let valid = (field && field.value.trim() !== "");

        this.clearFieldError(field);
        if(!valid) {
            this.showFieldHelp(field);
        }

        return(valid);
    }

    /**
     * Validates the contents of the URL field.
     */
    validateURLField(formElement) {
        let field = formElement.querySelector('input[name="url"]');
        let valid = field.value.trim() !== "" || (field && field.checkValidity());

        this.clearFieldError(field);
        if(!valid) {
            this.showFieldHelp(field);
        }

        return(valid);
    }
}

customElements.define('record-form', RecordForm);

export {
    RecordForm
}