const Command = require("../../structures/Command");
const { ApplicationCommandOptionType } = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();

module.exports = class ClientProfile extends Command {
  constructor(client) {
    super(client, {
      name: "clientprofile",
      description: client.cmdConfig.clientprofile.description,
      usage: client.cmdConfig.clientprofile.usage,
      permissions: client.cmdConfig.clientprofile.permissions,
      aliases: client.cmdConfig.clientprofile.aliases,
      category: "service",
      listed: client.cmdConfig.clientprofile.enabled,
      slash: true,
      options: [{
        name: "client",
        description: "Client whoes profile to see",
        type: ApplicationCommandOptionType.User,
        required: false
      }]
    });
  }

  async run(message, args) {
    let user = message.mentions.users.first() || message.author;
    let clientProfile = await db.get(`clientProfile_${message.guild.id}_${user.id}`) || {
      orderCount: 0,
      amountSpent: 0,
    };

    message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.client_info.replace("<user>", user).replace("<orderCount>", clientProfile.orderCount).replace("<amountSpent>", clientProfile.amountSpent), this.client.embeds.success_color)] });
  }
  async slashRun(interaction, args) {
    let user = interaction.options.getUser("client") || interaction.user;
    let clientProfile = await db.get(`clientProfile_${interaction.guild.id}_${user.id}`) || {
      orderCount: 0,
      amountSpent: 0,
    };

    interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.client_info.replace("<user>", user).replace("<orderCount>", clientProfile.orderCount).replace("<amountSpent>", clientProfile.amountSpent), this.client.embeds.success_color)], ephemeral: this.client.cmdConfig.clientprofile.ephemeral });
  }
};