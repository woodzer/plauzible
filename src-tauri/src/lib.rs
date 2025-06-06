#[macro_use]
extern crate json;

mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::decrypt_record,
            commands::delete_database,
            commands::delete_record,
            commands::get_database_path,
            commands::get_records_for_password,
            commands::get_sensitive_settings,
            commands::get_standard_settings,
            commands::has_been_initialized,
            commands::hash_password,
            commands::initialize_application,
            commands::store_record,
            commands::update_record,
            commands::update_remove_service_settings,
            commands::update_sensitive_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
