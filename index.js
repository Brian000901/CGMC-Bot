require('dotenv').config();
const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const { Client, GatewayIntentBits, Partials, EmbedBuilder, REST, Routes, AttachmentBuilder } = require('discord.js');
const minecraftServerUtil = require('minecraft-server-util');
const winston = require('winston');

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

// Logger setup
const logFileName = `logs/${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss' }), // Console format
        winston.format.printf(({ timestamp, level, message }) => {
            const colorizer = winston.format.colorize();
            return `[${timestamp}] [Main/${colorizer.colorize(level, level.toUpperCase())}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: logFileName, format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // Log file format
            winston.format.printf(({ timestamp, level, message }) => {
                return `[${timestamp}] [Main/${level.toUpperCase()}]: ${message}`;
            })
        )})
    ]
});

logger.info(`主程式已經以 PID ${process.pid} 啟動`);

// Function to delete log files older than one week
const deleteOldLogFiles = () => {
    const logDirectory = path.join(__dirname, 'logs');
    const files = fs.readdirSync(logDirectory);
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    files.forEach(file => {
        const filePath = path.join(logDirectory, file);
        const stats = fs.statSync(filePath);
        if (stats.mtime.getTime() < oneWeekAgo) {
            fs.unlinkSync(filePath);
            logger.info(`已刪除舊的日誌文件: ${file}`);
        }
    });
};

const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
});

discordClient.scriptHandlers = {};

discordClient.once('ready', async () => {
    logger.info(`已登入為${discordClient.user.tag}`);
    loadScripts();
    await registerSlashCommands();
});

async function queryServerStatus() {
    try {
        const result = await minecraftServerUtil.status(SERVER_IP, SERVER_PORT);
        return {
            version: result.version.name,
            online: result.players.online,
            max: result.players.max,
            motd: result.motd.clean,
            favicon: result.favicon // Assuming this is where the base64 image is stored
        };
    } catch (error) {
        logger.error('查詢伺服器狀態時發生錯誤:', error);
        return null;
    }
}

async function rconCommand(command) {
    try {
        const rcon = await minecraftServerUtil.RCON.connect(SERVER_IP, RCON_PORT, RCON_PASSWORD);
        const response = await rcon.run(command);
        rcon.close();
        return response.length > 4000 ? '回應超過Discord字符數限制' : `\`\`\`${response}\`\`\``;
    } catch (error) {
        logger.error('執行RCON命令時發生錯誤:', error);
        const errorMessage = `RCON命令執行錯誤: ${error.message}`;
        return errorMessage.length > 4000 ? '錯誤訊息超過Discord字符數限制' : `\`\`\`${errorMessage}\`\`\``;
    }
}

let autoUpdateInterval;
let lastServerStatus = null;

async function autoUpdateStatus(message) {
    if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
        autoUpdateInterval = null;
        lastServerStatus = null;
        message.channel.send('自動更新已停止。');
    } else {
        autoUpdateInterval = setInterval(async () => {
            const serverStatus = await queryServerStatus();
            if (!serverStatus) {
                if (lastServerStatus !== null) {
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
                    lastServerStatus = null;
                }
                return;
            }
            if (!lastServerStatus ||
                serverStatus.version !== lastServerStatus.version ||
                serverStatus.online !== lastServerStatus.online ||
                serverStatus.max !== lastServerStatus.max ||
                serverStatus.motd !== lastServerStatus.motd) {
                const embed = await createStatusEmbed(serverStatus);
                const messages = await message.channel.messages.fetch({ limit: 1 });
                const lastMessage = messages.first();
                if (lastMessage && lastMessage.author.id === discordClient.user.id) {
                    await lastMessage.edit({ embeds: [embed] });
                } else {
                    await message.channel.send({ embeds: [embed] });
                }
                lastServerStatus = serverStatus;
            }
        }, 10000);
        message.channel.send('自動更新已啟動。');
    }
}

