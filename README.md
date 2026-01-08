# SK FILE Manager

**SK FILE Manager** is a modern, vault-based desktop file management application built with Electron. It is designed to help you organize your files efficiently with a sleek, dark-themed user interface.

## Key Features

- **📂 Multi-Vault System**: Create multiple isolated "Vaults" (directories) to keep your projects or files separate.
- **✨ Auto-Organization**:
  - **Clean Up Folder**: One-click utility to scan and **delete empty folders** in your vault to keep it tidy.
  - _Note: Previous versions had auto-sorting, but the current version focuses on safely removing empty clutter._
- **🖱️ Drag & Drop**:
  - Drag files from your computer anywhere onto the app to **copy** them into the active vault instantly.
- **⚡ Quick Actions**:
  - **Rename**: Rename files and Vaults easily with the pencil (✏️) icon.
  - **Delete**: Remove unwanted files or Vaults with the close (❌) or trash (🗑️) icons.
  - **New Items**: Quickly create new empty files or folders.
- **🧭 Navigation**: Built-in Back/Forward navigation and a direct Address Bar to jump between folders.

## How to Run the Application

### Prerequisites

- Ensure you have **Node.js** installed on your computer.

### Installation

1. Open your terminal or command prompt in this project folder.
2. Install the necessary dependencies:
   ```bash
   npm install
   # OR if you use yarn
   yarn install
   ```

### Starting the App

To launch the application:

```bash
npm run start
# OR
yarn run start
```

## Technologies Used

- **Electron**: For cross-platform desktop application development.
- **HTML/CSS/JS**: For the user interface and logic.
- **Node.js**: For file system operations (fs).

---

_Created by SK_

