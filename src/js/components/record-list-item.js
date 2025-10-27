const LIST_ITEM_STYLES = `
<style>
    .item-label {
        font-size: 30px;
        padding: 5px;
    }

    .record-list-item {
        align-items: center;
        border: solid 1px #fff;
        cursor: pointer;
        display: grid;
        grid-template-columns: auto 60px;
        margin: 5px;
    }

    .record-list-item:hover {
        background-color: rgba(230, 230, 230, 0.2);
        border: dotted 1px #007;
    }
</style>
`;

const LIST_ITEM_TEMPLATE = `
<div class="record-list-item">
    <div class="item-label"></div>

    <div class="item-controls">
        <dropdown-menu class="dropdown-menu" escapeCloses="true">
            <dropdown-menu-item event="record.password.copy" label="Copy Password" slot="menuitem"></dropdown-menu-item>
            <dropdown-menu-item event="record.username.copy" label="Copy User Name" slot="menuitem"></dropdown-menu-item>
            <dropdown-menu-item-separator slot="menuitem"></dropdown-menu-item-separator>
            <dropdown-menu-item event="record.edit" label="Edit" slot="menuitem"></dropdown-menu-item>
            <dropdown-menu-item event="record.delete" label="Delete" slot="menuitem"></dropdown-menu-item>
            <dropdown-menu-item-separator slot="menuitem"></dropdown-menu-item-separator>
            <dropdown-menu-item event="record.launch" label="Launch" slot="menuitem"></dropdown-menu-item>
        </dropdown-menu>
    </div>
</div>
`;

class RecordListItem extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({mode: 'open'});
        this.shadowRoot.innerHTML = `${LIST_ITEM_STYLES} ${LIST_ITEM_TEMPLATE}`;
    }

    closeMenu() {
        let control = this.shadowRoot.querySelector(".dropdown-menu");
        if(control) {
            control.close();
        }
    }

    connectedCallback() {
        let label = this.shadowRoot.querySelector(".item-label");

        if(!this.hasURL) {
            this.shadowRoot.querySelector("dropdown-menu-item-separator:last-of-type").style.display = "none";
            this.shadowRoot.querySelector('dropdown-menu-item[event="record.launch"]').style.display = "none";
        }

        if(label) {
            if(this.dataset.label) {
                label.innerText = this.dataset.label;
            }
            label.addEventListener("click", (e) => this.itemLabelClicked(e));
        }
        this.addEventListener("menu.item.selected", (e) => this.propagateMenuItemSelected(e));
    }

    get hasURL() {
        return(this.dataset.hasUrl === "true");
    }

    get id() {
        return(this.dataset.id);
    }

    get name() {
        return(this.dataset.name);
    }

    get record() {
        return({id:     this.id,
                hasURL: this.hasURL,
                name:   this.name,
                tags:   this.tags});
    }

    get tags() {
        if(this.dataset.tags) {
            return(this.dataset.tags.split(","));
        } else {
            return([]);
        }
    }

    itemLabelClicked(event) {
        let details = {node: this, type: "record.label.clicked", ...this.dataset};
        this.dispatchEvent(new CustomEvent("record.label.clicked", {bubbles: true, composed: true, detail: details}));
    }

    propagateMenuItemSelected(event) {
        let details = event.detail;
        let settings = {bubbles: true, composed: true, detail: {...details, ...this.record}};

        event.stopPropagation();
        settings.detail.node = this;
        this.dispatchEvent(new CustomEvent(details.type, settings));
    }

    set record(record) {
        let labelNode = this.shadowRoot.querySelector(".item-label");

        this.dataset.id     = record.id;
        this.dataset.name   = record.name;
        // this.dataset.tags   = record.tags.join(",");
        this.dataset.tags   = `${record.tags}`;
        this.dataset.hasUrl = record.hasURL;

        if(labelNode) {
            labelNode.innerText = record.name;
        }
    }
}

customElements.define('record-list-item', RecordListItem);

export {
    RecordListItem
}
