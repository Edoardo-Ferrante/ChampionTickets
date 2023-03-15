const Command = require("../../structures/Command");
const { ApplicationCommandOptionType } = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();

module.exports = class SetPriority extends Command {
  constructor(client) {
    super(client, {
      name: "setpriority",
      description: client.cmdConfig.setpriority.description,
      usage: client.cmdConfig.setpriority.usage,
      permissions: client.cmdConfig.setpriority.permissions,
      aliases: client.cmdConfig.setpriority.aliases,
      category: "tickets",
      listed: client.cmdConfig.setpriority.enabled,
      slash: true,
      options: [{
        name: "channel", 
        description: "Name of Ticket Channel to Set Priority", 
        type: ApplicationCommandOptionType.Channel, 
        required: true
      }, {
        name: "priority", 
        description: "Priority to set. Low, Normal, High, Urgent", 
        type: ApplicationCommandOptionType.String, 
        required: true,
        choices: [
          {
            name: "Low",
            value: "low"
          }, {
            name: "Normal",
            value: "normal"
          }, {
            name: "High",
            value: "high"
          }, {
            name: "Urgent",
            value: "urgent"
          }
        ]
      }]
    });
  }

  async run(message, args) {
    let config = this.client.config;
    let channel = message.mentions.channels.first() || this.client.channels.cache.get(args[0]);
    let priority = args[1];
    
    let priorityEmojis = config.emojis.priority;
    let priorityList = ["low", "normal", "high", "urgent"];
    
    if(!priority || !channel) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.setpriority.usage)] });
    if(!priorityList.some((x) => x == priority.toLowerCase())) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.priority.invalid, this.client.embeds.error_color)] });
    
    let ticketData = await db.get(`ticketData_${channel.id}`);
    let ticketOwner = this.client.users.cache.get(ticketData?.owner);
    
    let currentPriority = await db.get(`priority_${message.guild.id}_${channel.id}`);
    
    if(priority == "normal") {
      if(currentPriority) {
        channel.setName(this.client.utils.ticketPlaceholders(config.channels.channel_name, ticketOwner, ticketData?.id)).catch((e) => this.client.utils.sendError("Bot doesn't have required permission to rename channel."));
        await db.delete(`priority_${message.guild.id}_${channel.id}`); 
      }
    } else {
      channel.setName(config.channels.priority_name.replace("<priority>", priorityEmojis[priority.toLowerCase()]).replace("<username>", ticketOwner?.username).replace("<ticket>", ticketData?.id)).catch((e) => this.client.utils.sendError("Bot doesn't have required permission to rename channel."));
      await db.set(`priority_${message.guild.id}_${channel.id}`, priority); 
    }

    message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.priority.changed.replace("<channel>", `${channel}`)
      .replace("<priority>", `${config.priority[priority.toLowerCase()]}`), this.client.embeds.success_color)] });
  }
  async slashRun(interaction, args) {
    let config = this.client.config;
    let channel = interaction.options.getChannel("channel");
    let priority = interaction.options.getString("priority");
    
    let priorityEmojis = config.emojis.priority;
    let priorityList = ["low", "normal", "high", "urgent"];
    
    if(!priorityList.some((x) => x == priority.toLowerCase())) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.priority.invalid, this.client.embeds.error_color)], ephemeral: this.client.cmdConfig.setpriority.ephemeral });
    
    let ticketData = await db.get(`ticketData_${channel.id}`);
    let ticketOwner = this.client.users.cache.get(ticketData?.owner);
    
    let currentPriority = await db.get(`priority_${interaction.guild.id}_${channel.id}`);
    
    if(priority == "normal") {
      if(currentPriority) {
        channel.setName(this.client.utils.ticketPlaceholders(config.channels.channel_name, ticketOwner, ticketData?.id)).catch((e) => this.client.utils.sendError("Bot doesn't have required permission to rename channel."));
        await db.delete(`priority_${interaction.guild.id}_${channel.id}`);
      }
    } else {
      channel.setName(config.channels.priority_name.replace("<priority>", priorityEmojis[priority.toLowerCase()]).replace("<username>", ticketOwner?.username).replace("<ticket>", ticketData?.id)).catch((e) => this.client.utils.sendError("Bot doesn't have required permission to rename channel."));
      await db.set(`priority_${interaction.guild.id}_${channel.id}`, priority); 
    }

    interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.priority.changed.replace("<channel>", `${channel}`)
      .replace("<priority>", `${config.priority[priority.toLowerCase()]}`), this.client.embeds.success_color)], ephemeral: this.client.cmdConfig.setpriority.ephemeral });
  }
};
