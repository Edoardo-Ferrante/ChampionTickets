const Command = require("../../structures/Command");
const { QuickDB } = require("quick.db");
const db = new QuickDB();
const { ApplicationCommandOptionType } = require("discord.js");

module.exports = class Assign extends Command {
	constructor(client) {
		super(client, {
			name: "assign",
			description: client.cmdConfig.assign.description,
			usage: client.cmdConfig.assign.usage,
			permissions: client.cmdConfig.assign.permissions,
      aliases: client.cmdConfig.assign.aliases,
			category: "tickets",
			listed: client.cmdConfig.assign.enabled,
			slash: true,
      options: [{
        name: "user",
        type: ApplicationCommandOptionType.User,
        description: "User to assign role to",
        required: true
      }]
		});
	}
  
  async run(message, args) {
    let config = this.client.config;
    let user = message.mentions.users.first() || this.client.users.cache.get(args[0]);
    let claimed = await db.get(`ticketClaimed_${message.channel.id}`);

    if(!user) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.assign.usage)] });

    if (!await this.client.utils.isTicket(this.client, message.channel)) 
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)] });

    message.channel.permissionOverwrites.edit(user, {
      SendMessages: true,
      ViewChannel: true,
    });

    if(claimed != null) await db.sub(`claimedStats_${claimed}`, 1);
    await db.set(`ticketClaimed_${message.channel.id}`, user.id);
    await db.delete(`autoClaim_${message.channel.id}`);
    message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.ticket_assigned.replace("<user>", user).replace("<author>", message.author), this.client.embeds.success_color)] }).then(() => message.delete().catch((err) => {}));
  }
	async slashRun(interaction, args) {
    let config = this.client.config;
    let user = interaction.options.getUser("user")
    let claimed = await db.get(`ticketClaimed_${interaction.channel.id}`);

    if (!await this.client.utils.isTicket(this.client, interaction.channel)) 
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)] });

      interaction.channel.permissionOverwrites.edit(user, {
      SendMessages: true,
      ViewChannel: true,
    });

    if(claimed != null) await db.sub(`claimedStats_${claimed}`, 1);
    await db.set(`ticketClaimed_${interaction.channel.id}`, user.id);
    await db.delete(`autoClaim_${interaction.channel.id}`);
    interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.ticket_assigned.replace("<user>", user).replace("<author>", interaction.user), this.client.embeds.success_color)] });
	}
};