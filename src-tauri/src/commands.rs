mod database;
mod migrations;
mod rest_api;
mod utilities;

use std::hash::{DefaultHasher, Hash};
use std::path::Path;
use std::fs;
use json::JsonValue;
use rand::prelude::*;
use uuid::Uuid;

#[tauri::command]
pub async fn delete_database(handle: tauri::AppHandle) -> Result<(), String> {
    let path = migrations::get_database_path(&handle).await?;
    match fs::remove_file(path) {
        Ok(_) => Ok(()),
        Err(error) => Err(format!("Failed to remove database file. Cause: {:?}", error))
    }
}

#[tauri::command]
pub async fn decrypt_record(handle: tauri::AppHandle, password_hash: String, record: String) -> Result<String, String> {
    let mut pool = database::connect_to_database(&handle).await?;
    let nonce_hex = database::get_nonce_string(&mut pool).await?;
    match utilities::decrypt(&password_hash, &nonce_hex, &record).await {
        Some(clear_text) => Ok(clear_text),
        _ => Err("Failed to decrypt record string.".to_string()),
    }
}

#[tauri::command]
pub async fn delete_record(handle: tauri::AppHandle, record_id: i64) -> Result<i64, String> {
    database::delete_record_by_id(&handle, record_id).await
}

#[tauri::command]
pub async fn delete_remote_record(handle: tauri::AppHandle, password_hash: String, record: String, record_id: i64) -> Result<i64, String> {
    rest_api::delete_remote_record(&handle, &password_hash, &record, record_id).await
}

#[tauri::command]
pub fn get_database_path(handle: tauri::AppHandle) -> String {
    match database::get_existing_database_path(&handle) {
        Some(path) => path,
        _ => String::from(""),
    }
}

#[tauri::command]
pub async fn get_application_settings(handle: tauri::AppHandle) -> Result<String, String> {
    let settings = object! {
        operationMode: utilities::get_operation_mode(&handle).await?,
        serviceURL: utilities::get_service_url(&handle).await?,
        termsAccepted: utilities::get_terms_accepted(&handle).await?,
        termsRemoted: utilities::get_terms_remoted(&handle).await?
    };
    Ok(settings.dump())
}

#[tauri::command]
pub async fn get_sensitive_settings(handle: tauri::AppHandle) -> Result<String, String> {
    let mut pool = database::connect_to_database(&handle).await?;
    let records = database::get_all_sensitive_settings(&mut pool).await?;
    let mut array = JsonValue::new_array();

    for record in records {
        let object = object! {
            id: record.id,
            key: record.key,
            value: record.value
        };
        match array.push(object) {
            Err(error) => {
                return Err(format!(
                    "Failed to store JSON object into array. Cause: {:?}",
                    error
                ))
            }
            _ => (),
        };
    }

    Ok(json::stringify(array))
}

#[tauri::command]
pub async fn get_standard_settings(handle: tauri::AppHandle) -> Result<String, String> {
    let mut pool = database::connect_to_database(&handle).await?;
    let records = database::get_all_standard_settings(&mut pool).await?;
    let mut array = JsonValue::new_array();

    for record in records {
        let object = object! {
            id: record.id,
            key: record.key,
            value: record.value
        };
        match array.push(object) {
            Err(error) => {
                return Err(format!(
                    "Failed to store JSON object into array. Cause: {:?}",
                    error
                ))
            }
            _ => (),
        };
    }

    Ok(json::stringify(array))
}

#[tauri::command]
pub async fn get_local_records_for_password(handle: tauri::AppHandle, password_hash: String) -> Result<String, String> {
    database::get_local_records(&handle, &password_hash).await
}

#[tauri::command]
pub async fn get_remote_records_for_password(handle: tauri::AppHandle, password_hash: String) -> Result<String, String> {
    rest_api::get_remote_records(&handle, &password_hash).await
}

/// This function attempts to determine whether the application has been
/// previously initialized.
#[tauri::command]
pub async fn has_been_initialized(handle: tauri::AppHandle) -> bool {
    match migrations::get_database_path(&handle).await {
        Ok(path) => Path::new(&path).exists(),
        _ => false,
    }
}

#[tauri::command]
pub async fn hash_password(handle: tauri::AppHandle, password: String) -> Result<String, String> {
    let mut pool = database::connect_to_database(&handle).await?;
    let salt_setting = database::get_salt_string(&mut pool).await?;
    match utilities::generate_password_hash(&salt_setting, &password) {
        Ok(bytes) => Ok(hex::encode(bytes)),
        Err(message) => Err(message),
    }
}

#[tauri::command]
pub async fn initialize_application(handle: tauri::AppHandle, salt: String) -> Result<String, String> {
    migrations::run_migrations(&handle).await?;
    let database_path = migrations::get_database_path(&handle).await?;
    let final_salt = utilities::validate_salt(&salt)?;
    let nonce = utilities::generate_nonce();
    let response = object! {
        database: database_path,
        nonce: nonce,
        salt: final_salt,
        serviceKey: "".to_string()
    };
    Ok(response.dump())
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    let _ = open::that(url).map_err(|error| format!("Failed to open URL. Cause: {:?}", error));
    Ok(())
}

#[tauri::command]
pub async fn select_random_characters(text: String, length: i32) -> Result<String, String> {
    let mut rng = rand::rng();
    let mut output = String::new();

    for _ in 0..length {
        output.push(text.chars().choose(&mut rng).unwrap());
    }

    Ok(output)
}

