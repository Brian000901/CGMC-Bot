require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials, EmbedBuilder, REST, Routes } = require('discord.js');
const { Rcon } = require('rcon-client');
const minecraftServerUtil = require('minecraft-server-util');

// 環境變量
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const SERVER_IP = process.env.SERVER_IP;
const SERVER_PORT = parseInt(process.env.SERVER_PORT, 10) || 25565;
const RCON_PORT = parseInt(process.env.RCON_PORT, 10) || 25575;
const RCON_PASSWORD = process.env.RCON_PASSWORD;
const ADMIN_IDS = process.env.ADMIN_ID.split(',').map(id => id.trim());
const SERVER_NAME = process.env.SERVER_NAME || "Minecraft Server";

if (!DISCORD_TOKEN || !SERVER_IP || !SERVER_PORT || !RCON_PORT || !RCON_PASSWORD || !ADMIN_IDS) {
    console.error('請檢查.env檔案，確認所有變量均已設置');
    process.exit(1);
}

const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
});

// 初始並載入腳本
discordClient.scriptHandlers = {};
discordClient.once('ready', async () => {
    console.log(`已登入為 ${discordClient.user.tag}`);
    loadScripts();
});

// 查詢伺服器狀態
async function queryServerStatus() {
    try {
        const result = await minecraftServerUtil.status(SERVER_IP, SERVER_PORT);
        return {
            version: result.version.name,
            online: result.players.online,
            max: result.players.max,
            motd: result.motd.clean,
        };
    } catch (error) {
        console.error('查詢伺服器狀態時發生錯誤:', error);
        return null;
    }
}

// RCON操作
async function rconCommand(command) {
    const rcon = new Rcon({ host: SERVER_IP, port: RCON_PORT, password: RCON_PASSWORD });
    try {
        await rcon.connect();
        return await rcon.send(command);
    } catch (error) {
        console.error('執行RCON命令時發生錯誤:', error);
        return null;
    } finally {
        rcon.end();
    }
}

// 自動更新伺服器狀態
let autoUpdateInterval;
let lastServerStatus = null; // 儲存上一個伺服器狀態

async function autoUpdateStatus(message) {
    if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
        autoUpdateInterval = null;
        lastServerStatus = null;
        message.channel.send('自動更新已停止。');
    } else {
        autoUpdateInterval = setInterval(async () => {
            const serverStatus = await queryServerStatus();

            // 如果伺服器離線，且上次狀態不是離線，則更新為「伺服器不在線」
            if (!serverStatus) {
                if (lastServerStatus !== null) { // 僅當狀態變更為離線時才更新
                    const offlineEmbed = new EmbedBuilder()
                        .setTitle(SERVER_NAME)
                        .setDescription("伺服器不在線")
                        .setColor(0xFF0000)
                        .setFooter({ text: `更新時間: ${new Date(Date.now() + 8 * 60 * 60 * 1000).toLocaleTimeString()}` });

                    const messages = await message.channel.messages.fetch({ limit: 1 });
                    const lastMessage = messages.first();
                    
                    if (lastMessage && lastMessage.author.id === discordClient.user.id) {
                        await lastMessage.edit({ embeds: [offlineEmbed] });
                    } else {
                        await message.channel.send({ embeds: [offlineEmbed] });
                    }

                    lastServerStatus = null; // 更新狀態為離線
                }
                return;
            }

            // 當伺服器在線且狀態改變時更新嵌入
            if (!lastServerStatus ||
                serverStatus.version !== lastServerStatus.version ||
                serverStatus.online !== lastServerStatus.online ||
                serverStatus.max !== lastServerStatus.max ||
                serverStatus.motd !== lastServerStatus.motd) {

                const embed = createStatusEmbed(serverStatus);
                const messages = await message.channel.messages.fetch({ limit: 1 });
                const lastMessage = messages.first();

                if (lastMessage && lastMessage.author.id === discordClient.user.id) {
                    await lastMessage.edit({ embeds: [embed] });
                } else {
                    await message.channel.send({ embeds: [embed] });
                }

                lastServerStatus = serverStatus; // 更新狀態為最新
            }
        }, 10000);

        message.channel.send('自動更新已啟動。');
    }
}

// 建立伺服器狀態的Embed
function createStatusEmbed(serverStatus) {
    return new EmbedBuilder()
        .setTitle(SERVER_NAME)
        .setDescription(serverStatus ? serverStatus.motd : "伺服器不在線")
        .addFields(
            { name: "IP", value: SERVER_IP, inline: true },
            { name: "版本", value: serverStatus ? serverStatus.version : "N/A", inline: true },
            { name: "在線人數", value: serverStatus ? `${serverStatus.online}/${serverStatus.max}` : "0/0", inline: true }
        )
        .setColor(0x00FFFF)
        .setFooter({ text: `獲取時間: ${new Date(Date.now() + 8 * 60 * 60 * 1000).toLocaleTimeString()}` });
}

// 載入腳本
function loadScripts() {
    const scriptsFolder = path.join(__dirname, 'scripts');
    fs.readdirSync(scriptsFolder).forEach(file => {
        if (file.endsWith('.js')) {
            try {
                const script = require(path.join(scriptsFolder, file));
                if (typeof script === 'function') {
                    discordClient.scriptHandlers[file] = script;
                } else {
                    console.warn(`腳本 ${file} 沒有導出為函數，將被忽略`);
                }
            } catch (error) {
                console.error(`載入腳本 ${file} 時出錯:`, error);
            }
        }
    });
}

// Discord事件處理
discordClient.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // 執行對應的腳本
    for (const scriptName in discordClient.scriptHandlers) {
        const script = discordClient.scriptHandlers[scriptName];
        await script(message);
    }

    // 狀態查詢指令
    if (message.content === '!status') {
        const serverStatus = await queryServerStatus();
        const embed = createStatusEmbed(serverStatus);
        message.channel.send({ embeds: [embed] });
    }

    // 任意RCON指令
    if (message.content.startsWith('!console')) {
        if (!ADMIN_IDS.includes(message.author.id)) {
            return message.reply('您無權執行此命令。');
        }
        const command = message.content.slice('!console'.length).trim();
        if (!command) {
            return message.reply('請提供一個要執行的指令。');
        }
        const rconResponse = await rconCommand(command);
        message.channel.send(rconResponse ? `\`\`\`${rconResponse}\`\`\`` : '指令執行失敗或無回應。');
    }

    // 自動更新指令
    if (message.content.startsWith('!autoupdate')) {
        if (!ADMIN_IDS.includes(message.author.id)) {
            return message.reply('您無權執行此命令。');
        }
        autoUpdateStatus(message);
    }

    // 重新載入腳本指令
    if (message.content === '!reload') {
        if (!ADMIN_IDS.includes(message.author.id)) {
            return message.reply('您無權執行此命令。');
        }
        loadScripts();
        message.channel.send('腳本已重新載入。');
    }
});

// 斜線指令處理
discordClient.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;
    const { commandName } = interaction;
    if (commandName === 'ping') {
        // 獲取延遲（ms）
        const latency = Date.now() - interaction.createdTimestamp;
        await interaction.reply(`機器人延遲：${latency}ms`);
    }
});

// 登入 Discord
discordClient.login(DISCORD_TOKEN);
