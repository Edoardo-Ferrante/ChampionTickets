const Command = require("../../structures/Command");
const Discord = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();

module.exports = class ChannelInfo extends Command {
  constructor(client) {
    super(client, {
      name: "channelinfo",
      description: client.cmdConfig.channelinfo.description,
      usage: client.cmdConfig.channelinfo.usage,
      permissions: client.cmdConfig.channelinfo.permissions,
      aliases: client.cmdConfig.channelinfo.aliases,
      category: "service",
      listed: client.cmdConfig.channelinfo.enabled,
      slash: true
    });
  }

  async run(message, args) {
    if (!await this.client.utils.isTicket(this.client, message.channel)) 
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)] });

    let ans = await db.get(`channelQuestions_${message.channel.id}`) || [{
      question: 'No Questions',
      answer: 'No Answers'
    }];
    
    let notes = await db.get(`notes_${message.channel.id}`) || 'No Notes';
    let claimed = await db.get(`ticketClaimed_${message.channel.id}`) || "N/A";
    let ticketId = await db.get(`ticketCount_${message.guild.id}`) + 1;

    let embed = new Discord.EmbedBuilder()
      .setTitle(this.client.embeds.channelInfo.title)
      .setColor(this.client.embeds.channelInfo.color);

    if(this.client.embeds.channelInfo.footer == true) embed.setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL({ dynamic: true }) }).setTimestamp();

    if(this.client.embeds.channelInfo.questions == true) {
      for(let i = 0; i < ans.length; i++) {
        embed.addFields([{ name: ans[i].question, value: ans[i].answer == "" ? "N/A" : ans[i].answer }]);
      }
    }

    if(this.client.embeds.channelInfo.fields.ticketId != "") embed.addFields([{ name: `${this.client.embeds.channelInfo.fields.ticketId}`, value: `${ticketId}` }]);
    if(this.client.embeds.channelInfo.fields.claimed != "") embed.addFields([{ name: `${this.client.embeds.channelInfo.fields.claimed}`, value: `${claimed}` }]);
    embed.addFields([{ name: `${this.client.embeds.channelInfo.fields.notes}`, value: `\`\`\`${notes}\`\`\`` }]);

    message.channel.send({ embeds: [embed] });
  }
  async slashRun(interaction, args) {
    if (!await this.client.utils.isTicket(this.client, interaction.channel)) 
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)] });

    let ans = await db.get(`channelQuestions_${interaction.channel.id}`) || [{
      question: 'No Questions',
      answer: 'No Answers'
    }];
    let notes = await db.get(`notes_${interaction.channel.id}`) || 'No Notes';
    let claimed = await db.get(`ticketClaimed_${interaction.channel.id}`) || "N/A";
    let ticketId = await db.get(`ticketCount_${interaction.guild.id}`);

    let embed = new Discord.EmbedBuilder()
      .setTitle(this.client.embeds.channelInfo.title)
      .setColor(this.client.embeds.channelInfo.color);

    if(this.client.embeds.channelInfo.footer == true) embed.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) }).setTimestamp();
    
    if(this.client.embeds.channelInfo.questions == true) {
      for(let i = 0; i < ans.length; i++) {
        embed.addFields([{ name: ans[i].question, value: ans[i].answer == "" ? "N/A" : ans[i].answer }]);
      }
    }

    if(this.client.embeds.channelInfo.fields.ticketId != "") embed.addFields([{ name: `${this.client.embeds.channelInfo.fields.ticketId}`, value: `${ticketId}` }]);
    if(this.client.embeds.channelInfo.fields.claimed != "") embed.addFields([{ name: `${this.client.embeds.channelInfo.fields.claimed}`, value: `${claimed}` }]);
    embed.addFields([{ name: `${this.client.embeds.channelInfo.fields.notes}`, value: `\`\`\`${notes}\`\`\`` }]);

    interaction.reply({ embeds: [embed], ephemeral: this.client.cmdConfig.channelinfo.ephemeral });
  }
};