#[tauri::command]
pub async fn store_record(handle: tauri::AppHandle, password_hash_hex: String, record: String) -> Result<String, String> {
    let mut json = match json::parse(&record) {
        Ok(value) => value,
        Err(error) => {
            return Err(format!(
                "Failed to parse record value into JSON object. Cause: {:?}",
                error
            ))
        }
    };
    json["plauzible"] = JsonValue::new_object();
    json["plauzible"]["ownerId"] = JsonValue::String(Uuid::new_v4().to_string());

    let record = json::stringify(json.clone());

    let mut pool = database::connect_to_database(&handle).await?;
    let nonce_hex = database::get_nonce_string(&mut pool).await?;
    let data = utilities::encrypt(&password_hash_hex, &nonce_hex, &record).await?;
    let mut records = Vec::new();
    let mut hasher = DefaultHasher::new();
    let real_hash = data.hash(&mut hasher);

    records.push(data.clone());

    let mut minimum = 0_u8;
    let maximum = 5_u8;
    let total_records = database::count_total_records(&mut pool).await?;

    if total_records == 0 {
        minimum = maximum;
    }

    for record in utilities::generate_fake_records(record.len() as i64, minimum, maximum) {
        let hashed_password = hash_password(handle.clone(), record.salt).await?;
        let encrypted_data =
            utilities::encrypt(&hashed_password, &record.nonce, &record.data).await?;
        records.push(encrypted_data);
    }

    let mut transaction = match pool.begin().await {
        Ok(t) => t,
        Err(error) => {
            return Err(format!(
                "Failed to create a database transaction. Cause: {:?}",
                error
            ))
        }
    };

    let mut record_id = 0_i64;
    records = utilities::shuffle_vec(&records);
    for record in records {
        let id = database::write_record_in_transaction(&mut transaction, &record).await?;
        if record.hash(&mut hasher) == real_hash {
            record_id = id;
        }
    }

    match transaction.commit().await {
        Err(error) => {
            return Err(format!(
                "Error committing database transaction. Cause: {:?}",
                error
            ))
        }
        _ => (),
    };

    let url = match json["url"].is_string() {
        true => json["url"].as_str().expect("URL string extraction failed."),
        _ => "",
    };
    let object = object! {
        id: record_id,
        data: data,
        hasURL: url.trim() != "",
        name: json["name"].clone()
    };

    Ok(json::stringify(object))
}

#[tauri::command]
pub async fn store_remote_record(handle: tauri::AppHandle, password_hash: String, record: String) -> Result<String, String> {
    match rest_api::create_remote_record(&handle, &password_hash, &record).await {
        Ok(output) =>  Ok(output),
        Err(error) => Err(error),
    }
}

#[tauri::command]
pub async fn terms_accepted(handle: tauri::AppHandle) -> Result<String, String> {
    utilities::record_terms_accepted(&handle).await
}

#[tauri::command]
pub async fn update_record(
    handle: tauri::AppHandle,
    password_hash_hex: String,
    record_id: i64,
    record: String,
) -> Result<String, String> {
    let json = match json::parse(&record) {
        Ok(value) => value,
        Err(error) => {
            return Err(format!(
                "Failed to parse record value into JSON object. Cause: {:?}",
                error
            ))
        }
    };
    let mut pool = database::connect_to_database(&handle).await?;
    let nonce_hex = database::get_nonce_string(&mut pool).await?;
    let data = utilities::encrypt(&password_hash_hex, &nonce_hex, &record).await?;

    database::update_record_by_id(&mut pool, record_id, &data).await?;

    let url = match json["url"].is_string() {
        true => json["url"].as_str().expect("URL string extraction failed."),
        _ => "",
    };

    let object = object! {
        id: record_id,
        data: data,
        hasURL: url.trim() != "",
        name: json["name"].clone()
    };

    Ok(json::stringify(object))
}

#[tauri::command]
pub async fn update_remote_record(handle: tauri::AppHandle, password_hash: String, record_id: i64, record: String) -> Result<String, String> {
    match rest_api::update_remote_record(&handle, &password_hash, record_id, &record).await {
        Ok(output) => Ok(output),
        Err(error) => Err(error),
    }
}

#[tauri::command]
pub async fn update_password_generator_settings(
    handle: tauri::AppHandle,
    password_length: i64,
    default_character_set: String,
) -> Result<(), String> {
    let mut pool = database::connect_to_database(&handle).await?;
    database::update_setting_by_name(&mut pool, "password.length", &password_length.to_string())
        .await?;
    database::update_setting_by_name(&mut pool, "password.character_set", &default_character_set)
        .await?;
    Ok(())
}

#[tauri::command]
pub async fn update_remote_service_settings(
    handle: tauri::AppHandle,
    service_key: String,
    service_url: String,
) -> Result<(), String> {
    let mut pool = database::connect_to_database(&handle).await?;
    database::update_setting_by_name(&mut pool, "service.key", &service_key).await?;
    database::update_setting_by_name(&mut pool, "service.url", &service_url).await?;
    Ok(())
}

#[tauri::command]
pub async fn update_sensitive_settings(handle: tauri::AppHandle, encryption_settings: String) -> Result<(), String> {
    let parts = encryption_settings.split(":").collect::<Vec<&str>>();
    if parts.len() != 2 {
        return Err("Invalid encryption settings format.".to_string());
    }

    let mut pool = database::connect_to_database(&handle).await?;
    database::update_setting_by_name(&mut pool, "encryption.salt", parts[0]).await?;
    database::update_setting_by_name(&mut pool, "encryption.nonce", parts[1]).await?;
    Ok(())
}
