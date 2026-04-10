const { readTextFile } = window.__TAURI__.fs;

function importBitwardenJSONFile(filePath, importReport) {
    if(filePath && filePath.trim() !== "") {
        let promise = readTextFile(filePath)
            .then((text) => {
                try {
                    let json = JSON.parse(text);
                    let folderMap = {};

                    json.folders.forEach((folder) => {
                        folderMap[folder.id] = folder.name;
                    });

                    let records = json.items.filter((item) => item.type === 1).map((item) => {
                        let recordURI = item.login.uris[0];
                        let record = {
                            id: item.id,
                            name: item.name,
                            notes: item.notes,
                            password: item.login.password,
                            tags: [],
                            userName: item.login.username
                        };

                        if(recordURI) {
                            record.url = recordURI.uri;
                        }

                        if(folderMap[item.folderId]) {
                            record.tags.push(folderMap[item.folderId]);
                        }

                        importReport.write(`Found the ${record.name} entry.`);
                        return(record);
                    });

                    importReport.write(`Read ${records.length} records from the '${filePath}' file.`);
                    return(records);
                } catch(error) {
                    importReport.writeError(`Failed to parse the Bitwarden JSON file. Cause: ${error}`);
                    throw(`Failed to parse the Bitwarden JSON file. Cause: ${error}`);
                }
            })
            .catch((error) => importReport.writeError(`Failed to read the Bitwarden JSON file. Cause: ${error}`));

            return(promise);
    } else {
        importReport.writeError("Invalid file specified for Bitwarden file import.");
        throw new Error("Invalid file specified for Bitwarden file import.");
    }
}

function isRecordNameUnique(existingRecords, record) {
    let existingRecordNames = existingRecords.map((record) => record.name);
    return(existingRecordNames.includes(record.name));
}

/**
 * Reads a Plauzible export snapshot (formatVersion 1) and returns credential objects
 * suitable for RecordImportExecutor. Only decrypted vault entries are imported;
 * snapshot settings are not applied (they can conflict with the current database).
 */
function importPlauzibleSnapshotJSONFile(filePath, importReport) {
    if(!filePath || filePath.trim() === "") {
        importReport.writeError("Invalid file specified for Plauzible snapshot import.");
        return Promise.reject(new Error("Invalid file specified for Plauzible snapshot import."));
    }

    return readTextFile(filePath)
        .then((text) => {
            try {
                let json = JSON.parse(text);
                if(json.formatVersion !== 1) {
                    throw new Error(`Unsupported or missing formatVersion (expected 1, got ${json.formatVersion}).`);
                }
                if(!Array.isArray(json.records)) {
                    throw new Error("Snapshot does not contain a records array.");
                }

                let records = [];
                json.records.forEach((row, index) => {
                    if(!row || typeof row !== "object") {
                        throw new Error(`Invalid record entry at index ${index}.`);
                    }
                    if(!row.decrypted || typeof row.decrypted !== "object" || Array.isArray(row.decrypted)) {
                        throw new Error(`Missing or invalid decrypted payload at index ${index}.`);
                    }

                    let record = JSON.parse(JSON.stringify(row.decrypted));
                    if(typeof record.name !== "string" || record.name.trim() === "") {
                        throw new Error(`Record at index ${index} is missing a non-empty name.`);
                    }
                    if(!Array.isArray(record.tags)) {
                        record.tags = [];
                    }

                    importReport.write(`Found the ${record.name} entry.`);
                    records.push(record);
                });

                importReport.write(`Read ${records.length} records from Plauzible snapshot '${filePath}'.`);
                return records;
            } catch(error) {
                importReport.writeError(`Failed to parse Plauzible snapshot file. Cause: ${error}`);
                throw new Error(`Failed to parse Plauzible snapshot file. Cause: ${error}`);
            }
        })
        .catch((error) => {
            importReport.writeError(`Failed to read Plauzible snapshot file. Cause: ${error}`);
            throw error;
        });
}

export {
    importBitwardenJSONFile,
    importPlauzibleSnapshotJSONFile,
    isRecordNameUnique
};