const MULTI_SELECT_LIST_ITEM_STYLES = `
<style>
    .entry-control {
        padding-right: 15px;
    }

    .entry-label {
        flex-grow: 1;
    }

    .multi-select-list-item-container {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        padding: 5px;
    }
</style>
`;

const MULTI_SELECT_LIST_ITEM_TEMPLATE = `
<div class="multi-select-list-item-container">
    <div class="entry-control">
        <input type="checkbox" class="entry-checkbox">
    </div>
    <div class="entry-label"></div>
</div>
`;

const MULTI_SELECT_LIST_STYLES = `
<style>
    .multi-select-list-container {
        border: solid 1px var(--bulma-border-weak, #ccc);
        height: 100%;
        max-height: 200px;
        overflow: auto;
        width: 100%;
    }
</style>
`;

const MULTI_SELECT_LIST_TEMPLATE = `
<div class="multi-select-list-container">
</div>
`;

class MultiSelectList extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({mode: 'open'});
        this.shadowRoot.innerHTML = `${MULTI_SELECT_LIST_STYLES} ${MULTI_SELECT_LIST_TEMPLATE}`;
        this.listEntries = [];
        this.selectedEntries = [];
    }

    connectedCallback() {
        this.setListEntries(this.listEntries);
    }

    getSelectedEntries() {
        return this.selectedEntries;
    }

    handleItemDeselected(event) {
        this.selectedEntries = this.selectedEntries.filter((entry) => entry !== event.detail.value);
    }

    handleItemSelected(event) {
        this.selectedEntries.push(event.detail.value);
    }

    setListEntries(listEntries) {
        let fragment = document.createDocumentFragment();

        listEntries.forEach((listEntry) => {
            let item = new MultiSelectListItem();

            item.setLabel(listEntry);
            item.setValue(listEntry);
            item.addEventListener("list.item.selected", (e) => this.handleItemSelected(e));
            item.addEventListener("list.item.deselected", (e) => this.handleItemDeselected(e));
            fragment.appendChild(item);
        });

        this.listEntries = listEntries;
        this.selectedEntries = [];

        let container = this.shadowRoot.querySelector(".multi-select-list-container");
        container.innerHTML = "";
        container.appendChild(fragment);
    }
}

class MultiSelectListItem extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({mode: 'open'});
        this.shadowRoot.innerHTML = `${MULTI_SELECT_LIST_ITEM_STYLES} ${MULTI_SELECT_LIST_ITEM_TEMPLATE}`;
        this.label = "";
        this.value = "";
    }

    connectedCallback() {
        let checkbox = this.shadowRoot.querySelector(".entry-checkbox");

        this.setLabel(this.label);
        checkbox.addEventListener("change", (e) => this.onCheckboxChanged(e));
    }

    onCheckboxChanged(event) {
        let checkbox = this.shadowRoot.querySelector(".entry-checkbox");

        if(checkbox.checked) {
            this.dispatchEvent(new CustomEvent("list.item.selected", {bubbles: true, composed: true, detail: {value: this.value}}));
        }
        else {
            this.dispatchEvent(new CustomEvent("list.item.deselected", {bubbles: true, composed: true, detail: {value: this.value}}));
        }
    }

    setLabel(label) {
        this.label = label;
        this.shadowRoot.querySelector(".entry-label").innerText = label;
    }

    setValue(value) {
        this.value = value;
    }
}

customElements.define('multi-select-list', MultiSelectList);
customElements.define('multi-select-list-item', MultiSelectListItem);

export {
    MultiSelectList,
    MultiSelectListItem
}
