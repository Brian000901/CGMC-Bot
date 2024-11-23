module.exports = async function (message) {
    if (message.content.startsWith('!gay')) {
        const user = message.mentions.users.first() || message.author
        let gay;
        if (user.id === '810409750625386497') {
            gay = 0
        } else if (user.id === '940831027922874399') {
            gay = 100
        } else {
            gay = Math.floor(Math.random() * 101)
        }
        message.channel.send(`${user} 的gay指數是 ${gay}%`)
    }
}