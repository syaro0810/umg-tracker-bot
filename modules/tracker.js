const server = require("../schema/guild.js");
const { ChannelType } = require("discord.js");
const util = require("../util.js");


module.exports.run = async (client, message, args, mentionFix, getUser) => {
    const database = await server.findOne({ guildId: message.guild.id }).catch(err => util.logger(err));

    if (args && args.find(v => v.includes("@everyone") || v.includes("@here"))) {
        return message.channel.send("Nice try asshole.");
    }

    if (args[0].toLowerCase() === "add") {
        if (!args[1]) {
            return message.channel.send("Please provide a username to track.");
        }

        let channel = message.guild.channels.cache.find(c => c.id === database.config.userspawn.find(c => c.username === args[1].toLowerCase())?.channelID);
    
        if (channel) {
            return message.channel.send("This user is already being tracked.");
        }

        const category = await util.handleChannelCreation(message, ChannelType.GuildCategory);
    
        if (!channel) {
            channel = await message.guild.channels.create({
                name: `${args[1]}-tracker`,
                type: ChannelType.GuildText,
                parent: category.id
            });
        }
    
        let tracker = await channel.fetchWebhooks();
    
        if (tracker.size === 0) {
            tracker = await channel.createWebhook({
                name: "tracker"
            });
        }
    
        await server.findOneAndUpdate({ guildId: message.guild.id }, {
            $push: {
                "config.userspawn": {
                    webhookToken: tracker.token,
                    webhookID: tracker.id,
                    channelID: channel.id,
                    username: args[1].toLowerCase(),
                }
            }
        }).catch(err => util.logger(err));
    
        message.channel.send(`Now tracking "${args[1]}".`);
        util.logger(`[TRACKER] ${message.guild.name} (${message.guild.id}) is now tracking ${args[1]}.`);
    } else if (args[0].toLowerCase() === "remove") {
        if (!args[1]) {
            return message.channel.send("Please provide a username to track.");
        }

        let channel = message.guild.channels.cache.find(c => c.id === database.config.userspawn.find(c => c.username === args[1].toLowerCase())?.channelID);

        if (!channel) {
            return message.channel.send("This user is not being tracked.");
        }

        const tracker = await channel.fetchWebhooks();
        let shouldUpdate = false;

        if (tracker.size === 0) {
            message.channel.send("The channel has no webhooks.");
            shouldUpdate = true;
        } else {
            tracker.filter(v => v.name === "tracker").forEach(async v => await v.delete());
            await channel.delete();
            shouldUpdate = true;
        }
        
        if (shouldUpdate) {
            await server.findOneAndUpdate({ guildId: message.guild.id }, {
                $pull: {
                    "config.userspawn": {
                        username: args[1].toLowerCase()
                    }
                }
            }).catch(err => util.logger(err));
        }

        try {
            message.channel.send(`No longer tracking "${args[1]}".`);
        } catch {
            return;
        }

        util.logger(`[TRACKER] ${message.guild.name} (${message.guild.id}) is no longer tracking ${args[1]}.`);

    } else {
        message.channel.send("Invalid type, please use 'add' or 'remove' then the username.");
    }
}

module.exports.config = {
    name: "tracker",
    description: "tracks a specific user",
    aliases: ["track"],
    usages: [
        "tracker <add|remove> <username>",
    ],
    examples: [
        "tracker add calculatlons",
        "tracker remove calculatlons"
    ]
}
