const { invoke } = window.__TAURI__.core;
const { writeText } = window.__TAURI__.clipboardManager;
import { RecordListItem } from "./record-list-item.js";
import RecordAPI from "../record_api.js";
import { showError, showSuccess } from "../utilities.js";
import View from "./view.js";

const APPLICATION_VIEW_STYLES = `
<style>
.content {
    height: 100%;
    overflow: auto;
}

.list-container {
    height: 100vh;
}

.header {
    align-items: left;
    border-bottom: solid 1px #ccc;
    display: flex;
    gap: 10px;
    flex-flow: row nowrap;
    justify-content: flex-start;
    padding: 0 10px 0 20px;
}

.header-left {}

.header-right {
    align-items: center;
    display: flex;
    flex-flow: row-reverse nowrap;
    flex-grow: 1;
    justify-content: flex-start;
}

.header-toolbar {
    margin-right: 30px;
}

.is-hidden {
    display: none;
}

</style>
`;

const APPLICATION_VIEW_TEMPLATE = `
<div class="list-container">
    <header class="header">
        <div class="header-left">
            <h1 class="title is-3">Plauzible</h1>
        </div>

        <div class="header-right">
            <div class="header-toolbar">
                <slot name="header_toolbar"></slot>
            </div>
        </div>
    </header>

    <div class="content">
        <slot name="content"></slot>
    </div>

    <div>
        <slot name="modal"></slot>
    </div>

    <div class="is-hidden">
        <template id="list_table_row_template">
            <record-list-item></record-list-item>
        </template>
    </div>
</div>
`;

class ApplicationView extends View {
    constructor() {
        super();
        this.shadowRoot.innerHTML = `${APPLICATION_VIEW_STYLES} ${APPLICATION_VIEW_TEMPLATE}`;
    }

    /**
     * Invoked whenever the view is activated (i.e. shown).
     */
    activated(data={}) {
        const verticalList = this.shadowRoot.querySelector('slot[name="content"]').assignedNodes()[0];

        this.stateManager.startApplicationTimeOut();
        if(data.passwordHash) {
            this.stateManager.setValue("passwordHash", data.passwordHash);
        }

        this.loadSettingsIntoState()
            .then((settings) => {
                Object.keys(settings).forEach((key) => {
                    this.stateManager.setValue(key, settings[key]);
                });
            })
            .then(() => {
                return(this.reloadRecordList());
            });
            // .then((records) => {
            //     let list = this.shadowRoot.querySelector('slot[name="content"]').assignedNodes()[0];
            //     console.log("RECORDS:", records);
            //     this.stateManager.setValue("records", records);

            //     if(list) {
            //         let nodes = [];

            //         records.forEach((record) => {
            //             const template = this.shadowRoot.querySelector("#list_table_row_template");
            //             const node = new RecordListItem();

            //             node.record = record;
            //             node.addEventListener("menu.opened", (event) => this.handleMenuOpenEvent(event, node));
            //             nodes.push(node);
            //         });
            //         list.clearAllLineItems();
            //         list.addLineItems(nodes);
            //     }
            // });
    }

    /**
     * Invoked whenever the markup of the component is first added to the DOM.
     */
    connectedCallback() {
        let slot = this.shadowRoot.querySelector('slot');
        let elements = Array.from(slot.assignedElements());

        super.connectedCallback();
        this.addEventListener("toolbar.tool.activated", (event) => {
            this.handleToolbarEvent(event);
        });

        this.addEventListener("record.password.copy", (event) => this.handleCopyPasswordEvent(event));
        this.addEventListener("record.username.copy", (event) => this.handleCopyUserNameEvent(event));
        this.addEventListener("record.edit", (event) => this.handleEditRecordEvent(event));
        this.addEventListener("record.delete", (event) => this.handleDeleteRecordEvent(event));
        this.addEventListener("record.launch", (event) => this.handleLaunchRecordEvent(event));
        this.addEventListener("record.label.clicked", (event) => this.handleCopyPasswordEvent(event));

        this.setUpModalEventHandlers();
    }

