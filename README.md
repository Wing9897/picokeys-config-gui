# Pico Config GUI

一個用於管理 Pico-FIDO 和 Pico-HSM 裝置的桌面應用程式，基於 Tauri 2.0 + React + TypeScript 開發。

## 功能特色

### Pico-FIDO 管理
- 裝置資訊查看（韌體版本、序號、AAGUID 等）
- PIN 設定與變更
- 憑證管理（Discoverable Credentials）
- OATH/OTP 憑證管理（TOTP/HOTP）
- LED 組態設定
- 備份與還原（助記詞）

### Pico-HSM 管理
- 裝置初始化（PIN、SO-PIN、DKEK 份數設定）
- PIN / SO-PIN 管理與解鎖
- 金鑰生成（RSA / ECC）
- 憑證匯入匯出
- DKEK 備份與還原
- 組態設定（按鈕確認、金鑰使用計數器、RTC 同步、安全鎖、LED）

### 多語言支援
- 繁體中文
- 简体中文
- English

## 系統需求

- Windows 10/11
- Pico-HSM 需要啟用 Windows Smart Card 服務：
  ```powershell
  sc config SCardSvr start= demand && net start SCardSvr
  ```

## 開發環境

### 前置需求
- Node.js 18+
- Rust 1.70+
- Tauri CLI 2.0

### 安裝依賴
```bash
npm install
```

### 開發模式
```bash
npm run tauri dev
```

### 建置
```bash
npm run tauri build
```

## 專案結構

```
pico-config-gui/
├── src/                    # React 前端
│   ├── api/               # Tauri 後端 API 呼叫
│   ├── components/        # 共用元件
│   ├── i18n/              # 多語言翻譯
│   ├── pages/             # 頁面元件
│   │   ├── fido/         # FIDO 相關頁面
│   │   └── hsm/          # HSM 相關頁面
│   └── store/             # Zustand 狀態管理
├── src-tauri/             # Rust 後端
│   ├── src/
│   │   └── main.rs       # Tauri 命令實作
│   └── icons/            # 應用程式圖示
└── package.json
```

## 技術棧

- **前端**: React 18, TypeScript, Zustand
- **後端**: Rust, Tauri 2.0
- **裝置通訊**:
  - Pico-FIDO: USB HID (hidapi)
  - Pico-HSM: PC/SC (pcsc)

## 授權

MIT License
