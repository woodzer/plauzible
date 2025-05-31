mod database;
mod utilities;

#[tauri::command]
pub fn delete_database() -> Result<(), String> {
    database::remove_existing_database()
}

#[tauri::command]
pub async fn delete_record(record_id: i64) -> Result<i64, String> {
    database::delete_record_by_id(record_id).await
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
    let json = match json::parse(&record) {
        Ok(value) => value,
        Err(error) => return Err(format!("Failed to parse record value into JSON object. Cause: {:?}", error))
    };
    let mut pool = database::connect_to_database().await?;
    let nonce_hex = database::get_nonce_string(&mut pool).await?;
    let data = utilities::encrypt(&password_hash_hex, &nonce_hex, &record).await?;

    let mut transaction = match pool.begin().await {
        Ok(t) => t,
        Err(error) => return Err(format!("Failed to create a database transaction. Cause: {:?}", error))
    };
    let record_id = database::write_record_in_transaction(&mut transaction, &data).await?;

    let mut minimum = 0_u8;
    let maximum = 5_u8;
    let total_records = database::count_total_records(&mut pool).await?;

    if total_records == 0 {
        minimum = maximum;
    }

    for record in utilities::generate_fake_records(record.len() as i64, minimum, maximum) {
        let hashed_password = hash_password(record.salt).await?;
        let encrypted_data = utilities::encrypt(&hashed_password, &record.nonce, &record.data).await?;
        database::write_record_in_transaction(&mut transaction, &encrypted_data).await?;
    }

    match transaction.commit().await {
        Err(error) => return Err(format!("Error committing database transaction. Cause: {:?}", error)),
        _ => ()
    };
    
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
