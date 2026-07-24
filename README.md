<div align="center">

# Markora

<!-- Language selector -->
[![简体中文](https://img.shields.io/badge/🇨🇳-简体中文-red?style=flat-square)](#-简体中文)
[![繁體中文](https://img.shields.io/badge/🇭🇰-繁體中文-orange?style=flat-square)](#-繁體中文)
[![English](https://img.shields.io/badge/🇺🇸-English-blue?style=flat-square)](#-english)

<!-- Badges -->
[![Version](https://img.shields.io/badge/version-1.0.0-6B96E8?style=for-the-badge&logo=tauri&logoColor=white)](https://github.com/xiaoxiong-88/markora/releases/tag/v1.0)
[![License](https://img.shields.io/badge/license-MIT-4CAF50?style=for-the-badge)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-stable-b7410e?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

*A local-first, privacy-friendly Markdown desktop editor — free, fast, refined.*

[Download](https://github.com/xiaoxiong-88/markora/releases/tag/v1.0) · [Report Bug](https://github.com/xiaoxiong-88/markora/issues) · [Request Feature](https://github.com/xiaoxiong-88/markora/issues)

</div>

---

<!-- ============================================================ -->
<!--                     简 体 中 文                               -->
<!-- ============================================================ -->

## 🇨🇳 简体中文

### ✨ 简介

**Markora** 是一款免费、本地优先、隐私友好的 Markdown 桌面编辑器。启动快速、界面精致，完全开源、完全离线。

> 你的文档永远不会离开本机。无遥测、无上传、无登录、无云服务。

### 🎯 功能特性

| 类别 | 亮点 |
|------|------|
| **编辑器** | 双架构：所见即所得（Milkdown / ProseMirror）+ 源码（CodeMirror 6） |
| **模式** | 所见即所得 · 源码 · 分栏预览 · 阅读 |
| **预览** | 实时防抖、基于源位置锚点的双向滚动同步 |
| **Markdown** | GFM 表格、任务列表、脚注、Front Matter、KaTeX 公式、Mermaid 图表 |
| **代码** | Shiki 语法高亮、行号、复制按钮、语言自动识别 |
| **图片** | 粘贴/拖入资源目录、相对路径、灯箱预览、破损占位 |
| **工作区** | 文件树、大纲、文档内查找替换、工作区全文搜索 |
| **标签页** | 多标签、固定、拖拽排序、重新打开已关闭、未保存圆点 |
| **保存** | 自动保存、原子写入、外部修改检测、冲突解决 |
| **主题** | 浅色/深色/羊皮纸/高对比、跟随系统、自定义字体 |
| **导出** | 独立 HTML、打印/PDF、Markdown 副本 |
| **其他** | 命令面板、快速打开、专注模式、打字机模式、会话恢复 |

### 🏗️ 技术栈

```
┌──────────────┐     ┌─────────────────────────────────────┐
│   Tauri 2    │────▶│  Rust 后端（文件系统、搜索、监听）   │
│  （桌面壳）   │     └─────────────────────────────────────┘
└──────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                      前端（WebView）                          │
│  React 18 + TypeScript (strict) + Vite + Zustand + Tailwind  │
│  Milkdown（所见即所得）· CodeMirror 6（源码）· unified/remark │
└──────────────────────────────────────────────────────────────┘
```

### 🚀 快速开始

#### 环境要求

**全平台通用：**
- [Node.js](https://nodejs.org/) + [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install)（stable）
- [Tauri 系统依赖](https://v2.tauri.app/start/prerequisites/)

**Windows 额外要求：**
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（包含"使用 C++ 的桌面开发"工作负载）
- [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)（Windows 11 已内置，Windows 10 需手动安装）

#### 开发
```bash
pnpm install        # 安装依赖
pnpm tauri dev      # 启动开发版
```

#### 打包
```bash
pnpm tauri build    # 生成安装包（.dmg / .msi / .AppImage）
```

#### Windows 构建

确保已安装 Rust MSVC 目标：
```bash
rustup target add x86_64-pc-windows-msvc
```

然后运行打包命令，产物位于 `src-tauri/target/release/bundle/msi/`。

### 🧪 测试

```bash
pnpm typecheck      # TypeScript 检查
pnpm test           # Vitest 前端测试
cd src-tauri && cargo test  # Rust 后端测试（29 个用例）
```

### 📁 项目结构

```
markora/
├── src/                          # React 前端
│   ├── features/
│   │   ├── editor/               # 所见即所得 + 源码 + 预览
│   │   ├── workspace/            # 文件树 + 冲突对话框
│   │   ├── tabs/                 # 标签栏
│   │   ├── outline/              # 文档大纲
│   │   ├── search/               # 工作区搜索
│   │   ├── command-palette/      # 命令面板 + 快速打开
│   │   ├── settings/             # 设置中心
│   │   ├── statusbar/            # 状态栏
│   │   ├── export/               # HTML 导出 + 打印
│   │   └── welcome/              # 欢迎页
│   ├── stores/                   # Zustand 状态管理
│   ├── services/                 # Tauri IPC + 持久化
│   ├── hooks/                    # React Hooks
│   ├── lib/                      # 工具函数
│   ├── components/               # 通用组件
│   ├── i18n/                     # 中英文国际化
│   ├── types/                    # TypeScript 类型
│   └── styles/                   # 全局 CSS + Tailwind
├── src-tauri/                    # Tauri + Rust 后端
│   ├── src/
│   │   ├── commands/             # Tauri 命令层
│   │   ├── filesystem/           # 读/写/列表/资源
│   │   ├── search/               # 工作区搜索
│   │   ├── watcher/              # 文件变更监听
│   │   └── errors/               # 结构化错误
│   └── capabilities/             # Tauri 权限
├── tests/                        # 测试 fixtures
├── docs/                         # 架构、安全、开发文档
├── package.json
├── pnpm-lock.yaml
└── README.md
```

### 🔒 隐私

| 我们**不会**做的事 | |
|---|---|
| ❌ 无遥测 | ❌ 无数据分析 |
| ❌ 无上传 | ❌ 无云同步 |
| ❌ 无登录 | ❌ 无 API Key |
| ❌ 无广告 | ❌ 无追踪 |

### 📄 许可证

[MIT](LICENSE) © 2026 xiaoxiong-88

---

<!-- ============================================================ -->
<!--                     繁 體 中 文                               -->
<!-- ============================================================ -->

## 🇭🇰 繁體中文

### ✨ 簡介

**Markora** 是一款免費、本地優先、隱私友好的 Markdown 桌面編輯器。啟動快速、介面精緻，完全開源、完全離線。

> 你的文件永遠不會離開本機。無遙測、無上傳、無登入、無雲端服務。

### 🎯 功能特性

| 類別 | 亮點 |
|------|------|
| **編輯器** | 雙架構：所見即所得（Milkdown / ProseMirror）+ 源碼（CodeMirror 6） |
| **模式** | 所見即所得 · 源碼 · 分欄預覽 · 閱讀 |
| **預覽** | 實時防抖、基於源位置錨點的雙向滾動同步 |
| **Markdown** | GFM 表格、任務列表、腳註、Front Matter、KaTeX 公式、Mermaid 圖表 |
| **程式碼** | Shiki 語法高亮、行號、複製按鈕、語言自動識別 |
| **圖片** | 貼上/拖入資源目錄、相對路徑、燈箱預覽、破損佔位 |
| **工作區** | 文件樹、大綱、文件內尋找替換、工作區全文搜尋 |
| **分頁** | 多分頁、固定、拖曳排序、重新開啟已關閉、未儲存圓點 |
| **儲存** | 自動儲存、原子寫入、外部修改檢測、衝突解決 |
| **主題** | 淺色/深色/羊皮紙/高對比、跟隨系統、自訂字體 |
| **匯出** | 獨立 HTML、列印/PDF、Markdown 副本 |
| **其他** | 命令面板、快速開啟、專注模式、打字機模式、工作階段還原 |

### 🏗️ 技術棧

```
┌──────────────┐     ┌─────────────────────────────────────┐
│   Tauri 2    │────▶│  Rust 後端（檔案系統、搜尋、監聽）   │
│  （桌面殼）   │     └─────────────────────────────────────┘
└──────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                      前端（WebView）                          │
│  React 18 + TypeScript (strict) + Vite + Zustand + Tailwind  │
│  Milkdown（所見即所得）· CodeMirror 6（源碼）· unified/remark │
└──────────────────────────────────────────────────────────────┘
```

### 🚀 快速開始

#### 環境需求

**全平台通用：**
- [Node.js](https://nodejs.org/) + [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install)（stable）
- [Tauri 系統依賴](https://v2.tauri.app/start/prerequisites/)

**Windows 額外需求：**
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（包含「使用 C++ 的桌面開發」工作負載）
- [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)（Windows 11 已內建，Windows 10 需手動安裝）

#### 開發
```bash
pnpm install        # 安裝依賴
pnpm tauri dev      # 啟動開發版
```

#### 打包
```bash
pnpm tauri build    # 產生安裝檔（.dmg / .msi / .AppImage）
```

#### Windows 構建

確保已安裝 Rust MSVC 目標：
```bash
rustup target add x86_64-pc-windows-msvc
```

然後執行打包命令，產物位於 `src-tauri/target/release/bundle/msi/`。

### 🧪 測試

```bash
pnpm typecheck      # TypeScript 檢查
pnpm test           # Vitest 前端測試
cd src-tauri && cargo test  # Rust 後端測試（29 個用例）
```

### 📁 專案結構

```
markora/
├── src/                          # React 前端
│   ├── features/
│   │   ├── editor/               # 所見即所得 + 源碼 + 預覽
│   │   ├── workspace/            # 文件樹 + 衝突對話框
│   │   ├── tabs/                 # 分頁列
│   │   ├── outline/              # 文件大綱
│   │   ├── search/               # 工作區搜尋
│   │   ├── command-palette/      # 命令面板 + 快速開啟
│   │   ├── settings/             # 設定中心
│   │   ├── statusbar/            # 狀態列
│   │   ├── export/               # HTML 匯出 + 列印
│   │   └── welcome/              # 歡迎頁
│   ├── stores/                   # Zustand 狀態管理
│   ├── services/                 # Tauri IPC + 持久化
│   ├── hooks/                    # React Hooks
│   ├── lib/                      # 工具函式
│   ├── components/               # 通用元件
│   ├── i18n/                     # 國際化（英/中）
│   ├── types/                    # TypeScript 型別
│   └── styles/                   # 全域 CSS + Tailwind
├── src-tauri/                    # Tauri + Rust 後端
│   ├── src/
│   │   ├── commands/             # Tauri 命令層
│   │   ├── filesystem/           # 讀/寫/列表/資源
│   │   ├── search/               # 工作區搜尋
│   │   ├── watcher/              # 檔案變更監聽
│   │   └── errors/               # 結構化錯誤
│   └── capabilities/             # Tauri 權限
├── tests/                        # 測試 fixtures
├── docs/                         # 架構、安全、開發文件
├── package.json
├── pnpm-lock.yaml
└── README.md
```

### 🔒 隱私

| 我們**不會**做的事 | |
|---|---|
| ❌ 無遙測 | ❌ 無數據分析 |
| ❌ 無上傳 | ❌ 無雲端同步 |
| ❌ 無登入 | ❌ 無 API Key |
| ❌ 無廣告 | ❌ 無追蹤 |

### 📄 許可證

[MIT](LICENSE) © 2026 xiaoxiong-88

---

<!-- ============================================================ -->
<!--                        E N G L I S H                          -->
<!-- ============================================================ -->

## 🇺🇸 English

### ✨ Overview

**Markora** is a free, local-first, privacy-friendly Markdown desktop editor. Fast startup, refined UI, open source and fully offline.

> Your documents never leave your machine. No telemetry, no uploads, no login, no cloud.

### 🎯 Features

| Category | Highlights |
|----------|------------|
| **Editor** | Dual architecture: WYSIWYG (Milkdown / ProseMirror) + Source (CodeMirror 6) |
| **Modes** | WYSIWYG · Source · Split Preview · Reading |
| **Preview** | Live, debounced, bidirectional scroll sync via source anchors |
| **Markdown** | GFM tables, task lists, footnotes, front matter, KaTeX math, Mermaid diagrams |
| **Code** | Shiki syntax highlighting, line numbers, copy button, language detection |
| **Images** | Paste / drag-to-assets, relative paths, lightbox, broken-image placeholder |
| **Workspace** | File tree, outline, in-document find/replace, workspace-wide search |
| **Tabs** | Multi-tab, pin, drag-reorder, reopen closed, dirty indicator |
| **Save** | Auto-save, atomic writes, external-change detection, conflict resolution |
| **Theme** | Light / Dark / Sepia / High Contrast, follows system, custom fonts |
| **Export** | Standalone HTML, print/PDF, Markdown copy |
| **Extras** | Command palette, quick open, focus mode, typewriter mode, session restore |

### 🏗️ Tech Stack

```
┌──────────────┐     ┌─────────────────────────────────────┐
│   Tauri 2    │────▶│  Rust backend (fs, search, watcher) │
│  (Desktop)   │     └─────────────────────────────────────┘
└──────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                    Frontend (WebView)                        │
│  React 18 + TypeScript (strict) + Vite + Zustand + Tailwind  │
│  Milkdown (WYSIWYG) · CodeMirror 6 (Source) · unified/remark │
└──────────────────────────────────────────────────────────────┘
```

### 🚀 Quick Start

#### Prerequisites

**All platforms:**
- [Node.js](https://nodejs.org/) + [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Tauri system deps](https://v2.tauri.app/start/prerequisites/)

**Windows additionally requires:**
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) ("Desktop development with C++" workload)
- [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) (built into Windows 11; Windows 10 needs a manual install)

#### Development
```bash
pnpm install        # install dependencies
pnpm tauri dev      # launch dev app
```

#### Build
```bash
pnpm tauri build    # produce installer (.dmg / .msi / .AppImage)
```

#### Windows build

Ensure the Rust MSVC target is installed:
```bash
rustup target add x86_64-pc-windows-msvc
```

Then run the build command. The `.msi` installer lands in `src-tauri/target/release/bundle/msi/`.

### 🧪 Testing

```bash
pnpm typecheck      # TypeScript check
pnpm test           # Vitest frontend tests
cd src-tauri && cargo test  # Rust backend tests (29 tests)
```

### 📁 Project Structure

```
markora/
├── src/                          # React frontend
│   ├── features/
│   │   ├── editor/               # WYSIWYG + Source + Preview
│   │   ├── workspace/            # File tree + conflict dialog
│   │   ├── tabs/                 # Tab bar
│   │   ├── outline/              # Document outline
│   │   ├── search/               # Workspace search
│   │   ├── command-palette/      # Command palette + quick open
│   │   ├── settings/             # Settings center
│   │   ├── statusbar/            # Status bar
│   │   ├── export/               # HTML export + print
│   │   └── welcome/              # Welcome screen
│   ├── stores/                   # Zustand stores
│   ├── services/                 # Tauri IPC + persistence
│   ├── hooks/                    # React hooks
│   ├── lib/                      # Utilities
│   ├── components/               # Shared components
│   ├── i18n/                     # English + 中文
│   ├── types/                    # TypeScript types
│   └── styles/                   # Global CSS + Tailwind
├── src-tauri/                    # Tauri + Rust backend
│   ├── src/
│   │   ├── commands/             # Tauri command surface
│   │   ├── filesystem/           # Read/write/list/assets
│   │   ├── search/               # Workspace search
│   │   ├── watcher/              # FS change watcher
│   │   └── errors/               # Structured errors
│   └── capabilities/             # Tauri capabilities
├── tests/                        # Test fixtures
├── docs/                         # Architecture, Security, Dev docs
├── package.json
├── pnpm-lock.yaml
└── README.md
```

### 🔒 Privacy

| What we **don't** do | |
|---|---|
| ❌ No telemetry | ❌ No analytics |
| ❌ No uploads | ❌ No cloud sync |
| ❌ No login | ❌ No API keys |
| ❌ No ads | ❌ No tracking |

### 📄 License

[MIT](LICENSE) © 2026 xiaoxiong-88

---

<!-- ============================================================ -->
<!--                          F O O T E R                          -->
<!-- ============================================================ -->

<div align="center">

Made with by [xiaoxiong-88](https://github.com/xiaoxiong-88)

⭐ Star this repo if you find it helpful!

</div>
