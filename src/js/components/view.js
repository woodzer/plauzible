/**
 * A base class for the views that are used in the application. This class
 * provides a base implementation for the views and is intended to be subclassed.
 */
export default class View extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({mode: 'open'});
        this._stateManager = null;
        this._viewSwitcher = null;
    }

    /**
     * This function gets invoked whenever a view is activated (i.e. shown).
     * It should be overridden by the subclass to provide the necessary
     * functionality and not called directly.
     */
    activated(data={}) {
        console.log(`View ${this.tagName} activated with data:`, data);
    }

    /**
     * Invoked when the view is connected to the DOM.
     */
    connectedCallback() {
        this.dispatchEvent(new CustomEvent("view.connected", {bubbles: true}));
    }

    /**
     * Returns true if the view has a state manager, false otherwise.
     */
    get hasStateManager() {
        return(this._stateManager !== null);
    }

    /**
     * Returns the state manager for the view. Raises an error if the state manager is
     * not set.
     */
    get stateManager() {
        if(!this.hasStateManager) {
            let message = `State manager requested but not set for view ${this.tagName}.`;
            console.error(message);
            throw message;
        }
        return(this._stateManager);
    }

    /**
     * Sets the state manager for the view.
     */
    set stateManager(stateManager) {
        // console.log(`Setting state manager for view ${this.tagName} to:`, stateManager);
        this._stateManager = stateManager;
    }


    /**
     * Returns the view switcher for the view. Raises an error if the view switcher is
     * not set.
     */
    get viewSwitcher() {
        if(!this.hasViewSwitcher) {
            let message = `View switcher requested but not set for view ${this.tagName}.`;
            console.error(message);
            throw message;
        }
        return(this._viewSwitcher);
    }

    /**
     * Returns true if the view has a view switcher, false otherwise.
     */
    get hasViewSwitcher() {
        return(this._viewSwitcher !== null);
    }

    /**
     * Sets the view switcher for the view.
     */
    set viewSwitcher(viewSwitcher) {
        this._viewSwitcher = viewSwitcher;
    }
}
