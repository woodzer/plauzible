use std::env;
use std::fs;
use std::path::PathBuf;
use std::str;
use json;
use sqlx::{Pool, Row};
use sqlx::sqlite::{Sqlite, SqliteConnectOptions, SqlitePool};

use crate::commands::utilities;

const CREATE_RECORD_SQL: &str = "insert into data_records(data) values ($1) returning id";
const DELETE_RECORD_SQL: &str = "delete from data_records where id = ?";
const FETCH_RECORD_SQL: &str = "select id, data from data_records";
const FETCH_SETTING_SQL: &str = "select id, key, value from settings where key = ?";

#[derive(sqlx::FromRow)]
pub struct DataRecord {id: i64, data: String}

#[derive(sqlx::FromRow)]
pub struct SettingRecord {id: i64, key: String, value: String}

/// This function looks for the database template file in the current working
/// directory and it's immediate parent. If it is found then it is copied to
/// a file called 'plauzible.db' in the current working directory.
pub fn create_database() -> Result<String, String> {
    // Attempt to locate the database template file.
    let template_path = get_database_template_path()?;
    let mut target_path = template_path.clone();

    target_path.pop();
    target_path.push("plauzible");
    target_path.set_extension("db");

    if target_path.exists() {
        return Err(format!("The '{}' database file already exists.", target_path.display()));
    }

    println!("Copying '{}' to '{}'.", template_path.display(), target_path.display());
    match fs::copy(template_path, &target_path) {
        Err(error) => Err(format!(
            "Copy application database failed: Cause: {:?}",
            error
        )),
        _ => Ok(format!("{}", target_path.display())),
    }
}

/// Establishes a connection to the application database. Note that using this
/// function, connection will fail if the database file does not exist.
pub async fn connect_to_database() -> Result<Pool<Sqlite>, String> {
    let database_path = match get_existing_database_path() {
        Some(path) => path,
        _ => return Err(String::from("Unable to locate the application database."))
    };
    let settings = SqliteConnectOptions::new()
        .filename(&database_path)
        .create_if_missing(false);

    match SqlitePool::connect_with(settings).await {
        Ok(pool) => Ok(pool),
        Err(_) => Err(format!("Failed to connect to the '{}' database.", database_path))
    }
}

pub async fn delete_record_by_id(record_id: i64) -> Result<i64, String> {
    let pool = connect_to_database().await?;

    match sqlx::query(DELETE_RECORD_SQL)
        .bind(record_id)
        .execute(&pool).await {
        Ok(_) => Ok(record_id),
        Err(error) => Err(format!("Error deleting record data. Cause: {:?}", error))
    }
}

/// This function attempts to locate the application database template file
/// by looking first in the current working directory and then in that
/// directories parent.
pub fn get_database_template_path() -> Result<PathBuf, String> {
    // Attempt to locate the database template file.
    let current_dir = match env::current_dir() {
        Ok(path_buffer) => path_buffer,
        Err(error) => {
            return Err(format!("Failed to identify the current working directory. Cause: {:?}", error))
        }
    };

    let mut path = current_dir.clone();
    path.push("plauzible_template");
    path.set_extension("db");

    if !path.exists() || !path.is_file() {
        let mut copy = current_dir.clone();
        if copy.pop() {
            path = copy;
            path.push("plauzible_template");
            path.set_extension("db");
        }
    }

    if !path.exists() || !path.is_file() {
        Err("Unable to locate the database template file.".to_string())
    } else {
        Ok(path)
    }
}

/// This function attempts to locate the application database file in the
/// current working directory. If it is not found then None is returned.
pub fn get_existing_database_path() -> Option<String> {
    // Attempt to locate the database template file.
    let current_dir = match env::current_dir() {
        Ok(path_buffer) => path_buffer,
        _ => return None
    };

    let mut path = current_dir.clone();
    path.push("plauzible");
    path.set_extension("db");

    if !path.exists() || !path.is_file() {
        path.pop();
        path.pop();
        path.push("plauzible");
        path.set_extension("db");
    } else {
        return Some(format!("{}", path.display()))
    }

    if path.exists() && path.is_file() {
        Some(format!("{}", path.display()))
    } else {
        None
    }
}

