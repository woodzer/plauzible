export default class RecordAPI {
    constructor(settings, invoke) {
        this.settings = settings;
        this.invoke = invoke;
    }

    create(details) {
        if(this.settings.mode === "local") {
            return this.createLocal(details);
        } else {
            return this.createRemote(details);
        }
    }

    decrypt(record) {
        return this.invoke("decrypt_record", {passwordHash: this.settings.passwordHash, record: record.data})
            .then((output) => {
                try {
                    return(JSON.parse(output));
                } catch(exception) {
                    throw(`Failed to parse decrypted record content as a JSON object. Cause: ${exception}`);
                }
            });
    }

    delete(recordId) {
        if(this.settings.mode === "local") {
            return this.deleteLocal(recordId);
        } else {
            return this.deleteRemote(recordId);
        }
    }

    getAll() {
        if(this.settings.mode === "local") {
            return this.getAllLocal();
        } else {
            return this.getAllRemote();
        }
    }

    update(recordId, originalRecord, updatedDetails) {
        if(this.settings.mode === "local") {
            return this.updateLocal(recordId, originalRecord, updatedDetails);
        } else {
            return this.updateRemote(recordId, originalRecord, updatedDetails);
        }
    }

    createLocal(details) {
        // Clear any lingering fields that may have been added by the form.
        details = this.cleanRecordObject(details);

        let parameters = {passwordHashHex: this.settings.passwordHash,
                          record: JSON.stringify(details)};

        return this.invoke("store_record", parameters)
            .then((output) => {
                try {
                    return(JSON.parse(output));
                } catch(exception) {
                    throw(`Failed to parse created record content as a JSON object. Cause: ${exception}`);
                }
            });
    }

    createRemote(details) {
        return this.invoke("store_remote_record", {passwordHash: this.settings.passwordHash, record: JSON.stringify(details)})
            .then((output) => {
                try {
                    return(JSON.parse(output));
                } catch(exception) {
                    throw(`Failed to parse created record content as a JSON object. Cause: ${exception}`);
                }
            });
    }

    deleteLocal(recordId) {
        return this.invoke("delete_record_by_id", {recordId});
    }

    deleteRemote(recordId) {
        let record = this.settings.records.find((record) => record.id === recordId);
        let parameters = {passwordHash: this.settings.passwordHash, record: JSON.stringify(record), recordId: recordId};
        return this.invoke("delete_remote_record", parameters);
    }

    getAllLocal() {
        return this.invoke("get_local_records_for_password", {passwordHash: this.settings.passwordHash})
            .then((output) => {
                try {
                    let object = JSON.parse(output);

                    return(object.records.sort((rhs, lhs) => rhs.name.localeCompare(lhs.name)));
                } catch(exception) {
                    throw(`Failed to parse record list content as a JSON object. Cause: ${exception}`);
                }
            });
    }

    getAllRemote() {
        return this.invoke("get_remote_records_for_password", {passwordHash: this.settings.passwordHash})
            .then((output) => {
                try {
                    let records = JSON.parse(output);
                    return(records.sort((rhs, lhs) => rhs.name.localeCompare(lhs.name)));
                } catch(exception) {    
                    throw(`Failed to parse record list content as a JSON object. Cause: ${exception}`);
                }
            })
            .catch((error) => {
                throw(`Failed to retrieve records from the remote service. Cause: ${error}`);
            });
    }

    updateLocal(recordId, originalRecord, updatedDetails) {
        let parameters = {passwordHash: this.settings.passwordHash, record: originalRecord.data};

        return(this.invoke("decrypt_record", parameters)
            .then((recordJSON) => {
                try {
                    let object = JSON.parse(recordJSON);
                    let parameters = {passwordHashHex: this.settings.passwordHash, recordId: recordId};

                    if(updatedDetails.password !== object.passwordCopy) {
                        if(!object.passwordHistory) {
                            object.passwordHistory = [];
                        }
                        object.passwordHistory.push({changed: new Date(), password: updatedDetails.passwordCopy});
                    }

                    updatedDetails = this.cleanRecordObject(updatedDetails);
                    object = this.cleanRecordObject(Object.assign(object, updatedDetails));

                    parameters.record = JSON.stringify(object);
                    return(this.invoke("update_record", parameters));
                } catch(exception) {
                    throw(`Failed to parse decrypted record content as a JSON object. Cause: ${exception}`);
                }
            })
            .then((output) => {
                try {
                    return(JSON.parse(output));
                } catch(exception) {
                    throw(`Failed to parse updated record content as a JSON object. Cause: ${exception}`);
                }
            }));
    }

    updateRemote(recordId, originalRecord, updatedDetails) {
        let parameters = {passwordHash: this.settings.passwordHash, record: originalRecord.data};

        return(this.invoke("decrypt_record", parameters)
            .then((recordJSON) => {
                try {
                    let object = JSON.parse(recordJSON);
                    let parameters = {passwordHash: this.settings.passwordHash, recordId: recordId};

                    if(updatedDetails.password !== object.passwordCopy) {
                        if(!object.passwordHistory) {
                            object.passwordHistory = [];
                        }
                        object.passwordHistory.push({changed: new Date(), password: updatedDetails.passwordCopy});
                    }

                    updatedDetails = this.cleanRecordObject(updatedDetails);
                    object = this.cleanRecordObject(Object.assign(object, updatedDetails));

                    parameters.record = JSON.stringify(object);
                    return(this.invoke("update_remote_record", parameters));
                } catch(exception) {
                    throw(`Failed to parse decrypted record content as a JSON object. Cause: ${exception}`);
                }
            })
            .then((output) => {
                try {
                    return(JSON.parse(output));
                } catch(exception) {
                    throw(`Failed to parse updated record content as a JSON object. Cause: ${exception}`);
                }
            }));
    }

    cleanRecordObject(object) {
        delete object.id;
        delete object.passwordCopy;

        return(object);
    }
}