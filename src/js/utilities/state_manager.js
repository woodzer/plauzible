const DEFAULT_APPLICATION_TIMEOUT = 600000;

/**
 * This class provides a simple, in-memeory state manager for data elements
 * used within the application. Values within this class are transient and
 * will not be persisted between sessions.
 */
export default class StateManager {
    constructor() {
        this._state = {};
        this._applicationTimeOut = null;
        this._applicationTimeOutListeners = [];
    }

    /**
     * Adds a listener for the application time out.
     */
    addTimeOutListener(listener) {
        this._applicationTimeOutListeners.push(listener);
    }

    /**
     * Returns true if the specified key exists in the state manager, false otherwise.
     */
    exists(key) {
        return(this._state.hasOwnProperty(key));
    }

    /**
     * Returns the value of the specified key in the state manager. If the key does not
     * exist, the alternative value is returned. The alternative value is null by default.
     */
    getValue(key, alternative=null) {
        return(this.exists(key) ? this._state[key] : alternative);
    }

    /**
     * Invoked when the application time out expires. Triggers execution of all of the
     * application time out listeners.
     */
    onApplicationTimeOut() {
        console.log("Application time out expired.");
        this._applicationTimeOut = null;
        this._applicationTimeOutListeners.forEach((listener) => listener());
    }

    reset() {
        this._state = {};
        if(this._applicationTimeOut) {
            clearTimeout(this._applicationTimeOut);
        }
        this._applicationTimeOut = null;
    }

    /**
     * Sets the value of the specified key in the state manager.
     */
    setValue(key, value) {
        this._state[key] = value;
    }

    /**
     * Starts the application time out. If the timeout ever expires, the application time
     * out listeners will be invoked.
     */
    startApplicationTimeOut() {
        let timeout = this.getValue("applicationTimeout", DEFAULT_APPLICATION_TIMEOUT);

        if(this._applicationTimeOut) {
            clearTimeout(this._applicationTimeOut);
        }
        this._applicationTimeOut = setTimeout(() => this.onApplicationTimeOut(), timeout);
        console.log("Application time out (re-)started");
    }

    /**
     * Stores all of the properties of the specified object within the state manager.
     */
    store(object) {
        Object.assign(this._state, object);
    }

    /**
     * Touches the application time out. This will reset the timeout to the default value.
     */
    touchApplicationTimeOut() {
        this.startApplicationTimeOut
    }
}
