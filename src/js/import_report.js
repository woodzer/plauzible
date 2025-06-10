export default class ImportReport {
    constructor() {
        this.lineItems = [];
        this.result = null;
        this.status = "active";
        this.listeners = {"alert": [], "error": [], "info": [], "log": []};
    }

    addEventListener(event, listener) {
        if(this.listeners[event]) {
            this.listeners[event].push(listener);
        } else {
            console.warn(`Unknown event type ${event} requested for import report.`);
        }
    }

    isCompleted() {
        return(this.status === "completed");
    }

    setResult(result) {
        this.result = result;
        this.status = "completed";
    }

    writeAlert(message) {
        console.warn(message);
        this.lineItems.push({
            level: "alert",
            message: message,
            timestamp: new Date().toISOString()
        });
        this.notify("alert", message);
    }

    writeError(message) {
        console.error(message);
        this.lineItems.push({
            level: "error",
            message: message,
            timestamp: new Date().toISOString()
        });
        this.notify("error", message);
    }

    write(message) {
        console.info(message);
        this.lineItems.push({
            level: "info",
            message: message,
            timestamp: new Date().toISOString()
        });
        this.notify("info", message);
    }

    getReport() {
        return(this.lineItems.map((item) => `${item.timestamp} - ${item.level} - ${item.message}`).join("\n"));
    }

    notify(level, message) {
        this.listeners[level].concat(this.listeners["log"]).forEach((listener) => listener(new CustomEvent(level, {detail: {level: level, message: message}})));
    }
}