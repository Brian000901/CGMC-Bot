// help.js
module.exports = async function(message) {
    if (message.content === '!!help') {
        const response = `
        **可 使 用 的 指 令 列 表 ： **
        /ping - 看 看 機 器 人 是 不 是 活 的
        !!help - 查 看 這 個 列 表
        !status - 查 看 伺 服 器 狀 態
        **——以 下 指 令 需 要 權 限 ——**
        !autoupdate - 自 動 更 新 伺 服 器 狀 態
        !console [指 令 ] - 執 行 RCON指 令
        !reload - 重 新 載 入 腳 本
        `;
        message.channel.send(response);
    }
};
