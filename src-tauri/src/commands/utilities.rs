use aes::cipher::generic_array::GenericArray;
use aes_gcm::{
    aead::{Aead, AeadCore, OsRng},
    Aes256Gcm, Key, KeyInit, Nonce,
};
use argon2::{password_hash::SaltString, Argon2};
use directories::{ProjectDirs};
use std::fs::{create_dir_all};
use std::path::PathBuf;
use hex;
use rand::prelude::*;
use std::str;
use crate::commands::database;

pub struct FakeRecord {
    pub data: String,
    pub nonce: String,
    pub salt: String,
}

/// This function generates a PathBuf representing the application data directory.
pub fn get_application_data_directory() -> Result<PathBuf, String> {
    let project_dirs = ProjectDirs::from("com.plauzible", "plauzible", "plauzible").unwrap();
    let data_dir = project_dirs.data_dir();
    Ok(data_dir.to_path_buf())
}

/// This function generates a PathBuf representing the application data directory.
/// If the directory does not exist then an attempt is made to create it.
pub fn get_or_create_application_data_directory() -> Result<PathBuf, String> {
    let data_dir = get_application_data_directory()?;

    if !data_dir.exists() {
        match create_dir_all(&data_dir) {
            Err(error) => Err(format!("Failed to create application data directory. Cause: {:?}", error)),
            _ => Ok(data_dir.to_path_buf())
        }
    } else {
        Ok(data_dir.to_path_buf())
    }
}

/// Takes the application salt, nonce and user password and attempts to
/// decrypt data specified as a hexidecimal string. Returns an Option that will
/// either contain the decrypted data as a String or None if decrypt fails for
/// any reason.
pub async fn decrypt(password_hash: &str, nonce_hex: &str, data: &str) -> Option<String> {
    let hash_bytes = match hex::decode(password_hash) {
        Ok(bytes) => bytes,
        Err(_) => {
            // Decoding of password hash from hex to bytes failed.
            return None;
        }
    };
    let key = Key::<Aes256Gcm>::from_slice(&hash_bytes);
    let cipher = Aes256Gcm::new(&key);
    let nonce_bytes = match hex::decode(nonce_hex) {
        Ok(bytes) => bytes,
        Err(_) => {
            // Conversion of nonce from hex to bytes failed.
            return None;
        }
    };
    let nonce: &GenericArray<u8, typenum::U12> = Nonce::from_slice(nonce_bytes.as_slice());
    let cipher_data: &[u8] = &match hex::decode(data) {
        Ok(bytes) => bytes,
        Err(_) => {
            // Conversion of encrypted data from hex to bytes failed.
            return None;
        }
    };

    match cipher.decrypt(&nonce, cipher_data) {
        Ok(bytes) => {
            match str::from_utf8(bytes.as_slice()) {
                Ok(string) => Some(string.to_string()),
                Err(_) => {
                    // Decrypted data is not a valid string.
                    None
                }
            }
        }
        Err(_) => {
            // Decryption was unsuccessful.
            None
        }
    }
}

/// Takes the application salt, nonce and user password and attempts to
/// encrypt data specified as a string. Returns a Result. On success the
/// result will contain a hexidecimal representation of the encrypted
/// form of the data.
pub async fn encrypt(
    password_hash_hex: &str,
    nonce_hex: &str,
    clear_text: &str,
) -> Result<String, String> {
    let hash_bytes = match hex::decode(password_hash_hex) {
        Ok(bytes) => bytes,
        Err(error) => return Err(format!("Error decoding password hash. Cause: {:?}", error)),
    };
    let key = Key::<Aes256Gcm>::from_slice(&hash_bytes);
    let cipher = Aes256Gcm::new(&key);
    let nonce_bytes = match hex::decode(nonce_hex) {
        Ok(bytes) => bytes,
        Err(error) => {
            return Err(format!(
                "Failed to convert nonce to bytes. Cause: {:?}",
                error
            ))
        }
    };
    let nonce = Nonce::from_slice(nonce_bytes.as_slice());

    match cipher.encrypt(&nonce, clear_text.as_bytes()) {
        Ok(bytes) => Ok(hex::encode(bytes)),
        Err(error) => Err(format!("Failed to encrypt data string. Cause: {:?}", error)),
    }
}

