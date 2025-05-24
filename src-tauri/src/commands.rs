mod database;
mod utilities;

#[tauri::command]
pub fn delete_database() -> Result<(), String> {
    database::remove_existing_database()
}

#[tauri::command]
pub async fn decrypt_record(password_hash: String, record: String) -> Result<String, String> {
    let mut pool = database::connect_to_database().await?;
    let nonce_hex = database::get_nonce_string(&mut pool).await?;
    match utilities::decrypt(&password_hash, &nonce_hex, &record).await {
        Some(clear_text) => Ok(clear_text),
        _ => Err("Failed to decrypt record string.".to_string())
    }
}

#[tauri::command]
pub fn get_database_path() -> String {
    match database::get_existing_database_path() {
        Some(path) => path,
        _ => String::from("")
    }
}

#[tauri::command]
pub async fn get_records_for_password(password_hash: String) -> Result<String, String> {
    database::get_local_records(&password_hash).await
}

/// This function attempts to determine whether the application has been
/// previously initialized.
#[tauri::command]
pub fn has_been_initialized() -> bool {
    match database::get_existing_database_path() {
        Some(_) => true,
        _ => false
    }
}

#[tauri::command]
pub async fn hash_password(password: String) -> Result<String, String> {
    let mut pool = database::connect_to_database().await?;
    let salt_setting = database::get_salt_string(&mut pool).await?;
    match utilities::generate_password_hash(&salt_setting, &password) {
        Ok(bytes) => Ok(hex::encode(bytes)),
        Err(message) => Err(message)
    }
}

#[tauri::command]
pub fn initialize_application(salt: String, service_key: String) -> Result<String, String> {
    let final_salt = match utilities::validate_salt(&salt) {
        Ok(value) => value,
        Err(message) => return Err(message),
    };
    let nonce = utilities::generate_nonce();

    utilities::validate_service_key(&service_key)?;

    match database::create_database() {
        Ok(database_path) => {
            let response = object! {
                database: database_path,
                nonce: nonce,
                salt: final_salt,
                serviceKey: service_key
            };
            Ok(response.dump())
        }
        Err(message) => Err(message),
    }
}

#[tauri::command]
pub async fn store_record(password_hash_hex: String, record: String) -> Result<String, String> {
    let mut pool = database::connect_to_database().await?;
    let json = match json::parse(&record) {
        Ok(value) => value,
        Err(error) => return Err(format!("Failed to parse record value into JSON object. Cause: {:?}", error))
    };
    let nonce_hex = database::get_nonce_string(&mut pool).await?;
    let data = utilities::encrypt(&password_hash_hex, &nonce_hex, &record).await?;
    let record_id = database::write_record(&data).await?;
    let url = match json["url"].is_string() {
        true => json["url"].as_str().expect("URL string extraction failed."),
        _ => ""
    };
    let object = object!{
        id: record_id,
        data: data,
        hasURL: url.trim() != "",
        name: json["name"].clone()
    };

    Ok(json::stringify(object))
}
