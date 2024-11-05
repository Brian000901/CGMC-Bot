const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ratings = {}; // 用於儲存用戶的評分

module.exports = async function(message) {
    // 僅當指令以 "!rate" 開頭時執行
    if (!message.content.startsWith('!rate')) return;
    
    // 指令參數解析
    const args = message.content.split(" ").slice(1);
    if (args.length < 3) {
        return message.reply("請提供所有必填參數： `!rate [內容] [最小值] [最大值] [時間上限 (秒)]`");
    }
    
    const contents = args[0].split(',');
    const min = parseInt(args[1]);
    const max = Math.min(parseInt(args[2]), 10);
    const timeLimit = parseInt(args[3]) * 1000 || 10000; // 預設 10 秒
    const endTime = Date.now() + timeLimit;
    
    if (isNaN(min) || isNaN(max) || min >= max) {
        return message.reply("請檢查最小值和最大值，且最大值不應超過 10。");
    }
    
    // 為每個內容建立評分嵌入訊息
    contents.forEach(async (content) => {
        const embed = new EmbedBuilder()
            .setTitle("評分時間！")
            .setDescription(content.trim())
            .setFooter({ text: `範圍 : ${min} - ${max} | 剩餘時間 : ${(timeLimit / 1000).toFixed(0)} 秒 ` })
            .setColor(0x00FF00);

        // 動態生成按鈕行
        const rows = [];
        for (let i = min; i <= max; i += 5) {
            const row = new ActionRowBuilder();
            for (let j = i; j < i + 5 && j <= max; j++) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`rate_${content}_${j}`)
                        .setLabel(`${j}`)
                        .setStyle(ButtonStyle.Primary)
                );
            }
            rows.push(row);
        }
        
        const msg = await message.channel.send({ embeds: [embed], components: rows });
        
        // 設置倒計時更新
        const countdownInterval = setInterval(async () => {
            const remainingTime = Math.max(0, endTime - Date.now());
            const seconds = Math.ceil(remainingTime / 1000);
            if (remainingTime <= 0) {
                clearInterval(countdownInterval);
                rows.forEach(row => row.components.forEach(button => button.setDisabled(true)));
                await msg.edit({ components: rows });
            } else {
                embed.setFooter({ text: `範圍 : ${min} - ${max} | 剩餘時間 : ${seconds} 秒 ` });
                await msg.edit({ embeds: [embed] });
            }
        }, 1000);
        
        // 結束後統計評分
        setTimeout(async () => {
            const resultEmbed = new EmbedBuilder()
                .setTitle("評分結果")
                .setColor(0x00FF00);
            
            const userRatings = ratings[content] || {};
            const scores = Object.values(userRatings);
            const avgRating = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : "無評分";
            
            resultEmbed.addFields(
                { name: content, value: `平均評分： ${avgRating}`, inline: true }
            );
            
            await message.channel.send({ embeds: [resultEmbed] });
            delete ratings[content]; // 清除該內容的評分記錄
        }, timeLimit);
    });
};

// 處理按鈕交互
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
        ? `您已修改評分為： ${score}`
        : `您已成功評分： ${score}`;
    
    await interaction.reply({ content: responseMessage, ephemeral: true });
};