    handleCopyPasswordEvent(event) {
        const record = this.stateManager.getValue("records").find((record) => `${record.id}` === event.detail.id);

        event.stopPropagation();
        this.stateManager.touchApplicationTimeOut();
        if(record) {
            const settings  = {mode: this.stateManager.getValue("mode"),
                               passwordHash: this.stateManager.getValue("passwordHash")};
            let api = new RecordAPI(settings, invoke);

            api.decrypt(record)
                .then((object) => {
                    return(writeText(object.password));
                })
                .then(() => {
                    showSuccess("Password copied to the clipboard.");
                })
                .catch((error) => {
                    console.error("Failed to copy password to the clipboard. Cause: ", error);
                    showError("Unexpected error occurred while copying password to the clipboard.");
                });
        }
        else {
            showError("Failed to copy password to the clipboard. Record not found.");
        }
    }

    handleCopyUserNameEvent(event) {
        const record = this.stateManager.getValue("records").find((record) => `${record.id}` === event.detail.id);

        event.stopPropagation();
        this.stateManager.touchApplicationTimeOut();
        if(record) {
            const settings  = {mode: this.stateManager.getValue("mode"),
                               passwordHash: this.stateManager.getValue("passwordHash")};
            let api = new RecordAPI(settings, invoke);

            api.decrypt(record)
                .then((object) => {
                    if(object.userName && object.userName.trim() !== "") {
                        return(writeText(object.userName));
                    } else {
                        showError("No user name found for this record.");
                    }
                })
                .then(() => {
                    showSuccess("User name copied to the clipboard.");
                })
                .catch((error) => {
                    console.error("Failed to copy user name to the clipboard. Cause: ", error);
                    showError("Unexpected error occurred while copying user name to the clipboard.");
                });
        }
        else {
            showError("Failed to copy user name to the clipboard. Record not found.");
        }
    }

    handleCreateRecord() {
        console.log("Creating record...");
        this.viewSwitcher.open("record_form", {action: "create"});
        this.stateManager.touchApplicationTimeOut();
    }

    handleDeleteRecordEvent(event) {
        const record = this.stateManager.getValue("records").find((record) => `${record.id}` === event.detail.id);

        event.stopPropagation();
        this.stateManager.touchApplicationTimeOut();
        if(record) {
            let modal = this.shadowRoot.querySelector('slot[name="modal"]').assignedNodes()[0];
            modal.querySelector("button.submit-button").dataset.recordId = record.id;
            modal.classList.add("is-active");
        }
        else {
            showError("Failed to delete record. Record not found.");
        }
    }

    handleEditRecordEvent(event) {
        const record = this.stateManager.getValue("records").find((record) => `${record.id}` === event.detail.id);

        event.stopPropagation();
        this.stateManager.touchApplicationTimeOut();
        if(record) {
            const settings  = {mode: this.stateManager.getValue("mode"),
                               passwordHash: this.stateManager.getValue("passwordHash")};
            let api = new RecordAPI(settings, invoke);

            api.decrypt(record)
                .then((object) => {
                    object.id = event.detail.id;
                    this.viewSwitcher.open("record_form", {action: "update", record: object});
                })
                .catch((error) => {
                    console.error("Failed to edit record. Cause: ", error);
                    showError("Unexpected error occurred while editing record.");
                });
        }
        else {
            showError("Failed to copy password to the clipboard. Record not found.");
        }
    }

    handleLaunchRecordEvent(event) {
        const record = this.stateManager.getValue("records").find((record) => `${record.id}` === event.detail.id);

        event.stopPropagation();
        this.stateManager.touchApplicationTimeOut();
        if(record) {
            const settings  = {mode: this.stateManager.getValue("mode"),
                               passwordHash: this.stateManager.getValue("passwordHash")};
            let api = new RecordAPI(settings, invoke);

            api.decrypt(record)
                .then((object) => {
                    return(invoke("open_url", {url: object.url}));
                })
                .catch((error) => {
                    console.error("Failed to open record URL. Cause: ", error);
                    showError("Unexpected error occurred while opening record URL.");
                });
        }
        else {
            showError("Failed to open record URL. Record not found.");
        }
    }

