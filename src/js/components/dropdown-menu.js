const MENU_ITEM_STYLES = `
<style>
    .menu-item-container {
        cursor: pointer;
        font-size: 1.25em;
        margin: 5px 0;
        /*padding: 5px 15px;*/
    }

    .menu-item-container:hover {
        background-color: rgba(0, 0, 0, 0.06);
    }

    @media (prefers-color-scheme: dark) {
        .menu-item-container:hover {
            background-color: rgba(255, 255, 255, 0.08);
        }
    }

    .menu-item-label {
        display: inline-block;
        height: 100%;
        padding: 5px 10px 10px 10px;
        text-wrap: nowrap;
        vertical-align: middle;
    }
</style>
`;

const MENU_ITEM_TEMPLATE = `
<div class="menu-item-container">
    <slot name="icon"></slot>
    <span class="menu-item-label"></span>
</div>
`;

const MENU_SEPARATOR_STYLES = `
<style>
    hr {
        border-color: var(--bulma-border-weak, #ccc);
    };
</style>
`;

const MENU_SEPARATOR_TEMPLATE = `
<div class="menu-item-separator-container">
    <hr>
</div>
`;

const MENU_STYLES = `
<style>
    .menu-container {
        display: inline-block;
    }

    .menu-content {
        background-color: var(--bulma-scheme-main, #fff);
        border: solid 1px var(--bulma-border, #555);
        border-radius: 5px;
        color: var(--bulma-text, inherit);
        min-width: 100px;
        min-height: 20px;
        padding: 3px 5px;
        position: absolute;
        z-index: 1000;
    };

    ::slotted(*) > * {
        display: block;
    }

    .menu-trigger {
        color: var(--bulma-text-weak, #555);
        cursor: pointer;
    }

    .menu-trigger svg path {
        fill: currentColor;
    }

    .hidden {
        display: none;
    }
</style>
`;

const MENU_TEMPLATE = `
<span class="menu-container">
    <span class="menu-trigger">
        <center>
            <?xml version="1.0" encoding="utf-8"?>
                <!-- License: MIT. Made by elusiveicons: https://elusiveicons.com -->
                <svg version="1.1"
                    id="svg2" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:cc="http://creativecommons.org/ns#" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:svg="http://www.w3.org/2000/svg" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" sodipodi:docname="lines.svg" inkscape:version="0.48.4 r9939"
                        xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"  width="24px" height="24px"
                    viewBox="0 0 1200 1200" enable-background="new 0 0 1200 1200" xml:space="preserve">
                <path id="rect3039" inkscape:connector-curvature="0" d="M0,0v240h1200V0H0z M0,480v240h1200V480H0z M0,960v240h1200V960H0z"/>
                </svg>
        </center>
    </span>

    <div class="menu-content hidden">
        <slot name="menuitem">
    </div>
</span>
`;

class DropdownMenu extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({mode: 'open'});
        this.shadowRoot.innerHTML = `${MENU_STYLES} ${MENU_TEMPLATE}`;
        this.escapeCloses = ["on", "true"].includes((this.getAttribute("escapeCloses") || "").toLowerCase());
    }

    close() {
        let menu = this.shadowRoot.querySelector(".menu-content");

        if(menu) {
            if(!menu.classList.contains("hidden")) {
                this.toggleMenu(new CustomEvent("menu.close"));
            }
        }
    }

    connectedCallback() {
        let trigger = this.shadowRoot.querySelector(".menu-trigger");

        this.addEventListener("menu.item.selected", (e) => this.handleMenuItemTriggered(e));
        if(this.escapeCloses) {
            document.addEventListener("keydown", (e) => this.handleKeyPress(e));
        }
        if(trigger) {
            trigger.addEventListener("click", (e) => this.toggleMenu(e));
        }
    }

    handleKeyPress(event) {
        if(event.key && event.key.toLowerCase() === "escape") {
            this.close();
        }
    }

    handleMenuItemTriggered(event) {
        this.toggleMenu(event);
    }

    open() {
        let menu = this.shadowRoot.querySelector(".menu-content");

        if(menu) {
            if(menu.classList.contains("hidden")) {
                this.toggleMenu(new CustomEvent("menu.open"));
            }
        }
    }

    toggleMenu(event) {
        let menu = this.shadowRoot.querySelector(".menu-content");
        let trigger = this.shadowRoot.querySelector(".menu-trigger");

        if(menu && trigger) {
            let showingMenu = menu.classList.contains("hidden");
            let parentDetails = menu.parentElement.getBoundingClientRect();
            let triggerDetails = trigger.getBoundingClientRect();

            menu.classList.toggle("hidden");
            if(showingMenu) {
                let menuDetails = menu.getBoundingClientRect();

                menu.style.top = `${parentDetails.top + parentDetails.height}px`;
                menu.style.left = `${parentDetails.left}px`;
                menu.style.left = `${parentDetails.left - (menuDetails.width - triggerDetails.width)}px`;

                this.dispatchEvent(new CustomEvent("menu.opened", {bubbles: true, composed: true, detail: {node: this}}));
            } else {
                this.dispatchEvent(new CustomEvent("menu.closed", {bubbles: true, composed: true, detail: {node: this}}));
            }
        }
    }
}

class DropdownMenuItem extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({mode: 'open'});
        this.shadowRoot.innerHTML = `${MENU_ITEM_STYLES} ${MENU_ITEM_TEMPLATE}`;
    }

    connectedCallback() {
        let label = this.shadowRoot.querySelector(".menu-item-label");

        this.addEventListener("click", (e) => this.menuItemSelected(e));
        if(label) {
            label.innerText = this.getAttribute("label");
        }
    }

    menuItemSelected(event) {
        const details = {node: this, type: this.getAttribute("event"), ...this.dataset};
        const triggerEvent = new CustomEvent("menu.item.selected", {bubbles: true, composed: true, detail: details});
        this.dispatchEvent(triggerEvent);
    }
}

class DropdownMenuItemSeparator extends DropdownMenuItem {
    constructor() {
        super();
        this.shadowRoot.innerHTML = `${MENU_SEPARATOR_STYLES} ${MENU_SEPARATOR_TEMPLATE}`;
    }
}

customElements.define('dropdown-menu', DropdownMenu);
customElements.define('dropdown-menu-item', DropdownMenuItem);
customElements.define('dropdown-menu-item-separator', DropdownMenuItemSeparator);

export {
    DropdownMenu,
    DropdownMenuItem,
    DropdownMenuItemSeparator
}
