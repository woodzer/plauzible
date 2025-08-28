# Plauzible

[![License](https://img.shields.io/badge/license-Apache2-blue.svg)](./LICENSE)  
[![Rust](https://img.shields.io/badge/Rust-stable-orange.svg)](https://www.rust-lang.org/)  
[![Tauri](https://img.shields.io/badge/Tauri-2.0-green.svg)](https://tauri.app/)  
[![Bun](https://img.shields.io/badge/Bun-runtime-black.svg)](https://bun.sh/)  

Plauzible is a **desktop password manager** built with [Tauri](https://tauri.app/).  
This repository contains the **Plauzible client application** sources.

---

## ✨ Features

- 🔐 Local-first password management  
- ☁️ Optional **Plauzible Remote Service** for multi-device sync
- 🔒 Privacy-conscious design with secure storage
- 🖥️ Cross-platform desktop client

---

## 🔗 Plauzible Remote Service

By default, Plauzible stores your password data **locally** on a single device.  
If you’d like to access your data across multiple devices, you can subscribe to
the **Plauzible Remote Service**, which securely synchronizes your details in a
**privacy-conscious way**.

---

## 🛠️ Building the Application

Clone this repository and ensure the following tools are installed:

- [Rust](https://www.rust-lang.org/tools/install)  
- [Bun JavaScript runtime](https://bun.sh/)  
- [Tauri 2.0](https://tauri.app/) framework  

### 1. Install the Tauri CLI

```sh
cargo install tauri-cli --version '^2.0.0' --locked
````

### 2. Install project dependencies

```sh
bun install
```

### 3. Run the development client

```sh
bun run tauri dev
```

### 4. Build the installation package

```sh
bun tauri build
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to open a pull request or submit an issue on [GitHub](../../issues).

---

## 📜 License

This project is licensed under the [Apache 2.0 License](./LICENSE).
