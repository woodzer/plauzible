use json;
use uuid::Uuid;
use reqwest;
use tauri::AppHandle;
use crate::commands::database;
use crate::commands::utilities;

struct ServiceSettings {
    key: String,
    url: String,
    salt: String,
    nonce: String,
}


pub async fn create_remote_record(handle: &AppHandle, password_hash: &str, record: &str) -> Result<String, String> {
    let service_settings = get_service_settings(handle).await?;
    let mut json = match json::parse(&record) {
        Ok(value) => value,
        Err(error) => {
            return Err(format!(
                "Failed to parse record value into JSON object. Cause: {:?}",
                error
            ))
        }
    };
    let name = json["name"].as_str().unwrap_or("").to_string();
    let has_url = json["url"].is_string() && json["url"].as_str().unwrap_or("").trim() != "";
    let owner_id = Uuid::new_v4().to_string();

    json["plauzible"] = json::JsonValue::new_object();
    json["plauzible"]["ownerId"] = json::JsonValue::String(owner_id.clone());

    let record = json::stringify(json.clone());

    let record_data = utilities::encrypt(password_hash, &service_settings.nonce, &record).await?;
    let data = object! {
        data: record_data.clone(),
        owner_id: owner_id.clone()
    };
    let session_key = get_session_key(password_hash, &service_settings.salt)?;
    let client = reqwest::Client::new();
    let url = format!("{}/api/records/{}", service_settings.url, session_key);
    let response = match client.post(url)
                    .header("Plauzible-API-Key", service_settings.key)
                    .header("Content-Type", "application/json")
                    .body(json::stringify(data))
                    .send()
                    .await {
                        Ok(response) => response,
                        Err(error) => {
                            return Err(format!("Failed to send request to the remote service. Cause: {:?}", error))
                        }
                    };

    if !response.status().is_success() {
        return Err("Remote service returned an error, service may be offline.".to_string());
    }

    let body = match response.text().await {
        Ok(body) => body,
        Err(error) => {
            return Err(format!("Failed to retrieve response from the remote service. Cause: {:?}", error))
        }
    };

    let json = match json::parse(&body) {
        Ok(value) => value,
        Err(error) => {
            return Err(format!("Failed to parse response from the remote service. Cause: {:?}", error))
        }
    };

    if !json.is_object() {
        return Err(format!("The response from the remote service is not a valid JSON object."));
    }

    if json.has_key("error") {
        return Err(json["error"].as_str().unwrap_or("Unknown error.").to_string());
    }

    let record_id;
    if json.has_key("id") {
        record_id = json["id"].as_i64().unwrap_or(-1);
    } else {
        return Err(format!("The response from the remote service does not contain an 'id' key."));
    }

    let object = object! {
        id: record_id,
        data: record_data,
        hasURL: has_url,
        name: name
    };

    Ok(json::stringify(object))
}


/// Deletes a record in the remote service.
pub async fn delete_remote_record(handle: &AppHandle, password_hash: &str, record_json: &str, record_id: i64) -> Result<i64, String> {
    let settings = get_service_settings(handle).await?;
    let json = match json::parse(&record_json) {
        Ok(value) => value,
        Err(error) => {
            return Err(format!(
                "Failed to parse record value into JSON object. Cause: {:?}",
                error
            ))
        }
    };

    let decrypted_record = match utilities::decrypt(password_hash, &settings.nonce, &json["data"].as_str().unwrap_or("")).await {
        Some(decrypted_record) => decrypted_record,
        _ => return Err(format!("Failed to decrypt record string."))
    };

    let decrypted_json = match json::parse(&decrypted_record) {
        Ok(value) => value,
        Err(error) => {
            return Err(format!("Failed to parse decrypted record string into JSON object. Cause: {:?}", error))
        }
    };

    let owner_id: String;
    if decrypted_json.has_key("plauzible") && decrypted_json["plauzible"].is_object() && decrypted_json["plauzible"].has_key("ownerId") && decrypted_json["plauzible"]["ownerId"].is_string() {
        owner_id = decrypted_json["plauzible"]["ownerId"].as_str().unwrap_or("").to_string();
    } else {
        return Err(format!("The record to be deleted is not correctly formatted."));
    }

    // Request the record deletion from the remote service.
    let data = object! {
        owner_id: owner_id
    };
    let session_key = get_session_key(password_hash, &settings.salt)?;
    let client = reqwest::Client::new();
    let url = format!("{}/api/records/{}/{}", settings.url, session_key, record_id);
    let response = match client.delete(url)
                   .header("Plauzible-API-Key", settings.key)
                   .header("Content-Type", "application/json")
                   .body(json::stringify(data))
                   .send()
                   .await {
                        Ok(response) => response,
                        Err(error) => {
                            return Err(format!("Failed to send request to the remote service. Cause: {:?}", error))
                        }
                    };

    if !response.status().is_success() {
        return Err("Failed to delete the record in the remote service.".to_string());
    }
 
    Ok(record_id)
}

