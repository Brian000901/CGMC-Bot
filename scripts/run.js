require('dotenv').config();
const ADMIN_IDS = process.env.ADMIN_ID.split(',').map(id => id.trim());

module.exports = (message) => {
    // 確認發送訊息者的 ID 是否在 ADMIN_IDS 中，並檢查訊息是否以 "!run" 開頭
    if (ADMIN_IDS.includes(message.author.id) && message.content.startsWith('!run ')) {
        const command = message.content.slice(5).trim(); // 去除 "!run " 前綴
        try {
            // 使用 eval 執行指令內容
            const result = eval(command);
            // 回覆執行結果
            message.reply(`執行結果: ${result}`);
        } catch (error) {
            // 如果出現錯誤，回覆錯誤訊息
            message.reply(`執行錯誤: ${error.message}`);
        }
    }
};