/// Generates a hash of the password suitable for use in generating an encryption
/// key. Returns a Vec<u8> containing the hash on success.
pub fn generate_password_hash<'a>(salt_b64: &'a str, password: &'a str) -> Result<Vec<u8>, String> {
    let full_password = format!("{}-{}", salt_b64, password);
    let argon2 = Argon2::default();
    let mut bytes = [0u8; 32];

    match argon2.hash_password_into(full_password.as_bytes(), salt_b64.as_bytes(), &mut bytes) {
        Ok(_) => Ok(bytes.to_vec()),
        Err(error) => Err(format!(
            "Failed to generate password hash. Cause: {:?}",
            error
        )),
    }
}

/// This function generates a random number of strings containing fake record
/// data that can be used to create fake records. A base size for the data must
/// be specified. The variation value should be a percentage will be used to
/// alter the size of values generated based on the base size. The strings
/// generated will vary in size from variation percent smaller to variation
/// percent larger. The minimum specifies the minimum number of strings to
/// be generated and maximum is the maximum number of strings to be generated.
/// The actual number generated will be somewhere between these two figures.
pub fn generate_fake_record_data(
    base_size: i64,
    variation: f64,
    minimum: u8,
    maximum: u8,
) -> Vec<String> {
    let mut strings = Vec::new();
    let mut total_strings = maximum;
    let mut generator = rand::rng();

    if minimum != maximum {
        total_strings = generator.random_range(minimum..=maximum);
    }

    while total_strings > 0 {
        let size_factor = 1.0_f64 + generator.random_range(-variation..=variation);
        let actual_size = ((base_size as f64 * size_factor) as i64) as usize;

        strings.push(
            (&mut generator)
                .sample_iter(rand::distr::Alphanumeric)
                .take(actual_size)
                .map(char::from)
                .collect(),
        );
        total_strings = total_strings - 1;
    }

    strings
}

/// This function generates a collection of FakeRecord instances representing
/// the data for fake records that are going to be inserted into the database
/// along with a real record.
pub fn generate_fake_records(base_size: i64, minimum: u8, maximum: u8) -> Vec<FakeRecord> {
    let mut records = Vec::new();

    for data in generate_fake_record_data(base_size, 0.1_f64, minimum, maximum) {
        records.push(FakeRecord {
            data: data,
            nonce: generate_nonce(),
            salt: generate_salt(),
        });
    }

    records
}

/// Generate a nonce value use the AES GCM library. Returns the nonce as a
/// hexidecimal string.
pub fn generate_nonce() -> String {
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    hex::encode(nonce.as_slice())
}

/// Generates a random salt value using the Argon2 library. Returns the salt as
/// a hexidecimal string.
fn generate_salt() -> String {
    let salt = SaltString::generate(&mut OsRng);
    hex::encode(salt.as_str().as_bytes())
}

/// Determines the operation mode of the application based on whether a service
/// key setting is present in the database. Returns a Result. On success the
/// success the result will contain a String indicating the operation mode.
/// The operation mode can be either "local" or "remote".
pub async fn get_operation_mode() -> Result<String, String> {
    let mut pool = database::connect_to_database().await?;
    let setting = database::get_setting(&mut pool, "service.key").await?;
    match setting.value.trim() {
        "" => Ok("local".to_string()),
        _ => Ok("remote".to_string())
    }
}

/// Returns the URL of the remote service. Returns a Result. On success the
/// result will contain a string value that will be the URL of the remote service.
pub async fn get_service_url() -> Result<String, String> {
    let mut pool = database::connect_to_database().await?;
    let setting = database::get_setting_or_default(&mut pool, "service.url", "https://plauzible.com").await?;
    Ok(setting.value)
}

