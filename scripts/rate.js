const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ratings = {}; // 用 於 儲 存 用 戶 的 評 分
module.exports = async function(message) {
    // 僅 當 指 令 以  "!rate" 開 頭 時 執 行
    if (!message.content.startsWith('!rate')) return;
    // 指 令 參 數 解 析
    const args = message.content.split(" ").slice(1);
    if (args.length < 3) {
        return message.reply("請 提 供 所 有 必 填 參 數 ： `!rate [內 容 ] [最 小 值 ] [最 大 值 ] [時間 上 限 (秒 )]`");
    }
    const contents = args[0].split(',');
    const min = parseInt(args[1]);
    const max = Math.min(parseInt(args[2]), 10);
    const timeLimit = parseInt(args[3]) * 1000 || 10000; // 預 設 10秒 時 間 上 限
    const endTime = Date.now() + timeLimit;
    if (isNaN(min) || isNaN(max) || min >= max) {
        return message.reply("請 檢 查 最 小 值 和 最 大 值 ， 且 最 大 值 不 應 超 過  10。 ");
    }
    // 為 每 個 內 容 建 立 評 分 嵌 入 消 息
    contents.forEach(async (content) => {
        const embed = new EmbedBuilder()
            .setTitle("評 分 時 間 ！ ")
            .setDescription(content.trim())
            .setFooter({ text: `範 圍 : ${min} - ${max} | 剩 餘 時 間 : ${(timeLimit / 1000).toFixed(0)} 秒 ` })
            .setColor(0x00FF00);
        const row = new ActionRowBuilder();
        for (let i = min; i <= max; i++) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`rate_${content}_${i}`)
                    .setLabel(`${i}`)
                    .setStyle(ButtonStyle.Primary)
            );
        }
        const msg = await message.channel.send({ embeds: [embed], components: [row]
});
        // 設 置 倒 計 時 更 新
        const countdownInterval = setInterval(async () => {
            const remainingTime = Math.max(0, endTime - Date.now());
            const seconds = Math.ceil(remainingTime / 1000);
            if (remainingTime <= 0) {
                clearInterval(countdownInterval);
                row.components.forEach(button => button.setDisabled(true));
                await msg.edit({ components: [row] });
            } else {
                embed.setFooter({ text: `範 圍 : ${min} - ${max} | 剩 餘 時 間 : ${seconds} 秒 ` });
                await msg.edit({ embeds: [embed] });
            }
        }, 1000);
        // 結 束 後 統 計 評 分
        setTimeout(async () => {
            const resultEmbed = new EmbedBuilder()
                .setTitle("評 分 結 果 ")
                .setColor(0x00FF00);
            const userRatings = ratings[content] || {};
            const scores = Object.values(userRatings);
            const avgRating = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : "無 評 分 ";
            resultEmbed.addFields(
                { name: content, value: `平 均 評 分 ： ${avgRating}`, inline: true }
            );
            await message.channel.send({ embeds: [resultEmbed] });
            delete ratings[content]; // 清 除 該 內 容 的 評 分 記 錄
        }, timeLimit);
    });
};
// 處 理 按 鈕 交 互
module.exports.interactionHandler = async function(interaction) {
    if (!interaction.isButton()) return;
    const [_, content, score] = interaction.customId.split('_');
    const userId = interaction.user.id;
    if (!ratings[content]) {
        ratings[content] = {};
    }
    const previousScore = ratings[content][userId];
    ratings[content][userId] = parseInt(score);
    const responseMessage = previousScore !== undefined
        ? `您 已 修 改 評 分 為 ： ${score}`
        : `您 已 成 功 評 分 ： ${score}`;
    await interaction.reply({ content: responseMessage, ephemeral: true });
};