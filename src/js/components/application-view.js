const { invoke } = window.__TAURI__.core;
const { getCurrentWindow } = window.__TAURI__.window;
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

.header-left {
    flex-grow: 1;
    justify-content: flex-start;
}

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
<link rel="stylesheet" href="/css/bulma-1.0.4.min.css" />
<div class="list-container">
    <header class="header">
        <div class="header-left">
            <div class="content">
                <div class="field has-addons mt-4">
                    <div class="control is-expanded">
                        <input class="input" name="recordNameFilter" type="text" placeholder="Filter by name">
                    </div>

                    <div class="control">
                        <button class="button" id="open_filter_button">
                            <span class="icon">
                                <svg id="svg" fill="#000000" stroke="#000000" width="200px" height="200px" version="1.1" viewBox="144 144 512 512" xmlns="http://www.w3.org/2000/svg">
                                    <g id="IconSvg_bgCarrier" stroke-width="0"></g>
                                    <g id="IconSvg_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" stroke="#CCCCCC"></g>
                                    <g id="IconSvg_iconCarrier">
                                        <path xmlns="http://www.w3.org/2000/svg" d="m349.96 635.04c1.8906 0.75391 3.8555 1.1172 5.8242 1.1172 4.25 0 8.4062-1.7148 11.445-4.9297l88.434-93.488c2.7695-2.9297 4.2969-6.8008 4.2969-10.832v-151.3l166.07-185.53c4.1406-4.6289 5.1797-11.258 2.6445-16.926-2.5352-5.6641-8.1562-9.3203-14.375-9.3203h-428.61c-6.2188 0-11.84 3.6406-14.375 9.3242-2.5352 5.668-1.4961 12.297 2.6445 16.926l166.08 185.53 0.003906 244.8c-0.015625 6.4414 3.918 12.234 9.918 14.629zm-129.05-439.72h358.18l-146.61 163.77c-2.582 2.8984-4.0156 6.6289-4.0156 10.5v151.05l-56.945 60.207v-211.25c0-3.8711-1.4336-7.6055-4.0156-10.5z"></path>
                                    </g>
                                </svg>
                            </span>
                        </button>
                    </div>

                    <div class="control">
                        <button class="button" id="clear_filter_button">
                            <span class="icon">
                                <svg id="svg" fill="#000000" stroke="#000000" width="24px" height="24px" version="1.1" viewBox="144 144 512 512" xmlns="http://www.w3.org/2000/svg">
                                    <g id="IconSvg_bgCarrier" stroke-width="0"></g>
                                    <g id="IconSvg_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" stroke="#CCCCCC"></g>
                                    <g id="IconSvg_iconCarrier">
                                        <defs xmlns="http://www.w3.org/2000/svg">
                                            <clipPath id="a">
                                                <path d="m148.09 148.09h502.91v502.91h-502.91z"></path>
                                            </clipPath>
                                        </defs>
                                    <g xmlns="http://www.w3.org/2000/svg" clip-path="url(#a)">
                                        <path d="m399.46 148.09c-138.68 0-251.36 112.68-251.36 251.36 0 138.68 112.68 251.36 251.36 251.36 138.68 0 251.36-112.68 251.36-251.36 1.082-138.68-111.6-251.36-251.36-251.36zm0 460.47c-114.85 0-208.02-93.18-208.02-209.11 0-115.93 93.176-208.02 208.02-208.02 114.85 0 208.02 93.176 208.02 208.02 1.0859 115.93-92.094 209.11-208.02 209.11zm81.258-258.95-49.84 49.84 49.84 49.84-30.336 30.336-49.84-49.84-49.84 49.84-30.336-30.336 49.84-49.84-49.84-49.84 30.336-30.336 49.84 49.84 49.84-49.84z"></path>
                                    </g>

                                    </g>
                                </svg>
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="header-right">
            <dropdown-menu class="app-dropdown-menu" escapeCloses="true">
                <dropdown-menu-item event="record.file.import" label="Import Records" slot="menuitem"></dropdown-menu-item>
                <dropdown-menu-item event="settings.open" label="Settings" slot="menuitem"></dropdown-menu-item>
                <dropdown-menu-item-separator slot="menuitem"></dropdown-menu-item-separator>
                <dropdown-menu-item event="session.logout" label="Log Out" slot="menuitem"></dropdown-menu-item>
                <dropdown-menu-item event="application.exit" label="Exit" slot="menuitem"></dropdown-menu-item>
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

        this.handleClearFilter();
        this.stateManager.startApplicationTimeOut();
        this.stateManager.setValue("recordFilter", new RecordFilter());
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
     * Triggers the closing of all menus and modals.
     */
    closeAllMenusAndModals() {
        let modals = document.querySelectorAll('.modal');
        let keySettings = {bubbles: true, cancelable: true, code: "Escape", composed: true, key: "Escape"};

        modals.forEach((modal) => {
            modal.classList.remove('is-active');
        });
        document.dispatchEvent(new KeyboardEvent("keypress", keySettings));
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
        this.addEventListener("filter.changed", (event) => this.handleFilterChangedEvent(event));

        this.addEventListener("record.password.copy", (event) => this.handleCopyPasswordEvent(event));
        this.addEventListener("record.username.copy", (event) => this.handleCopyUserNameEvent(event));
        this.addEventListener("record.edit", (event) => this.handleEditRecordEvent(event));
        this.addEventListener("record.delete", (event) => this.handleDeleteRecordEvent(event));
        this.addEventListener("record.launch", (event) => this.handleLaunchRecordEvent(event));
        this.addEventListener("record.label.clicked", (event) => this.handleCopyPasswordEvent(event));

        let filterNameField = this.shadowRoot.querySelector('input[name="recordNameFilter"]');
        filterNameField.addEventListener("input", (event) => {
            let newEvent = new CustomEvent("filter.changed", {detail: {type: "filter.changed.name", name: event.target.value}});
            this.dispatchEvent(newEvent);
        });

        var filterButton = this.shadowRoot.querySelector('button[id="open_filter_button"]');
        filterButton.addEventListener("click", (event) => {
            let newEvent = new CustomEvent("filter.changed", {detail: {type: "filter.edited"}});
            this.dispatchEvent(newEvent);
        });

        filterButton = this.shadowRoot.querySelector('button[id="clear_filter_button"]');
        filterButton.addEventListener("click", (event) => {
            let newEvent = new CustomEvent("filter.changed", {detail: {type: "filter.clear"}});
            this.dispatchEvent(newEvent);
        });

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
        let field = this.shadowRoot.querySelector('input[name="recordNameFilter"]');
        field.value = "";
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

    handleExitApplication() {
        console.log("Exiting application...");
        invoke("update_exit_on_close", { exitOnClose: true })
            .then(() => {
                getCurrentWindow().close();
            });
    }

    handleFilterChangedEvent(event) {
        console.log("Menu event received:", event.detail);
        switch(event.detail.type) {
            case "filter.changed.name":
                this.handleFilterNameChanged(event);
                break;
            case "filter.clear":
                this.handleClearFilter(event);
                break;
            case "filter.edited":
                this.handleOpenFilters(event);
                break;
            default:
                console.warn("Unknown filter changed event received:", event.detail);
                break;
        }
    }

    handleFilterNameChanged(event) {
        console.log("Filter name changed:", event.detail);
        this.stateManager.setValue("recordFilter", new RecordFilter(event.detail.name));
        this.reloadRecordList();
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
            case "application.exit":
                this.handleExitApplication();
                break;
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
        let list = this.shadowRoot.querySelector('slot[name="content"]').assignedNodes()[0];
        this.closeAllMenusAndModals();
        list.clearAllLineItems();
        this.stateManager.setValue("records", []);
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

        if(list && this.stateManager.getValue("mode")) {
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
                                   passwordHash: this.stateManager.getValue("passwordHash"),
                                   records: this.stateManager.getValue("records")};
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
