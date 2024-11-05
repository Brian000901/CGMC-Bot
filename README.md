# CGMC-Bot

這是一個專為成功高中麥塊社設計的 Discord 機器人，用於管理和監控 Minecraft 伺服器，以及進行部分 Minecraft 伺服器跟 Discord 的互通(這個儲存庫主要是我拿來進行版本管理跟備份用的，如果你想使用我也沒意見)。

## 安裝與設定

### 需求

- Node.js 18 以上

### 1. 安裝依賴項

首先，使用以下命令安裝專案所需的所有依賴項：

```bash
npm install
```

### 2. 設定環境變量

在專案根目錄創建一個 `.env` 文件，並填入以下內容：

```plaintext
DISCORD_TOKEN=你的Discord機器人Token
CLIENT_ID=你的Discord客戶端ID
GUILD_ID=你的Discord伺服器ID
SERVER_IP=Minecraft伺服器IP地址
SERVER_PORT=Minecraft伺服器端口號（默認為25565）
RCON_PORT=RCON伺服器端口號（默認為25575）
RCON_PASSWORD=RCON密碼
ADMIN_ID=管理員ID列表，使用逗號分隔
SERVER_NAME=Minecraft伺服器名稱（可選，默認為"A Minecraft Server"）
```

## 使用方法

啟動機器人：

```bash
node index.js
```

機器人啟動後，可以在 Discord 伺服器中使用以下指令：

- `!status`: 查詢 Minecraft 伺服器狀態
- `!console <command>`: 執行 RCON 命令（僅限管理員）
- `!autoupdate`: 開啟或關閉自動更新 Minecraft 伺服器狀態功能（僅限管理員）
- `!reload`: 重新載入機器人腳本（僅限管理員）

## 注意事項

如果 Minecraft 伺服器未啟用 RCON，部分功能將無法使用。例如`!console` 指令需要 RCON 才能執行命令。

## 腳本功能使用

腳本功能可以通過以下步驟使用：

1. 在 `scripts` 目錄中創建一個新的腳本文件，文件名應以 `.js` 結尾。
2. 編寫腳本內容，確保腳本中包含所需的邏輯。
3. 使用 `!reload` 指令重新載入機器人腳本，使新腳本生效。

## 貢獻

歡迎提交 Issues 和 Pull Requests 來改進<sup>屎山代碼</sup>這個專案。如有任何問題或建議，請聯繫專案負責人

> 這是AI生的owo