async function createStatusEmbed(serverStatus) {
    let attachment = null;
    if (serverStatus.favicon) {
        const base64Data = serverStatus.favicon.replace(/^data:image\/png;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        const filePath = path.join(__dirname, 'server_icon.png');
        fs.writeFileSync(filePath, buffer);
        attachment = new AttachmentBuilder(filePath, { name: 'server_icon.png' });
    }

    const embed = new EmbedBuilder()
        .setTitle(SERVER_NAME)
        .setDescription(serverStatus ? serverStatus.motd : "伺服器不在線")
        .addFields(
            { name: "IP", value: SERVER_IP, inline: true },
            { name: "版本", value: serverStatus ? serverStatus.version : "N/A", inline: true },
            { name: "在線人數", value: serverStatus ? `${serverStatus.online}/${serverStatus.max}` : "0/0", inline: true }
        )
        .setColor(0x00FFFF)
        .setFooter({ text: `獲取時間: ${new Date(Date.now() + 8 * 60 * 60 * 1000).toLocaleTimeString()}` });

    if (attachment) {
        embed.setThumbnail('attachment://server_icon.png');
        return { embeds: [embed], files: [attachment] };
    }

    return { embeds: [embed] };
}

function loadScripts() {
    logger.info('正在重新載入腳本...');
    const scriptsFolder = path.join(__dirname, 'scripts');
    fs.readdirSync(scriptsFolder).forEach(file => {
        if (file.endsWith('.js')) {
            try {
                const scriptPath = path.join(scriptsFolder, file);
                delete require.cache[require.resolve(scriptPath)];
                const script = require(scriptPath);
                if (typeof script === 'function') {
                    discordClient.scriptHandlers[file] = script;
                    logger.info(`已成功載入腳本: ${file}`);
                } else {
                    logger.warn(`腳本${file}沒有導出為函數，將被忽略`);
                }
            } catch (error) {
                logger.error(`載入腳本${file}時出錯:`, error);
            }
        }
    });
    logger.info('已重新載入所有腳本');
}

async function registerSlashCommands() {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    try {
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: [{ name: 'ping', description: '看看機器人是否活著' }] }
        );
        logger.info('斜線指令註冊成功');
    } catch (error) {
        logger.error('註冊斜線指令時出錯:', error);
    }
}

discordClient.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    for (const scriptName in discordClient.scriptHandlers) {
        const script = discordClient.scriptHandlers[scriptName];
        await script(message);
    }
    if (message.content === '!status') {
        const serverStatus = await queryServerStatus();
        const { embeds, files } = await createStatusEmbed(serverStatus);
        message.channel.send({ embeds, files });
    }
    if (message.content.startsWith('!console')) {
        if (!ADMIN_IDS.includes(message.author.id)) {
            return message.reply('您無權執行此命令。');
        }
        const command = message.content.slice('!console'.length).trim();
        if (!command) {
            return message.reply('請提供一個要執行的指令。');
        }
        const rconResponse = await rconCommand(command);
        message.channel.send(rconResponse || '指令執行失敗或無回應。');
    }
    if (message.content.startsWith('!autoupdate')) {
        if (!ADMIN_IDS.includes(message.author.id)) {
            return message.reply('您無權執行此命令。');
        }
        autoUpdateStatus(message);
    }
    if (message.content === '!reload') {
        if (!ADMIN_IDS.includes(message.author.id)) {
            return message.reply('您無權執行此命令。');
        }
        loadScripts();
        message.channel.send('腳本已重新載入。');
    }
    if (message.content === '!ls') {
        const scriptNames = Object.keys(discordClient.scriptHandlers);
        message.channel.send(`已載入的腳本: ${scriptNames.join(', ')}`);
    }
    if (message.content === '!botinfo') {
        const uptime = process.uptime();
        const uptimeString = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;
        const latency = Date.now() - message.createdTimestamp;

        const interfaces = os.networkInterfaces();
        const localIP = interfaces.eth0 ? interfaces.eth0[0].address : 'N/A';

        try {
            const response = await axios.get('https://api.ipify.org?format=json');
            const externalIP = response.data.ip;

            const embed = new EmbedBuilder()
                .setTitle('機器人資訊')
                .setThumbnail(discordClient.user.avatarURL())
                .addFields(
                    { name: '機器人 ID', value: discordClient.user.id, inline: true },
                    { name: 'Discord 伺服器 ID', value: message.guild.id, inline: true },
                    { name: '運行時間', value: uptimeString, inline: true },
                    { name: '區域網 IP', value: localIP, inline: true },
                    { name: '外網 IP', value: externalIP, inline: true },
                    { name: '延遲', value: `${latency}ms`, inline: true }
                )
                .setColor(0x00FFFF)
                .setFooter({ text: `獲取時間: ${new Date(Date.now() + 8 * 60 * 60 * 1000).toLocaleTimeString()}` });
            message.channel.send({ embeds: [embed] });
        } catch (error) {
            logger.error('獲取外網 IP 時發生錯誤:', error);
            message.channel.send('獲取外網 IP 時發生錯誤。');
        }
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

discordClient.login(DISCORD_TOKEN);

// Log exit status
process.on('exit', (code) => {
    logger.info(`主程式以狀態碼 ${code} 退出`);
});

process.on('SIGINT', () => {
    logger.info('捕獲到 SIGINT 信號，進行退出...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('捕獲到 SIGTERM 信號，進行退出...');
    process.exit(0);
});