const VERTICAL_LIST_STYLES = `
<style>
    .list-container {
        height: 100%;
        overflow: auto;
        width: 100%;
    }

    .vertical-list {
        height: 100%;
    };
</style>
`;

const VERTICAL_LIST_TEMPLATE = `
<div class="vertical-list">
    <div class="list-container">
         <slot name="lineitem"></slot>
    </div>
</div>
`;

class VerticalList extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({mode: 'open'});
        this.shadowRoot.innerHTML = `${VERTICAL_LIST_STYLES} ${VERTICAL_LIST_TEMPLATE}`;
    }

    addLineItem(lineItem) {
        lineItem.setAttribute("slot", "lineitem");
        this.appendChild(lineItem);
    }

    addLineItems(lineItems) {
        let fragment = document.createDocumentFragment();
        lineItems.forEach((lineItem) => {
            lineItem.setAttribute("slot", "lineitem");
            fragment.appendChild(lineItem);
        });
        this.appendChild(fragment);
    }

    clearAllLineItems() {
        this.innerHTML = "";
    }

    connectedCallback() {
        // Placeholder for future implementation.
    }

    getAllLineItems() {
        const slottedItems = this.shadowRoot.querySelector('slot').assignedNodes();
        return Array.from(slottedItems);
    }
}

customElements.define('vertical-list', VerticalList);

export {
    VerticalList
}