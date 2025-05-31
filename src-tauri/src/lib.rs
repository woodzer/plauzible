#[macro_use]
extern crate json;

mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::decrypt_record,
            commands::delete_database,
            commands::delete_record,
            commands::has_been_initialized,
            commands::get_database_path,
            commands::get_records_for_password,
            commands::hash_password,
            commands::initialize_application,
            commands::store_record
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