/// Retrieves a collection of records from the remote service for the current
/// session key.
pub async fn get_remote_records(handle: &AppHandle, password_hash: &str) -> Result<String, String> {
    let settings = get_service_settings(handle).await?;
    let session_key = get_session_key(password_hash, &settings.salt)?;
    let client = reqwest::Client::new();
    let url = format!("{}/api/records/{}", settings.url, session_key);
    let response = match client.get(url)
                   .header("Plauzible-API-Key", settings.key)
                   .header("Content-Type", "application/json")
                   .send()
                   .await {
                        Ok(response) => response,
                        Err(error) => {
                            return Err(format!("Failed to send request to the remote service. Cause: {:?}", error))
                        }
                    };

    if !response.status().is_success() {
        return Err("Remote service returned an error, service may be offline.".to_string());
    }

    let body = match response.text().await {
        Ok(body) => body,
        Err(error) => {
            return Err(format!("Failed to retrieve response from the remote service. Cause: {:?}", error))
        }
    };

    let json = match json::parse(&body) {
        Ok(value) => value,
        Err(error) => {
            return Err(format!("Failed to parse response from the remote service. Cause: {:?}", error))
        }
    };

    if !json.is_object() {
        return Err(format!("The response from the remote service is not a valid JSON object."));
    }

    if json.has_key("error") {
        return Err(json["error"].as_str().unwrap_or("Unknown error.").to_string());
    }

    // Decrypt the record data and store the results in an array.
    let mut objects = json::JsonValue::new_array();
    for record in json["records"].members() {
        let record_id = record["id"].as_i64().unwrap_or(0);
        let record_data = record["data"].as_str().unwrap_or("");

        match utilities::decrypt(password_hash, &settings.nonce, &record["data"].as_str().unwrap_or("")).await {
            Some(json_data) => {
                match json::parse(&json_data) {
                    Ok(content) => {
                        let url = match content["url"].is_string() {
                            true => content["url"]
                                .as_str()
                                .expect("URL string extraction failed."),
                            _ => "",
                        };

                        match objects.push(object! {
                            data: record_data,
                            id: record_id,
                            tags: content["tags"].clone(),
                            hasURL: url.trim() != "",
                            name: content["name"].clone()
                        }) {
                            Err(error) => {
                                return Err(format!("Failed to store record data. Cause: {:?}", error))
                            }
                            _ => {}
                        };
                    },
                    Err(error) => {
                        return Err(format!("Failed to parse decrypted record content as a JSON object. Cause: {:?}", error))
                    }
                }
            },
            _ => {}
        }
    }

    Ok(json::stringify(objects))
}

/// Retrieves a collection of the various settings from the application database
/// that will be need to interact with the remote service.
async fn get_service_settings(handle: &AppHandle) -> Result<ServiceSettings, String> {
    let mut pool = database::connect_to_database(handle).await?;
    let nonce = database::get_setting(&mut pool, "encryption.nonce").await?;
    let service_key = database::get_setting(&mut pool, "service.key").await?;
    let service_url = database::get_setting(&mut pool, "service.url").await?;
    let salt = database::get_setting(&mut pool, "encryption.salt").await?;

    Ok(ServiceSettings {
        key: service_key.value,
        url: service_url.value,
        salt: salt.value,
        nonce: nonce.value,
    })
}

/// The 'session key' is a v5 UUID derived from the password hash and the salt.
/// The key is used in the storage of record by the remote service.
pub fn get_session_key(password_hash: &str, salt: &str) -> Result<String, String> {
    let session_input = format!("{}{}", password_hash, salt);

    Ok(Uuid::new_v5(&Uuid::NAMESPACE_URL, session_input.as_bytes()).to_string())
}

/// Updates a record in the remote service.
pub async fn update_remote_record(handle: &AppHandle, password_hash: &str, record_id: i64, record_json: &str) -> Result<String, String> {
    let settings = get_service_settings(handle).await?;
    let json = match json::parse(&record_json) {
        Ok(value) => value,
        Err(error) => {
            return Err(format!(
                "Failed to parse record value into JSON object. Cause: {:?}",
                error
            ))
        }
    };

    let owner_id: String;
    if json.has_key("plauzible") && json["plauzible"].is_object() && json["plauzible"].has_key("ownerId") && json["plauzible"]["ownerId"].is_string() {
        owner_id = json["plauzible"]["ownerId"].as_str().unwrap_or("").to_string();
    } else {
        return Err(format!("The record to be updated is not correctly formatted."));
    }

    // Encrypt the record and send it to the remote service.
    let encrypted_data = utilities::encrypt(password_hash, &settings.nonce, &json::stringify(json.clone())).await?;
    let data = object! {
        data: encrypted_data.clone(),
        owner_id: owner_id
    };
    let session_key = get_session_key(password_hash, &settings.salt)?;
    let client = reqwest::Client::new();
    let url = format!("{}/api/records/{}/{}", settings.url, session_key, record_id);
    let response = match client.put(url)
                   .header("Plauzible-API-Key", settings.key)
                   .header("Content-Type", "application/json")
                   .body(json::stringify(data))
                   .send()
                   .await {
                        Ok(response) => response,
                        Err(error) => {
                            return Err(format!("Failed to send request to the remote service. Cause: {:?}", error))
                        }
                    };

    if !response.status().is_success() {
        return Err("Failed to update the record in the remote service.".to_string());
    }
 
    let object = object! {
        id: record_id,
        data: encrypted_data,
        hasURL: json["url"].is_string() && json["url"].as_str().unwrap_or("").trim() != "",
        name: json["name"].as_str().unwrap_or("").to_string()
    };
  

    Ok(json::stringify(object))
}