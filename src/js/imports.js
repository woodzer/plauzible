const { exists, readTextFile } = window.__TAURI__.fs;

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

export {
    importBitwardenJSONFile,
    isRecordNameUnique
};