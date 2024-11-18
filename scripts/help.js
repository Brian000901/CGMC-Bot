// help.js
module.exports = async function(message) {
    if (message.content === '!!help') {
        const response = `
        **可使用的指令列表：**
        /ping - 看看機器人是不是活的
        !!help - 查查看這個列表
        !botstatus - 查詢Discord機器人狀態
        !status - 查查看伺服器狀態
        **——以下指令需要權限——**
        !autoupdate - 自動更新伺服器狀態
        !console [指令] - 執行RCON指令
        !reload - 重新載入腳本
        `;
        message.channel.send(response);
    }
};
