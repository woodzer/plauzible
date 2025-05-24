use std::str;
use aes_gcm::{
    aead::{Aead, AeadCore, OsRng},
    Aes256Gcm,
    Key,
    KeyInit,
    Nonce
};
use argon2::{Argon2, password_hash::SaltString};
use aes::cipher::generic_array::GenericArray;
use hex;

/// Takes the application salt, nonce and user password and attempts to
/// decrypt data specified as a hexidecimal string. Returns an Option that will
/// either contain the decrypted data as a String or None if decrypt fails for
/// any reason.
pub async fn decrypt(password_hash: &str, nonce_hex: &str, data: &str) -> Option<String> {
    let hash_bytes = match hex::decode(password_hash) {
        Ok(bytes) => bytes,
        Err(message) => {
            println!("{}", message);
            return None
        }
    };
    let key = Key::<Aes256Gcm>::from_slice(&hash_bytes);
    let cipher = Aes256Gcm::new(&key);
    let nonce_bytes = match hex::decode(nonce_hex) {
        Ok(bytes) => bytes,
        Err(error) => {
            println!("{}", format!("Failed to convert nonce to bytes. Cause: {:?}", error));
            return None;
        }
    };
    let nonce: &GenericArray::<u8, typenum::U12> = Nonce::from_slice(nonce_bytes.as_slice());
    let cipher_data: &[u8] = &match hex::decode(data) {
        Ok(bytes) => bytes,
        Err(error) => {
            println!("{}", format!("Failed to convert data from hex format. Cause: {:?}", error));
            return None;
        }
    };

    match cipher.decrypt(&nonce, cipher_data) {
        Ok(bytes) => {
            match str::from_utf8(bytes.as_slice()) {
                Ok(string) => Some(string.to_string()),
                Err(error) => {
                    println!("{}", format!("Decrypt data is not a valid string. Cause: {:?}", error));
                    None
                }
            }
        },
        Err(error) => {
            println!("{}", format!("Failed to decrypt data string. Cause: {:?}", error));
            None
        }
    }
}

/// Takes the application salt, nonce and user password and attempts to
/// encrypt data specified as a string. Returns a Result. On success the
/// result will contain a hexidecimal representation of the encrypted
/// form of the data.
pub async fn encrypt(password_hash_hex: &str, nonce_hex: &str, clear_text: &str) -> Result<String, String> {
    let hash_bytes = match hex::decode(password_hash_hex) {
        Ok(bytes) => bytes,
        Err(error) => return Err(format!("Error decoding password hash. Cause: {:?}", error))
    };
    let key = Key::<Aes256Gcm>::from_slice(&hash_bytes);
    let cipher = Aes256Gcm::new(&key);
    let nonce_bytes = match hex::decode(nonce_hex) {
        Ok(bytes) => bytes,
        Err(error) => return Err(format!("Failed to convert nonce to bytes. Cause: {:?}", error))
    };
    let nonce = Nonce::from_slice(nonce_bytes.as_slice());

    match cipher.encrypt(&nonce, clear_text.as_bytes()) {
        Ok(bytes) => Ok(hex::encode(bytes)),
        Err(error) => Err(format!("Failed to encrypt data string. Cause: {:?}", error))
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
        Err(error) => Err(format!("Failed to generate password hash. Cause: {:?}", error))
    }
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
pub fn validate_service_key(service_key: &str) -> Result<(), String> {
    if service_key.len() > 0 {
        Err("Service key validation has not yet been implemented.".to_string())
    } else {
        Ok(())
    }
}
