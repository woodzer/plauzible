use crate::commands::database;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool};
use std::fs;
use std::sync::OnceLock;
use tauri::{path::BaseDirectory, AppHandle, Manager};

const GET_DATABASE_VERSION_SQL: &str = "select version_number from db_version";

struct Migration<'a> {
    target_version: i32,
    sql: Vec<&'a str>,
}

static MIGRATIONS: OnceLock<Vec<Migration>> = OnceLock::new();

/// Creates the database file.
async fn create_database_file(handle: &AppHandle) -> Result<(), String> {
    let path = get_database_path(handle).await?;

    let dir_path = get_database_dir(handle).await?;
    match fs::create_dir_all(dir_path) {
        Ok(_) => (),
        Err(error) => {
            return Err(format!(
                "Failed to create the database directory. Cause: {:?}",
                error
            ))
        }
    };

    let options = SqliteConnectOptions::new()
        .filename(&path)
        .create_if_missing(true);
    match SqlitePool::connect_with(options).await {
        Ok(_) => Ok(()),
        Err(error) => Err(format!(
            "Failed to create the database file. Cause: {:?}",
            error
        )),
    }
}

/// Checks whether the database file exists.
async fn database_exists(handle: &AppHandle) -> Result<bool, String> {
    let database_path = get_database_path(handle).await?;
    match fs::exists(database_path) {
        Ok(exists) => Ok(exists),
        Err(error) => Err(format!(
            "Failed to check if the database exists. Cause: {:?}",
            error
        )),
    }
}

/// Attempts to retrieve the version number of the database.
async fn database_version(handle: &AppHandle) -> Result<i32, String> {
    let pool = database::connect_to_database(handle).await?;
    match sqlx::query_scalar(GET_DATABASE_VERSION_SQL)
        .fetch_one(&pool)
        .await
    {
        Ok(version) => Ok(version),
        Err(_) => Ok(0),
    }
}

/// Attempts to retrieve the path to the database file.
pub async fn get_database_dir(handle: &AppHandle) -> Result<String, String> {
    match handle.path().resolve("db", BaseDirectory::AppConfig) {
        Ok(path) => match path.into_os_string().into_string() {
            Ok(path) => Ok(path),
            Err(error) => Err(format!(
                "Failed to get the database path. Cause: {:?}",
                error
            )),
        },
        Err(error) => Err(format!(
            "Failed to get the database path. Cause: {:?}",
            error
        )),
    }
}

/// Attempts to retrieve the path to the database file.
pub async fn get_database_path(handle: &AppHandle) -> Result<String, String> {
    match handle
        .path()
        .resolve("db/plauzible.db", BaseDirectory::AppConfig)
    {
        Ok(path) => match path.into_os_string().into_string() {
            Ok(path) => Ok(path),
            Err(error) => Err(format!(
                "Failed to get the database path. Cause: {:?}",
                error
            )),
        },
        Err(error) => Err(format!(
            "Failed to get the database path. Cause: {:?}",
            error
        )),
    }
}

/// Initializer functionality for the migrations.
fn initialize_migrations() -> Vec<Migration<'static>> {
    vec![
        Migration {
            target_version: 1,
            sql: vec!["create table if not exists db_version (version_number integer not null)",
                      "create table if not exists settings (id integer primary key, key text not null, value text not null, sensitive boolean not null default false)",
                      "create table if not exists data_records (id integer primary key, data text not null)",
                      "create unique index if not exists idx_settings_key on settings(key)",
                      "insert into db_version(version_number) values(1)"],
        }
    ]
}

/// Run a single migrations SQL statements.
async fn run_migration(handle: &AppHandle, migration: &Migration<'_>) -> Result<(), String> {
    let pool = database::connect_to_database(handle).await?;
    println!(
        "Running migration to version number: {}",
        migration.target_version
    );
    for sql in &migration.sql {
        println!("Running SQL: {}", sql);
        match sqlx::query(sql).execute(&pool).await {
            Ok(_) => (),
            Err(error) => {
                return Err(format!(
                    "Failed to run migration. SQL: {}, Cause: {:?}",
                    sql, error
                ))
            }
        }
    }
    Ok(())
}

/// Check the database file exists, creating it if it does not. Then
/// check the database version and run the necessary migrations.
pub async fn run_migrations(handle: &AppHandle) -> Result<(), String> {
    let mut version = 0;
    let exists = database_exists(handle).await?;

    if exists {
        version = match database_version(handle).await {
            Ok(version) => version,
            Err(error) => {
                return Err(format!(
                    "Failed to get the database version. Cause: {:?}",
                    error
                ))
            }
        };
    } else {
        create_database_file(handle).await?;
    }

    for migration in MIGRATIONS.get_or_init(initialize_migrations) {
        if migration.target_version > version {
            run_migration(handle, migration).await?;
        }
    }

    Ok(())
}
