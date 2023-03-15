const Command = require("../../structures/Command");
const { QuickDB } = require("quick.db");
const db = new QuickDB();

module.exports = class Claim extends Command {
	constructor(client) {
		super(client, {
			name: "claim",
			description: client.cmdConfig.claim.description,
			usage: client.cmdConfig.claim.usage,
			permissions: client.cmdConfig.claim.permissions,
      aliases: client.cmdConfig.claim.aliases,
			category: "tickets",
			listed: true,
			slash: true,
		});
	}
  
  async run(message, args) {
    let config = this.client.config;
    let claimed = await db.get(`ticketClaimed_${message.channel.id}`);

    if (!await this.client.utils.isTicket(this.client, message.channel)) 
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)] });

    if(claimed != null) 
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.already_claimed, this.client.embeds.error_color)] });

    message.channel.permissionOverwrites.edit(message.member.user, {
      SendMessages: true,
      ViewChannel: true,
    });

    if(config.roles.support.length > 0) {
      for(let i = 0; i < config.roles.support.length; i++) {
        let findRole = this.client.utils.findRole(message.guild, config.roles.support[i]);
        message.channel.permissionOverwrites.edit(findRole, {
          SendMessages: false,
          ViewChannel: true,
        });
      }
    }

    await db.set(`ticketClaimed_${message.channel.id}`, message.author.id);
    await db.add(`claimedTickets_${message.guild.id}`, 1);
    await db.add(`claimedStats_${message.author.id}`, 1);
    await db.delete(`autoClaim_${message.channel.id}`);
    message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.ticket_claimed.replace("<user>", message.author), this.client.embeds.success_color)] }).then(() => message.delete().catch((err) => {}));
  }
	async slashRun(interaction, args) {
    let config = this.client.config;
    let claimed = await db.get(`ticketClaimed_${interaction.channel.id}`);

    if (!await this.client.utils.isTicket(this.client, interaction.channel)) 
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)] });

    if(claimed != null) 
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.already_claimed, this.client.embeds.error_color)] });

    interaction.channel.permissionOverwrites.edit(interaction.user, {
      SendMessages: true,
      ViewChannel: true,
    });

    if(config.roles.support.length > 0) {
      for(let i = 0; i < config.roles.support.length; i++) {
        let findRole = this.client.utils.findRole(interaction.guild, config.roles.support[i]);
        interaction.channel.permissionOverwrites.edit(findRole, {
          SendMessages: false,
          ViewChannel: true,
        });
      }
    }

    await db.set(`ticketClaimed_${interaction.channel.id}`, interaction.user.id);
    await db.add(`claimedTickets_${interaction.guild.id}`, 1);
    await db.add(`claimedStats_${interaction.user.id}`, 1);
    await db.delete(`autoClaim_${interaction.channel.id}`);
    interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.ticket_claimed.replace("<user>", interaction.user), this.client.embeds.success_color)] });
	}
};