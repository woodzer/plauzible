const TOOLBAR_STYLES = `
<style>
    .align-horizontal {
        flex-direction: row;
    }

    .align-vertical {
        flex-direction: column;
    }

    .bordered {
        border: solid 1px var(--bulma-border, #777);
        border-radius: 5px;
    }

    .toolbar {
        display: inline-block;
        padding: 3px;
    }

    .tools {
        display: flex;
        flex-wrap: wrap;
        gap: 5px 10px;
        margin: 3px;
    }

    ::slotted(img) {
        cursor: pointer;
        height: 32px;
        width: 32px;
    }

    ::slotted(img):hover {
        background-color: red;
    }
</style>
`;

const BASE_TOOLBAR_TEMPLATE = `
<div class="toolbar">
    <div class="tools">
        <slot name="tool"></slot>
    </div>
</div>
`;

const TOOLBAR_ALIGNMENTS = ["horizontal", "vertical"];
const DEFAULT_ALIGNMENT = TOOLBAR_ALIGNMENTS[0];

export default class Toolbar extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({mode: 'open'});
        this.shadowRoot.innerHTML = `${TOOLBAR_STYLES} ${BASE_TOOLBAR_TEMPLATE}`;

        this._alignment = (this.getAttribute("alignment") || DEFAULT_ALIGNMENT).toLowerCase();
        if(!TOOLBAR_ALIGNMENTS.includes(this._alignment)) {
            this._alignment = DEFAULT_ALIGNMENT;
        }

        this.shadowRoot.addEventListener("slotchange", (n) => {
            this.childNodes.forEach((n) => {
                n.addEventListener("click", (e) => {});
            });
        });
    }

    connectedCallback() {
        let slot = this.shadowRoot.querySelector('slot');
        let elements = Array.from(slot.assignedElements());


        this.shadowRoot.querySelector(".tools").classList.add(`align-${this._alignment}`);
        if(this.getAttribute("border") === "true") {
            this.shadowRoot.querySelector(".toolbar").classList.add("bordered");
        }

        elements.forEach((element) => {
            element.addEventListener("click", (e) => {
                let details = {action: element.getAttribute("action") || "unspecified",
                               target: element};
                this.dispatchEvent(new CustomEvent("toolbar.tool.activated", {bubbles: true, composed: true, detail: details}));
            });
        });
    }
}

customElements.define('tool-bar', Toolbar);
