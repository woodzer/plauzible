const { invoke } = window.__TAURI__.core;
import { showError, showSuccess } from "../utilities.js";
import View from "./view.js";
import { MINIMUM_PASSWORD_LENGTH } from "../utilities.js";

const SETTINGS_VIEW_STYLES = `
<style>
.settings-view-container {
    height: 100vh;
    overflow: auto;
}
</style>
`;

const SETTINGS_VIEW_TEMPLATE = `
<div class="settings-view-container">
    <slot name="content"></slot>
</div>
`;

class SettingsView extends View {
    constructor() {
        super();
        this.shadowRoot.innerHTML = `${SETTINGS_VIEW_STYLES} ${SETTINGS_VIEW_TEMPLATE}`;
    }

    /**
     * Invoked whenever the view is activated (i.e. shown).
     */
    activated(data={}) {
        let viewSlot = this.shadowRoot.querySelector("slot");
        let elements = Array.from(viewSlot.assignedElements());
        let content = elements[0];
        let settingsPanel = content.querySelector(".settings-panel");
        let loadingSection = content.querySelector(".loading-section");

        settingsPanel.classList.add("is-hidden");
        loadingSection.classList.remove("is-hidden");
        this.loadSettings();
    }

    /**
     * Invoked whenever the markup of the component is first added to the DOM.
     */
    connectedCallback() {
        let slot = this.shadowRoot.querySelector('slot');
        let elements = Array.from(slot.assignedElements());

        super.connectedCallback();
        if(elements.length > 0) {
            let settingsContainer = elements[0];

            this.setUpEventHandlers(settingsContainer);
        }
    }

    hideSensitiveSettings(container, event) {
        let hiddenSection = container.querySelector("#encryption_settings_details");
        let valueField = container.querySelector('input[name="encryptionSettings"]');
        let revealSettingsSection = container.querySelector("#encryption_settings_reveal");
        let revealSettingsButton = container.querySelector("button.reveal-settings");

        valueField.value = "";
        hiddenSection.classList.add("is-hidden");
        revealSettingsButton.classList.remove("is-hidden");
        revealSettingsSection.classList.remove("is-hidden");
    }

    loadSettings() {
        invoke("get_standard_settings")
        .then((json) => {
            let records = JSON.parse(json);

            records.forEach((record) => {
                this.stateManager.setValue(record.key, record.value);
            });

            this.populateSettings(records);
            this.showSettings();
        })
        .catch((error) => showError(`Failed to load setting values. Cause: ${error}`));
    }

    populateSettings(records) {
        let viewSlot = this.shadowRoot.querySelector("slot");
        let content = Array.from(viewSlot.assignedElements())[0];
        let settingsPanel = content.querySelector(".settings-panel");
        let field = settingsPanel.querySelector('input[name="serviceKey"]');
        let record = records.find((r) => r.key === "service.key");
        let serviceURLSet = false;
        let serviceKeySet = false;
    
        if(field && record) {
            let subscriptionButton = settingsPanel.querySelector("button.create-subscription");
            let unsubscribeButton = settingsPanel.querySelector("button.end-subscription");

            field.value = record.value;
            serviceKeySet = (`${record.value}`.trim() !== "");

            if(record.value.trim() !== "") {
                subscriptionButton.classList.add("is-hidden");
                unsubscribeButton.classList.remove("is-hidden");
            } else {
                subscriptionButton.classList.remove("is-hidden");
                unsubscribeButton.classList.add("is-hidden");
            }
        }
    
        field = settingsPanel.querySelector('input[name="serviceURL"]');
        record = records.find((r) => r.key === "service.url");
        if(field && record) {
            field.value = record.value;
            serviceURLSet = (`${record.value}`.trim() !== "");
        }
    
        let button = settingsPanel.querySelector("button.update-encryption-settings")
        button.disabled = true;
    
        field = settingsPanel.querySelector('input[name="passwordLength"]');
        record = records.find((r) => r.key === "password.length");
        if(field && record) {
            field.value = parseInt(record.value);
        }
    
        field = settingsPanel.querySelector('select[name="defaultCharacterSet"]');
        record = records.find((r) => r.key === "password.character_set");
        if(field && record) {
            field.value = record.value;
        }
    
        if(!serviceKeySet && !serviceURLSet) {
            settingsPanel.querySelector("button.create-subscription").disabled = false;
        }    
    }

    showSensitiveSettings(container, event) {
        let button = event.target;
        let hiddenSection = container.querySelector("#encryption_settings_details");

        event.preventDefault();
        invoke("get_sensitive_settings")
            .then((json) => {
                let records = JSON.parse(json);
                let field = container.querySelector('input[name="encryptionSettings"]');
    
                let salt = records.find((e) => e.key === "encryption.salt").value;
                let nonce = records.find((e) => e.key === "encryption.nonce").value;
                field.value = `${salt}:${nonce}`;
    
                button.parentNode.classList.add("is-hidden");
                hiddenSection.classList.remove("is-hidden");
            })
            .catch((error) => showError(`Failed to load sensitive setting values, Cause: ${error}`));    
    }
    