/// Fetches a list of all of the records from the local database that can be
/// decrypted with a given password hash. The results are returned as a string
/// of JSON.
pub async fn get_local_records(password_hash: &str) -> Result<String, String> {
    let mut pool = connect_to_database().await?;

    let records: Vec<DataRecord> = match sqlx::query_as(FETCH_RECORD_SQL).fetch_all(&pool).await {
        Ok(list) => list,
        Err(error) => return Err(format!("Error retrieving record data. Cause: {:?}", error))
    };

    let mut objects = json::JsonValue::new_array();
    let nonce_setting = match get_setting(&mut pool, "setting.nonce").await {
        Ok(setting) => setting,
        Err(error) => return Err(format!("Failed to locate the application nonce setting. Cause: {:?}", error))
    };

    for record in records {
        println!("RECORD: id: {}, data: {}", record.id, record.data);
        match utilities::decrypt(password_hash, &nonce_setting.value, &record.data).await {
            Some(json_data) => {
                println!("JSON Data:\n{}", &json_data);
                match json::parse(&json_data) {
                    Ok(content) => {
                        println!("JSON: {:?}", content);
                        let url = match content["url"].is_string() {
                            true => content["url"].as_str().expect("URL string extraction failed."),
                            _ => ""
                        };
                        match objects.push(object!{
                            data: record.data,
                            id: record.id,
                            hasURL: url.trim() != "",
                            name: content["name"].clone()
                        }) {
                            Err(error) => return Err(format!("Error storing record data. Cause: {:?}", error)),
                            _ => ()
                        };
                    },
                    Err(error) => println!("JSON data did not parse into content. Cause: {:?}", error)
                };
            },
            _ => println!("Decryption of record did not succeed, record will be ignored.")
        };
    };
    println!("OBJECTS: {:?}", objects);

    Ok(json::stringify(object!{
        records: objects
    }))
}

pub async fn get_nonce_string(pool: &mut Pool<Sqlite>) -> Result<String, String> {
    match get_setting(pool, "setting.nonce").await {
        Ok(record) => Ok(record.value),
        Err(message) => Err(message)
    }
}

/// The function fetches the salt setting from the database and correctly converts
/// it to a String that can be used to create a Salt instance.
pub async fn get_salt_string(pool: &mut Pool<Sqlite>) -> Result<String, String> {
    match get_setting(pool, "setting.salt").await {
        Ok(record) => {
                match hex::decode(&record.value) {
                    Ok(bytes) => {
                        match str::from_utf8(&bytes.as_slice()) {
                            Ok(base64_salt) => Ok(base64_salt.to_string()),
                            Err(error) => Err(format!("Failed to convert application salt to string. Cause: {:?}", error))
                        }
                    },
                    Err(error) => Err(format!("Failed to decode salt hex value. Cause: {:?}", error))
                }
        },
        Err(message) => Err(message)
    }
}

/// Attempts to retrieve a named setting from the application settings database
/// table.
pub async fn get_setting(pool: &mut Pool<Sqlite>, name: &str) -> Result<SettingRecord, String> {
    let record: SettingRecord = match sqlx::query_as(FETCH_SETTING_SQL).bind(name).fetch_one(&*pool).await {
        Ok(row) => row,
        Err(error) => return Err(format!("Failed to fetch the '{}' setting. Cause: {:?}", name, error))
    };
    Ok(record)
}

/// Remove the existing database (if it exists).
pub fn remove_existing_database() -> Result<(), String> {
    match get_existing_database_path() {
        Some(path) => {
            match fs::remove_file(path) {
                Ok(_) => Ok(()),
                Err(error) => Err(format!("Failed to remove existing database file. Cause: {:?}", error))
            }
        },
        _ => Ok(())
    }
}

/// Writes data to the data_records database table. Returns the id of the record
/// written if successful.
pub async fn write_record(data: &str) -> Result<i64, String> {
    let pool = connect_to_database().await?;

    match sqlx::query(CREATE_RECORD_SQL)
        .bind(data)
        .fetch_all(&pool).await {
        Ok(rows) => {
            match rows.first() {
                Some(row) => Ok(row.get("id")),
                None => Err(String::from("Insert did not return record details."))
            }
        },
        Err(error) => Err(format!("Error writing record data. Cause: {:?}", error))
    }
}
