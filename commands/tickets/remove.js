const Command = require("../../structures/Command");
const Discord = require("discord.js");

module.exports = class Remove extends Command {
	constructor(client) {
		super(client, {
			name: "remove",
			description: client.cmdConfig.remove.description,
			usage: client.cmdConfig.remove.usage,
			permissions: client.cmdConfig.remove.permissions,
      aliases: client.cmdConfig.remove.aliases,
			category: "tickets",
			listed: client.cmdConfig.remove.enabled,
      slash: true,
      options: [{
        name: 'user',
        type: Discord.ApplicationCommandOptionType.User,
        description: "User to remove from Ticket",
        required: true,
      }]
		});
	}

  async run(message, args) {
    let config = this.client.config;
    if (!await this.client.utils.isTicket(this.client, message.channel)) 
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)] });
    let member = message.mentions.members.first() || message.guild.members.cache.get(args[0]);

    if(!member) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.remove.usage)] });
    if(member.id == message.author.id) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.general.cannot_self, this.client.embeds.error_color)] });

    message.guild.channels.cache.get(message.channel.id).permissionOverwrites.create(member.id, {ViewChannel: false, SendMessages: false});
    
    const removed = new Discord.EmbedBuilder()
      .setTitle(this.client.embeds.title)
      .setDescription(this.client.language.ticket.user_removed.replace("<user>", member))
      .setFooter({ text: this.client.embeds.footer, iconURL: this.client.user.displayAvatarURL({ dynamic: true }) })
      .setTimestamp()
      .setColor(this.client.embeds.success_color);

    const ticketData = await this.client.db.get(`ticketData_${message.channel.id}`) || {};

    await this.client.utils.serverLogs({
      date: new Date().toLocaleString("en-GB"),
      author_id: message.author.id,
      author: message.author.tag,
      user_id: member.user.id,
      user: member.user.tag,
      channel_id: `${message.channel.id}`,
      channel_name: `${message.channel.name}`,
      ticketId: ticketData.id,
      message: `ticket_remove`
    });
    
    message.channel.send({ embeds: [removed] });
  }
  async slashRun(interaction, args) {
    let config = this.client.config;
    let member = interaction.options.getUser("user");

    if(member.id == interaction.user.id) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.cannot_self, this.client.embeds.error_color)] });

    if (!await this.client.utils.isTicket(this.client, interaction.channel)) 
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)] });
    
    interaction.guild.channels.cache.get(interaction.channel.id).permissionOverwrites.create(member.id, {ViewChannel: false, SendMessages: false});
    
    const removed = new Discord.EmbedBuilder()
      .setTitle(this.client.embeds.title)
      .setDescription(this.client.language.ticket.user_removed.replace("<user>", member))
      .setFooter({ text: this.client.embeds.footer, iconURL: this.client.user.displayAvatarURL({ dynamic: true }) })
      .setTimestamp()
      .setColor(this.client.embeds.success_color);

    const ticketData = await this.client.db.get(`ticketData_${interaction.channel.id}`) || {};

    await this.client.utils.serverLogs({
      date: new Date().toLocaleString("en-GB"),
      author_id: interaction.user.id,
      author: interaction.user.tag,
      user_id: member.id,
      user: member.tag,
      channel_id: `${interaction.channel.id}`,
      channel_name: `${interaction.channel.name}`,
      ticketId: ticketData.id,
      message: `ticket_remove`
    });
    
    interaction.reply({ embeds: [removed] });
  }
};