    setUpEventHandlers(container) {
        let closeButton = container.querySelector(".close-view-button");
        if(closeButton) {
            closeButton.addEventListener("click", (event) => {
                event.preventDefault();
                this.dispatchEvent(new CustomEvent("view.close", {bubbles: true}));
            });
        }

        this.setUpRemoteServiceSettingsEventHandlers(container);
        this.setUpPasswordGeneratorSettingsEventHandlers(container);
        this.setUpEncryptionSettingsEventHandlers(container);
    }

    setUpRemoteServiceSettingsEventHandlers(container) {
        let subscribeButton = container.querySelector("button.create-subscription");
        let unsubscribeButton = container.querySelector("button.end-subscription");
        let updateButton = container.querySelector("button.update-service-settings");

        subscribeButton.addEventListener("click", (event) => {
            return(invoke("open_url", {url: "https://plauzible.com/checkout"}));
        });

        unsubscribeButton.addEventListener("click", (event) => {
            let key = this.stateManager.getValue("service.key");
            return(invoke("open_url", {url: `https://plauzible.com/unsubscribe?key=${key}`}));
        });

        updateButton.addEventListener("click", (event) => {
            this.updateRemoteServiceSettings(container, event);
        });
    }

    setUpPasswordGeneratorSettingsEventHandlers(container) {
        let button = container.querySelector("button.update-password-generator-settings");
        let lengthField = container.querySelector('input[name="passwordLength"]');

        if(button) {
            button.addEventListener("click", (event) => {
                this.updatePasswordGeneratorSettings(container, event);
            });
        }

        if(lengthField) {
            lengthField.addEventListener("input", (event) => {
                let value = parseInt(lengthField.value);

                button.disabled = (lengthField.value.trim() === "" ||
                                   isNaN(value) ||
                                   value < MINIMUM_PASSWORD_LENGTH);
            });
        }
    }

    setUpEncryptionSettingsEventHandlers(container) {
        let revealSettingsButton = container.querySelector("button.reveal-settings");
        let hideSettingsButton = container.querySelector("button.hide-settings");
        let updateButton = container.querySelector("button.update-encryption-settings");
        let valueField = container.querySelector('input[name="encryptionSettings"]');

        if(hideSettingsButton) {
            hideSettingsButton.addEventListener("click", (event) => {
                this.hideSensitiveSettings(container, event);
            });
        }


        if(revealSettingsButton) {
            revealSettingsButton.addEventListener("click", (event) => {
                this.showSensitiveSettings(container, event);
            });
        }

        if(updateButton && valueField) {
            valueField.addEventListener("input", (event) => {
                updateButton.disabled = (valueField.value.trim() === "");
            });
            updateButton.addEventListener("click", (event) => {
                this.updateEncryptionSettings(container, event);
            });
        }
    }

    showSettings() {
        let viewSlot = this.shadowRoot.querySelector("slot");
        let content = Array.from(viewSlot.assignedElements())[0];
        let settingsPanel = content.querySelector(".settings-panel");
        let loadingSection = content.querySelector(".loading-section");

        loadingSection.classList.add("is-hidden");
        settingsPanel.classList.remove("is-hidden");
    }

    updateEncryptionSettings(container, event) {
        let field = container.querySelector('input[name="encryptionSettings"]');
        let button = event.target;
    
        event.preventDefault();
        if(this.validateEncryptionSettings(field.value)) {
            invoke("update_sensitive_settings", {
                encryptionSettings: field.value
            })
            .then(() => {
                this.hideSensitiveSettings(container, event);
                button.disabled = true;
                showSuccess("Encryption settings successfully updated.");
            })
            .catch((error) => showError(`Failed to update encryption settings. Cause: ${error}`));
        }    
    }

    updatePasswordGeneratorSettings(container, event) {
        let section = container.querySelector("section.password-generator-settings");

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

    updateRemoteServiceSettings(container, event) {
        let section = container.querySelector("section.remote-service-settings");

        event.preventDefault();
        if(section) {
            let serviceKeyField = section.querySelector('input[name="serviceKey"]');
            let serviceURLField = section.querySelector('input[name="serviceURL"]');
    
            invoke("update_remote_service_settings", {
                serviceKey: serviceKeyField.value,
                serviceUrl: serviceURLField.value
            })
            .then(() => {
                this.stateManager.setValue("service.key", serviceKeyField.value);
                this.stateManager.setValue("service.url", serviceURLField.value);
                this.updateSubscriptionButtons(container);
                showSuccess("Remote service settings successfully updated.");
            })
            .catch((error) => {
                console.error(`Failed to update remote service settings. Cause: ${error}`);
                showError(`Failed to update remote service settings. Cause: ${error}`);
            });
        }    
    }

    updateSubscriptionButtons(container) {
        let subscriptionButtons = Array.from(container.querySelectorAll("button.create-subscription, button.end-subscription"));

        if(this.stateManager.getValue("service.key", "") === "") {
            subscriptionButtons[0].classList.remove("is-hidden");
            subscriptionButtons[1].classList.add("is-hidden");
        } else {
            subscriptionButtons[0].classList.add("is-hidden");
            subscriptionButtons[1].classList.remove("is-hidden");
        }
    }

    validateEncryptionSettings(value) {
        let valid = true;
        if(value.indexOf(":") === -1) {
            showError("Your encryption settings are not valid.");
            valid = false;
        }
        return valid;    
    }
}

customElements.define('settings-view', SettingsView);

export {
    SettingsView
}