    handleMenuOpenEvent(event, node) {
        const verticalList = this.shadowRoot.querySelector('slot[name="content"]').assignedNodes()[0];
        const itemList = verticalList.getAllLineItems().filter((item) => item !== node);
        itemList.forEach((item) => {
            item.closeMenu();
        });
        this.stateManager.touchApplicationTimeOut();
    }

    handleOpenFilters() {
        console.log("Opening filters...");
    }

    handleImportFile() {
        console.log("Importing file...");
        this.stateManager.touchApplicationTimeOut();
        this.viewSwitcher.open("record_importer");
    }

    handleOpenSettings() {
        console.log("Opening settings...");
        this.stateManager.touchApplicationTimeOut();
        this.viewSwitcher.open("settings");
    }

    handleLogout() {
        console.log("Logging out...");
        this.viewSwitcher.reset();
    }

    handleToolbarEvent(event) {
        switch(event.detail.action) {
            case "records.create":
                this.handleCreateRecord();
                break;
            case "records.filters.open":
                this.handleOpenFilters();
                break;
            case "records.file.import":
                this.handleImportFile();
                break;
            case "settings.open":
                this.handleOpenSettings();
                break;
            case "session.logout":
                this.handleLogout();
                break;
            default:
                console.error("Unknown toolbar activation event received:", event.detail);
                break;
        }
    }

    loadSettingsIntoState() {
        return(invoke("get_standard_settings")
        .then((data) => {
            let object = JSON.parse(data);
            let settings = {};

            Object.keys(object).forEach((key) => {
                if(object[key].key === "password.length") {
                    settings.passwordLength = parseInt(object[key].value);
                } else if(object[key].key === "password.character_set") {
                    settings.passwordCharacterSet = object[key].value;
                } else if(object[key].key === "service.url") {
                    settings.serviceURL = object[key].value;
                } else if(object[key].key === "service.key") {
                    settings.mode = (object[key].value.trim() === ""  ? "local" : "remote");
                }
            });
            return(settings);
        }));
    }

    reloadRecordList() {
        let list = this.shadowRoot.querySelector('slot[name="content"]').assignedNodes()[0];

        if(list) {
            const settings  = {mode: this.stateManager.getValue("mode"),
                passwordHash: this.stateManager.getValue("passwordHash")};
            const recordAPI = new RecordAPI(settings, invoke);
            return(recordAPI.getAll()
                .then((records) => {
                    let nodes = [];

                    this.stateManager.setValue("records", records);
                    records.forEach((record) => {
                        const template = this.shadowRoot.querySelector("#list_table_row_template");
                        const node = new RecordListItem();

                        node.record = record;
                        node.addEventListener("menu.opened", (event) => this.handleMenuOpenEvent(event, node));
                        nodes.push(node);
                    });
                    list.clearAllLineItems();
                    list.addLineItems(nodes);
                }));

        }
    }

    setUpModalEventHandlers() {
        let modal = this.shadowRoot.querySelector('slot[name="modal"]').assignedNodes()[0];

        modal.querySelectorAll(".cancel-modal").forEach((node) => {
            node.addEventListener("click", (event) => modal.classList.remove("is-active"));
        });

        modal.querySelector("button.submit-button").addEventListener("click", (event) => {
            event.stopPropagation();
            this.stateManager.touchApplicationTimeOut();
            let recordId = parseInt(event.target.dataset.recordId);
            if(recordId && !isNaN(recordId)) {
                const settings  = {mode: this.stateManager.getValue("mode"),
                                   passwordHash: this.stateManager.getValue("passwordHash")};
                let api = new RecordAPI(settings, invoke);
                api.delete(recordId)
                    .then((id) => {
                        return(this.reloadRecordList()
                            .then(() => {
                                showSuccess("Record successfully deleted.");
                                modal.classList.remove("is-active");
                        }));
                    })
                    .catch((error) => {
                        console.error("Failed to delete record. Cause: ", error);
                        modal.classList.remove("is-active");
                        showError("Unexpected error occurred while deleting record.");
                    });
            }
        });
    }
}

customElements.define('application-view', ApplicationView);

export {
    ApplicationView
}
