const { invoke } = window.__TAURI__.core;

export default class RecordImporter {
    constructor(recordAPI, existingRecords, newRecords, passwordHash, importReport, ignoreDuplicates=true) {
        this.recordAPI = recordAPI;
        this.existingRecords = existingRecords;
        this.newRecords = newRecords;
        this.passwordHash = passwordHash;
        this.importReport = importReport;
        this.ignoreDuplicates = ignoreDuplicates;
        this.completionListeners = [];
        this.progressListeners = [];
    }

    addCompletionListener(listener) {
        this.completionListeners.push(listener);
    }

    addProgressListener(listener) {
        this.progressListeners.push(listener);
    }

    doesRecordNameExist(name) {
        return(this.existingRecords.some((existingRecord) => existingRecord.name.trim() === name.trim()) ||
            this.newRecords.some((newRecord) => newRecord.id !== newRecord.id && newRecord.name.trim() === name.trim()));
    }

    generateNewRecordName(record) {
        let name = record.name;
        let iteration = 1;

        while(!this.doesRecordNameExist(name)) {
            name = `${record.name} (${iteration})`;
            iteration++;
        }

        return(name);
    }

    getReport() {
        return this.importReport;
    }

    async import() {
        let records = this.newRecords.filter((record) => {
            if(this.doesRecordNameExist(record.name)) {
                if(this.ignoreDuplicates) {
                    this.importReport.writeAlert(`The ${record.name} entry already exists. Record will be ignored.`);
                    return false;
                } else {
                    this.importReport.writeAlert(`The ${record.name} entry already exists. Record will be renamed.`);
                    record.name = this.generateNewRecordName(record);
                }
            }

            return true;
        });

        await this.processEntries(records, this.passwordHash, this.importReport);

        this.importReport.write("Import completed.");
        return(invoke("get_records_for_password", {passwordHash: this.passwordHash})
            .then((json) => {
                let allRecords = JSON.parse(json);
                this.importReport.setResult(allRecords.records.sort((rhs, lhs) => rhs.name.localeCompare(lhs.name)));
                return this.importReport;
            }));
    }

    processEntry(record, passwordHash) {
        this.importReport.write(`Importing the ${record.name} entry.`);
        delete record.id;
        return this.recordAPI.create(record)
            .then((output) => {
                this.importReport.write(`Successfully imported the ${record.name} entry.`);
            })
            .catch((error) => {
                this.importReport.writeError(`Failed to import the ${record.name} entry. Cause: ${error}`);
            });
    }

    async processEntries(records, passwordHash) {
        let entriesProcessed = 0;

        // Set this to a non-zero value when using Ngrok.
        // let interRequestDelayLength = 1000;
        let interRequestDelayLength = 0;
        const sleep = ms => new Promise(r => setTimeout(r, interRequestDelayLength));

        for(const record of records) {
            let percentage = Math.round((entriesProcessed / records.length) * 100);
            let event = new CustomEvent("progress", {detail: {percentage: percentage}});

            await this.processEntry(record, passwordHash);
            entriesProcessed++;
            this.progressListeners.forEach((listener) => listener(event));

            if(interRequestDelayLength > 0) {
                await sleep(interRequestDelayLength);
            }
        }
        this.progressListeners.forEach((listener) => listener(new CustomEvent("progress", {detail: {percentage: 100}})));
        this.completionListeners.forEach((listener) => listener(new CustomEvent("completion", {detail: {report: this.importReport}})));
    }
}
