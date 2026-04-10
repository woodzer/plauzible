use crate::commands::{database, rest_api, utilities};
use chrono::Utc;
use json::{object, JsonValue};
use tauri::AppHandle;

#[tauri::command]
pub async fn export_unlocked_snapshot(
    handle: AppHandle,
    password_hash: String,
) -> Result<String, String> {
    let mode = utilities::get_operation_mode(&handle).await?;
    let mut pool = database::connect_to_database(&handle).await?;

    let records = match mode.as_str() {
        "local" => {
            database::collect_local_decrypted_records_for_export(&handle, &password_hash).await?
        }
        "remote" => {
            rest_api::collect_remote_decrypted_records_for_export(&handle, &password_hash).await?
        }
        _ => return Err("Unknown operation mode.".to_string()),
    };

    let standard_records = database::get_all_standard_settings(&mut pool).await?;
    let mut standard_settings = JsonValue::new_array();
    for record in standard_records {
        let row = object! {
            id: record.id,
            key: record.key,
            value: record.value
        };
        match standard_settings.push(row) {
            Err(error) => {
                return Err(format!(
                    "Failed to build standard settings for export. Cause: {:?}",
                    error
                ))
            }
            _ => (),
        }
    }

    let sensitive_records = database::get_all_sensitive_settings(&mut pool).await?;
    let mut sensitive_settings = JsonValue::new_array();
    for record in sensitive_records {
        let row = object! {
            id: record.id,
            key: record.key,
            value: record.value
        };
        match sensitive_settings.push(row) {
            Err(error) => {
                return Err(format!(
                    "Failed to build sensitive settings for export. Cause: {:?}",
                    error
                ))
            }
            _ => (),
        }
    }

    let application_settings = object! {
        operationMode: utilities::get_operation_mode(&handle).await?,
        serviceURL: utilities::get_service_url(&handle).await?,
        termsAccepted: utilities::get_terms_accepted(&handle).await?,
        termsRemoted: utilities::get_terms_remoted(&handle).await?
    };

    let root = object! {
        formatVersion: 1,
        exportedAt: Utc::now().to_rfc3339(),
        appVersion: env!("CARGO_PKG_VERSION"),
        mode: mode,
        records: records,
        applicationSettings: application_settings,
        standardSettings: standard_settings,
        sensitiveSettings: sensitive_settings
    };

    Ok(root.dump())
}
