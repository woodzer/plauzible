use std::sync::Mutex;
use tauri::{Manager, Window, WindowEvent};

#[macro_use]
extern crate json;

mod app_state;
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            app.manage(Mutex::new(app_state::AppState::default()));
            Ok(())
        })
        .on_window_event(|window: &Window, event: &WindowEvent| {
            let app_state = window.app_handle().state::<Mutex<app_state::AppState>>();
            let app_state = app_state.lock().unwrap();

            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    if !app_state.exit_on_close {
                        api.prevent_close();
                        window.hide().unwrap();
                    } else {
                        {}
                    }
                }
                _ => {}
            };
        })
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::terms_accepted,
            commands::decrypt_record,
            commands::delete_database,
            commands::delete_record,
            commands::delete_remote_record,
            commands::get_application_settings,
            commands::get_database_path,
            commands::get_local_records_for_password,
            commands::get_remote_records_for_password,
            commands::get_sensitive_settings,
            commands::get_standard_settings,
            commands::has_been_initialized,
            commands::hash_password,
            commands::initialize_application,
            commands::open_url,
            commands::select_random_characters,
            commands::store_record,
            commands::store_remote_record,
            commands::terminate_application,
            commands::update_exit_on_close,
            commands::update_password_generator_settings,
            commands::update_record,
            commands::update_remote_record,
            commands::update_remote_service_settings,
            commands::update_sensitive_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
