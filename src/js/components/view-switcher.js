import StateManager from "../utilities/state_manager.js";

const VIEW_SWITCHER_STYLES = `
<style>
    ::slotted(.hidden) {
        display: none;
    }

    .view-switch-container {
        height: 100%;
        width: 100%;
    }
</style>
`;

const VIEW_SWITCHER_TEMPLATE = `
<div class="view-switcher-container">
    <slot name="view"></slot>
</div>
`;

/**
 * A component that manages the switching between 'views' within the application.
 * A view is expected to be a web component that extends the View class. This
 * class has responsibilities primarily for managing views, their display and
 * transitioning between them. Refrain from adding any logic to this class that is
 * not related to the management of views.
 */
class ViewSwitcher extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({mode: 'open'});
        this.shadowRoot.innerHTML = `${VIEW_SWITCHER_STYLES} ${VIEW_SWITCHER_TEMPLATE}`;
        this._viewStack = [this.viewNames[0]];
        this._stateManager = new StateManager();
        this._activateCount = 0;

        this._stateManager.addTimeOutListener(() => {
            this.reset();
        });
    }

    /**
     * Retrieves the name of the currently active view. This is equivalent to the name
     * of the view that is at the top of the view stack.
     */
    get activeView() {
        let elements = this.shadowRoot.querySelector("slot").assignedElements()[0];

        return(elements.filter((element) => element.getAttribute("name") === this.activeViewName));
    }

    /**
     * Retrieves the name of the currently active view. This is equivalent to the name
     * of the view that is at the top of the view stack.
     */
    get activeViewName() {
        return this._viewStack[this._viewStack.length - 1];
    }

    /**
     * Closes the current view, opening the view that appears before it on the view
     * stack. If the current view is the only one on the current view stack this
     * function does nothing.
     */
    close() {
        if(this._viewStack.length > 1) {
            this.transitionView(this.activeViewName, this.previousViewName);
            this._viewStack.pop();
        }
    }

    /**
     * Invoked whenever the markup of the component is first added to the DOM.
     */
    connectedCallback() {
        const list = this.shadowRoot.querySelector("slot").assignedElements();

        this.addEventListener("view.connected", (event) => {
            event.stopImmediatePropagation();
            event.target.viewSwitcher = this;
            event.target.stateManager = this._stateManager;

            this._activateCount++;
            if(this.viewNames.length === this._activateCount) {
                this.switchToView(this.viewNames[0]);
            }
        });

        this.addEventListener("view.close", (event) => {
            console.log(`View close event received for ${this.activeViewName} view.`);
            event.stopImmediatePropagation();
            this.close();
        });

        this.addEventListener("view.open", (event) => {
            console.log(`View open event received for ${event.detail.viewName} view. Current view is ${this.activeViewName}.`);
            event.stopImmediatePropagation();
            if(event.detail && event.detail.viewName) {
                this.open(event.detail.viewName);
            } else {
                console.error("View open event received but no view name was provided.");
            }
        });

        this.addEventListener("view.switch", (event) => {
            console.log(`View switch event received for ${event.detail.viewName} view. Current view is ${this.activeViewName}.`);
            event.stopImmediatePropagation();
            if(event.detail && event.detail.viewName) {
                let data = event.detail.data || {};
                this.switchToView(event.detail.viewName, data);
            } else {
                console.error("View switch event received but no view name was provided.");
            }
        });

        list.forEach((element) => {
            element.classList.add("hidden");
        });
    }

    /**
     * Opens the named viewed as the active one and pushes it's name onto the view
     * stack. If the requested view is already the view at the head of the view
     * stack then this function does nothing. Use this function, in conjunction
     * with the close() function, if you want a chain of views that can be
     * traversed forwards and backwards.
     */
    open(viewName, data={}) {
        if(!this.viewExists(viewName)) {
            let message = `Attempt made to open the '${viewName}' unknown view.`;
            console.error(message);
            throw message;
        }

        this.transitionView(this.activeViewName, viewName, data);
        this._viewStack.push(viewName);
    }

    /**
     * Returns the name of the view that precedes the currently active one in the
     * view stack. Returns null if there is not preceding view.
     */
    get previousViewName() {
        let viewName = null;

        if(this._viewStack.length > 1) {
            viewName = this._viewStack[this._viewStack.length - 2];
        }

        return viewName;
    }

    reset() {
        this._viewStack = [this._viewStack[this._viewStack.length - 1]];
        this._stateManager.reset();
        this.switchToView(this.viewNames[0]);
    }

    /**
     * Returns the state manager for the view switcher. Raises an error if the state manager is
     * not set.
     */
    get stateManager() {
        if(!this._stateManager) {
            let message = `State manager requested but not set for view switcher.`;
            console.error(message);
            throw message;
        }
        return(this._stateManager);
    }

    /**
     * Sets the state manager for the view switcher.
     */
    set stateManager(stateManager) {
        const list = this.shadowRoot.querySelector("slot").assignedElements();

        this.stateManager = stateManager;
        list.forEach((element) => {
            element.stateManager = stateManager;
        });

    }

    /**
     * Makes the named view the one that is active in the view switcher, making all
     * other view inactive (i.e. hidden). Replaces the view name at the head of the
     * view stack with the name of the view that was made active. Throws an exception
     * if the named view does not exist. Use this method to change the view when the
     * intention is that a change is a replacement for the current view.
     */
    switchToView(viewName, data={}) {
        if(!viewName ||!this.viewExists(viewName)) {
            let message = `Attempt made to activate the '${viewName}' unknown view.`;
            console.error(message);
            throw message;
        }

        this.transitionView(this.activeViewName, viewName, data);
        this._viewStack = [viewName];
    }

    /**
     * This function transitions from one view to another. It is intended to wrap
     * the entire transition functionality. The function contains no error checking
     * and is meant for internal class use only.
     */
    transitionView(fromViewName, toViewName, data={}) {
        let list = this.shadowRoot.querySelector("slot").assignedElements();
        let fromView = list.filter((e) => e.getAttribute("name") === fromViewName)[0];
        let toView = list.filter((e) => e.getAttribute("name") === toViewName)[0];

        console.log(`Transitioning from the ${fromViewName} view to the ${toViewName} view requested.`);

        if(fromViewName !== toViewName && `${fromViewName}` !== "") {
            fromView.classList.add("hidden");
        }
        toView.classList.remove("hidden");
        toView.activated(data);
    }

    /**
     * Checks whether a named view exists within the list of views that are available
     * within the ViewSwitcher instance.
     */
    viewExists(viewName) {
        return this.viewNames.includes(viewName);
    }

    /**
     * Returns an array containing the name of available views. Note that the ordering
     * of the view names has no meaning whatsoever.
     */
    get viewNames() {
        let names = [];

        this.shadowRoot.querySelector("slot").assignedElements().forEach(element => {
            names.push(element.getAttribute("name"));
        });

        return names;
    }

    /**
     * Returns a count of the number of items currently in the view stack.
     */
    get viewStackSize() {
        return this._viewStack.length;
    }
}

customElements.define('view-switcher', ViewSwitcher);

export {
    ViewSwitcher
}
