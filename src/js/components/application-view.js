const { invoke } = window.__TAURI__.core;
const { writeText } = window.__TAURI__.clipboardManager;
import { RecordListItem } from "./record-list-item.js";
import RecordAPI from "../record_api.js";
import RecordFilter from "../utilities/record_filter.js";
import { showError, showSuccess, uniqueAndSortStringList } from "../utilities.js";
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
    margin-right: 25px;
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
            <dropdown-menu class="dropdown-menu" escapeCloses="true">
                <dropdown-menu-item event="filter.edit" label="Filter Records" slot="menuitem"></dropdown-menu-item>
                <dropdown-menu-item event="filter.clear" label="Clear Filter" slot="menuitem"></dropdown-menu-item>
                <dropdown-menu-item-separator slot="menuitem"></dropdown-menu-item-separator>
                <dropdown-menu-item event="record.file.import" label="Import Records" slot="menuitem"></dropdown-menu-item>
                <dropdown-menu-item event="settings.open" label="Settings" slot="menuitem"></dropdown-menu-item>
                <dropdown-menu-item-separator slot="menuitem"></dropdown-menu-item-separator>
                <dropdown-menu-item event="session.logout" label="Log Out" slot="menuitem"></dropdown-menu-item>
            </dropdown-menu>

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
    }

    /**
     * Invoked whenever the markup of the component is first added to the DOM.
     */
    connectedCallback() {
        let slot = this.shadowRoot.querySelector('slot');

        super.connectedCallback();
        this.addEventListener("toolbar.tool.activated", (event) => {
            this.handleToolbarEvent(event);
        });
        this.addEventListener("menu.item.selected", (event) => {
            this.handleMenuEvent(event);
        });

        this.addEventListener("record.password.copy", (event) => this.handleCopyPasswordEvent(event));
        this.addEventListener("record.username.copy", (event) => this.handleCopyUserNameEvent(event));
        this.addEventListener("record.edit", (event) => this.handleEditRecordEvent(event));
        this.addEventListener("record.delete", (event) => this.handleDeleteRecordEvent(event));
        this.addEventListener("record.launch", (event) => this.handleLaunchRecordEvent(event));
        this.addEventListener("record.label.clicked", (event) => this.handleCopyPasswordEvent(event));

        this.setUpModalEventHandlers();
        this.stateManager.setValue("recordFilter", new RecordFilter());
    }

    getRecordsFilter() {
        let filtersModal = this.shadowRoot.querySelector('slot[name="modal"]').assignedNodes()[1];
        let field = filtersModal.querySelector('input[name="nameFilter"]');
        let tagSelect = filtersModal.querySelector('multi-select-list');

        return(new RecordFilter(field.value.trim(), tagSelect.getSelectedEntries()));
    }

    getTagsList() {
        let list = [];

        this.stateManager.getValue("records").forEach((record) => {
            list.push(...record.tags);
        });
        list = uniqueAndSortStringList(list);

        return(list);
    }

    handleClearFilter() {
        this.stateManager.setValue("recordFilter", new RecordFilter());
        this.reloadRecordList();
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

    handleMenuEvent(event) {
        console.log("Menu event received:", event.detail);
        switch(event.detail.type) {
            case "filter.edit":
                this.handleOpenFilters();
                break;
            case "filter.clear":
                this.handleClearFilter();
                break;
            case "record.file.import":
                this.handleImportFile();
                break;
            case "settings.open":
                this.handleOpenSettings();
                break;
            case "session.logout":
                this.handleLogout();
                break;
            default:
                console.warn("Unknown menu event received:", event.detail);
                break;
        }
        this.stateManager.touchApplicationTimeOut();
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
        let modal = this.shadowRoot.querySelector('slot[name="modal"]').assignedNodes()[1];
        let tagsList = modal.querySelector(".multi-select-tag-list");

        tagsList.setListEntries(this.getTagsList());
        modal.classList.add("is-active");
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
            default:
                console.warn("Unknown toolbar activation event received:", event.detail);
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
        let recordFilter = this.stateManager.getValue("recordFilter");

        if(list) {
            const settings  = {mode: this.stateManager.getValue("mode"),
                passwordHash: this.stateManager.getValue("passwordHash")};
            const recordAPI = new RecordAPI(settings, invoke);
            return(recordAPI.getAll()
                .then((records) => {
                    let nodes = [];

                    this.stateManager.setValue("records", records);
                    records.filter(((e) => recordFilter.matches(e))).forEach((record) => {
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
        let deleteModal = this.shadowRoot.querySelector('slot[name="modal"]').assignedNodes()[0];
        let filtersModal = this.shadowRoot.querySelector('slot[name="modal"]').assignedNodes()[1];

        deleteModal.querySelectorAll(".cancel-modal").forEach((node) => {
            node.addEventListener("click", (event) => deleteModal.classList.remove("is-active"));
        });

        filtersModal.querySelectorAll(".cancel-modal").forEach((node) => {
            node.addEventListener("click", (event) => filtersModal.classList.remove("is-active"));
        });

        deleteModal.querySelector("button.submit-button").addEventListener("click", (event) => {
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
                                deleteModal.classList.remove("is-active");
                        }));
                    })
                    .catch((error) => {
                        console.error("Failed to delete record. Cause: ", error);
                        deleteModal.classList.remove("is-active");
                        showError("Unexpected error occurred while deleting record.");
                    });
            }
        });

        filtersModal.querySelector("button.submit-button").addEventListener("click", (event) => {
            let modal = this.shadowRoot.querySelector('slot[name="modal"]').assignedNodes()[1];
            let filter = this.getRecordsFilter();

            event.stopPropagation();
            this.stateManager.touchApplicationTimeOut();
            console.log("Filter Application Requested.");
            this.stateManager.setValue("recordFilter", filter);
            this.reloadRecordList();
            modal.classList.remove("is-active");
        });
    }
}

customElements.define('application-view', ApplicationView);

export {
    ApplicationView
}