/// Returns a boolean value indicating whether the terms of service have been
/// accepted by the user. Returns a Result. On success the result will contain
/// a string value that will be either "true" or "false" to indicate whether the
/// terms have been accepted.
pub async fn get_terms_accepted() -> Result<String, String> {
    let mut pool = database::connect_to_database().await?;
    let setting = database::get_setting_or_default(&mut pool, "terms.accepted", "false").await?;
    Ok(setting.value)
}

/// Returns a boolean value indicating whether the terms of service have been
/// dispatched and recorded on the remote service. Returns a Result. On success
/// the result will contain a string value that will be either "true" or "false"
/// to indicate whether the terms have been accepted.
pub async fn get_terms_remoted() -> Result<String, String> {
    let mut pool = database::connect_to_database().await?;
    let setting = database::get_setting_or_default(&mut pool, "terms.remoted", "false").await?;
    Ok(setting.value)
}

/// Records the terms of service acceptance in the database and, if possible,
/// with the remote service. On success the result will contain a string value
/// that will be either "true" or "false" to indicate whether the terms have
/// been accepted.
pub async fn record_terms_accepted() -> Result<String, String> {
    let mut pool = database::connect_to_database().await?;
    let client = reqwest::Client::new();
    let mut timestamp = chrono::Utc::now().timestamp();
    let data = object! {
        timestamp: timestamp
    };
    let service_url = database::get_setting_or_default(&mut pool, "service.url", "https://plauzible.com").await?.value;
    let service_key = database::get_setting_or_default(&mut pool, "service.key", "").await?.value;
    let terms_accepted = database::get_setting_or_default(&mut pool, "terms.accepted", "false").await?.value;
    let terms_remoted = database::get_setting_or_default(&mut pool, "terms.remoted", "false").await?.value;

    if terms_accepted != "false" {
        timestamp = match terms_accepted.parse::<i64>() {
            Ok(accepted) => {
                match chrono::DateTime::<chrono::Utc>::from_timestamp(accepted, 0) {
                    Some(date) => date.timestamp(),
                    None => timestamp
                }
            },
            _ => timestamp
        };
    }

    if service_key.len() > 0 && terms_remoted == "false" {
        match client.post(format!("{}/api/terms/accept", service_url))
            .header("Plauzible-API-Key", service_key)
            .header("Content-Type", "application/json")
            .body(data.dump())
            .send()
            .await {
                Ok(response) => {
                    if response.status().is_success() {
                        database::create_setting(&mut pool, "terms.remoted", "true").await?;
                        if terms_accepted == "false" {
                            database::create_setting(&mut pool, "terms.accepted", format!("{}", timestamp).as_str()).await?;
                        }
                    }
                    Ok("true".to_string())
                },
                Err(error) => {
                    Err(format!("Failed to send request to the remote service. Cause: {:?}", error))
                }
            }
    } else {
        database::create_setting(&mut pool, "terms.remoted", "false").await?;
        database::create_setting(&mut pool, "terms.accepted", format!("{}", timestamp).as_str()).await?;
        Ok("true".to_string())
    }
}

/// Validates a string containing a salt value. Salt values must be 44 characters
/// long and be a valid hexidecimal value.
pub fn validate_salt(salt: &str) -> Result<String, String> {
    let mut value = salt.to_string();

    if value.len() == 0 {
        value = generate_salt();
    }

    if value.len() == 44 {
        match hex::decode(salt) {
            Ok(_) => Ok(value),
            Err(_) => {
                Err("Invalid salt value. The salt must be a valid hexidecimal string.".to_string())
            }
        }
    } else {
        Err("Invalid salt value. The value provided is not the correct length.".to_string())
    }
}

/// Validates a service key. This id done by dispatch a request to the
/// configured service provider and ensuring that we get a successful
/// response to the request.
pub fn validate_service_key(_service_key: &str) -> Result<(), String> {
    // TBD: Implement service key validation.
    Ok(())
}
