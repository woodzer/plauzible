const { invoke } = window.__TAURI__.core;
import View from "./view.js";
import { MINIMUM_PASSWORD_LENGTH } from "../utilities.js";

const VIEW_SWITCHER_STYLES = `
<style>
</style>
`;

const VIEW_SWITCHER_TEMPLATE = `
<div class="log-in-view">
    <slot name="content"></slot>
</div>
`;

class LogInView extends View {
    constructor() {
        super();
        this.shadowRoot.innerHTML = `${VIEW_SWITCHER_STYLES} ${VIEW_SWITCHER_TEMPLATE}`;
    }

    /**
     * Invoked whenever the view is activated (i.e. shown).
     */
    activated(data={}) {
        this.resetView();
        this.loadApplicationSettings();
        setTimeout(() => {
            let slot = this.shadowRoot.querySelector('slot');
            let elements = Array.from(slot.assignedElements());
            let passwordField = elements[0].querySelector('input[name="sessionPassword"]'); 
            if(passwordField) {
                passwordField.focus();
            }
        }, 300);
    }

    /**
     * Invoked whenever the markup of the component is first added to the DOM.
     */
    connectedCallback() {
        let slot = this.shadowRoot.querySelector('slot');
        let elements = Array.from(slot.assignedElements());

        super.connectedCallback();
        if(elements.length > 0) {
            let baseElement = elements[0];
            let passwordField = baseElement.querySelector('input[name="sessionPassword"]');
            let submitButton = baseElement.querySelector('#submit_password_button');
            let settingsButton = baseElement.querySelector('.settings-button');
            let termsOfServiceModal = baseElement.querySelector('.terms-of-service-modal');

            if(passwordField) {
                passwordField.addEventListener("input", (event) => {
                    submitButton.disabled = !this.verifySubmittedPassword();
                });
                passwordField.addEventListener("keypress", (event) => {
                    const keyCode = event.code || event.key;
                    if(keyCode === 'Enter') {
                        this.onPasswordSubmission(event);
                    }
                });

                setTimeout(() => passwordField.focus(), 300);
            }

            if(submitButton) {
                submitButton.disabled = !this.verifySubmittedPassword();
                submitButton.addEventListener("click", (event) => {
                    this.onPasswordSubmission(event);
                });
            }

            if(termsOfServiceModal) {
                let checkbox = termsOfServiceModal.querySelector('input[name="termsAccepted"]');
                let acceptButton = termsOfServiceModal.querySelector('button.submit-button');
                let cancelButtons = termsOfServiceModal.querySelectorAll('.cancel-modal');

                checkbox.addEventListener("change", (event) => {
                    acceptButton.disabled = !checkbox.checked;
                });
                cancelButtons.forEach((button) => termsOfServiceModal.classList.remove("is-active"));
                acceptButton.addEventListener("click", (event) => {
                    event.stopPropagation();
                    invoke("terms_accepted")
                        .then((result) => {
                            this.stateManager.setValue("termsAccepted", "true");
                            termsOfServiceModal.classList.remove("is-active");
                            acceptButton.dispatchEvent(new CustomEvent("terms.accepted", {bubbles: true}));
                        })
                        .catch((error) => {
                            console.warn(`Failed to accept terms of service. Cause: ${error}`);
                            acceptButton.dispatchEvent(new CustomEvent("terms.accepted", {bubbles: true}));
                        });
                });
            }

            if(settingsButton) {
                settingsButton.addEventListener("click", (event) => {
                    event.preventDefault();
                    this.dispatchEvent(new CustomEvent("view.open", {bubbles: true, detail: {viewName: "settings"}}));
                });
            }

            this.resetView();
        }

        this.addEventListener("terms.accepted", (event) => {
            console.log("Terms of service accepted.");
            this.submitPassword(event);
        });
    }

    get enteredPassword() {
        let slot = this.shadowRoot.querySelector('slot');
        let elements = Array.from(slot.assignedElements());
        let passwordField = elements[0].querySelector('input[name="sessionPassword"]');

        return(passwordField ? passwordField.value.trim() : "");
    }

    get minimumPasswordLength() {
        return(this.hasStateManager ? this.stateManager.getValue("minimumPasswordLength", MINIMUM_PASSWORD_LENGTH) : MINIMUM_PASSWORD_LENGTH);
    }

    
    /**
     * 
     * Loads the application settings from the database and places them into the state manager.
     */
    loadApplicationSettings() {
        return(invoke("get_application_settings")
            .then((data) => {
                let object = JSON.parse(data);
                this.stateManager.setValue("operationMode", object.operationMode);
                this.stateManager.setValue("serviceURL", object.serviceURL);
                this.stateManager.setValue("termsAccepted", object.termsAccepted);
                this.stateManager.setValue("termsRemoted", object.termsRemoted);
                return(object);
            }));
    }


    /**
     * Invoked when the password submission button is clicked or the enter key is pressed.
     */
    onPasswordSubmission(event) {
        event.preventDefault();
        this.stateManager.touchApplicationTimeOut();
        if(this.verifySubmittedPassword()) {
            this.verifyTermsAcceptance();
        }
    }

    requestTermsAcceptance() {
        let elements = this.shadowRoot.querySelector('slot').assignedElements();
        let termsOfServiceModal = elements[0].querySelector('.terms-of-service-modal');


        if(termsOfServiceModal) {
            termsOfServiceModal.classList.add("is-active");
        } else {
            console.error("Terms of service modal not found.");
        }
    }

    resetView() {
        let slot = this.shadowRoot.querySelector('slot');
        let elements = Array.from(slot.assignedElements());

        if(elements.length > 0) {
            let baseElement = elements[0];
            let passwordField = baseElement.querySelector('input[name="sessionPassword"]');
            let submitButton = baseElement.querySelector('#submit_password_button');

            if(passwordField) {
                passwordField.value = "";
            }

            if(submitButton) {
                submitButton.disabled = true;
            }
        }
    }

    submitPassword() {
        console.log("Submitting password.");
        let passwordValue = this.enteredPassword;

        this.stateManager.touchApplicationTimeOut();
        invoke("hash_password", {password: passwordValue})
            .then((hash) => {
                this.stateManager.setValue("passwordHash", hash);
                this.resetView();
                this.viewSwitcher.open("application", {passwordHash: hash});
                // this.dispatchEvent(new CustomEvent("view.switch", {bubbles: true, detail: {viewName: "application"}}));
            });
    }

    verifySubmittedPassword() {
        return(this.enteredPassword.length >= this.minimumPasswordLength);
    }

    verifyTermsAcceptance() {
        if(this.hasStateManager) {
            let termsAccepted = this.stateManager.getValue("termsAccepted", "false");

            if(termsAccepted === "false") {
                this.requestTermsAcceptance();
            } else {
                this.submitPassword();
            }
        }
    }

}

customElements.define('log-in-view', LogInView);

export {
    LogInView
}
