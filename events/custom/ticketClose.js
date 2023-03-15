const { QuickDB } = require("quick.db");
const db = new QuickDB();
const Event = require("../../structures/Events");
const { ButtonBuilder, ActionRowBuilder, EmbedBuilder, ButtonStyle, InteractionType, ComponentType } = require("discord.js");
const { textTranscript, htmlTranscript } = require("../../utils/createTranscript.js"); 
const askReview = require("../../utils/askReview.js");

module.exports = class TicketClose extends Event {
  constructor(...args) {
    super(...args);
  }

  async run(message, member, reason = "No Reason") {
    let config = this.client.config;
    let language = this.client.language;
    let confirmBttn = new ButtonBuilder()
      .setStyle(ButtonStyle.Primary)
      .setLabel(this.client.language.buttons.confirm_close)
      .setEmoji(config.emojis.close || {})
      .setCustomId('confirmClose');
    let cancelBttn = new ButtonBuilder()
      .setStyle(ButtonStyle.Danger)
      .setLabel(this.client.language.buttons.cancel_close)
      .setEmoji(config.emojis.cancel_close || {})
      .setCustomId('cancelClose');
  
    let confirmRow = new ActionRowBuilder()
      .addComponents(confirmBttn)
      .addComponents(cancelBttn);
    let confirm = this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.close_confirmation, this.client.embeds.success_color);
    if (this.client.embeds.close.image.enabled == true) confirm.setImage(this.client.embeds.close.image.url);
    if (this.client.embeds.close.thumbnail.enabled == true) confirm.setThumbnail(this.client.embeds.close.thumbnail.url);
  
    let m;
    if(message.type == InteractionType.ApplicationCommand) {
      m = await message.reply({ embeds: [confirm], components: [confirmRow], fetchReply: true });
    } else if(message.type == InteractionType.MessageComponent){
      m = await message.reply({ embeds: [confirm], components: [confirmRow], fetchReply: true });
    } else {
      m = await message.channel.send({ embeds: [confirm], components: [confirmRow] });
    }

    const filter = i => i.user.id == member.id;

    let collector = m.createMessageComponentCollector({filter, componentType: ComponentType.Button, time: 25000 });

    collector.on('collect', async (b) => {
      await b.deferUpdate();
      if (b.customId == `confirmClose`) {
        await askReview(this.client, message.channel, message.guild);
        collector.stop("claimed");
        message.channel.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.ticket_deleted, this.client.embeds.general_color)] });

        
				let ticketData = await db.get(`ticketData_${message.channel.id}`);
        const ticketOwner = this.client.users.cache.get(ticketData?.owner);
				let memberTickets = await db.get(`tickets_${ticketData?.owner}`) || [];
				memberTickets = memberTickets.filter((x) => x.channel != message.channel.id);
        
        await this.client.utils.serverLogs({
          date: new Date().toLocaleString("en-GB"),
          author_id: member.user.id,
          author: member.user.tag,
          user_id: null,
          user: null,
          channel_id: `${message.channel.id}`,
          channel_name: `${message.channel.name}`,
          ticketId: ticketData.id,
          message: `ticket_close`
        });

        if(this.client.config.general.dm_message && ticketOwner) {
          let dmUserEmbed = new EmbedBuilder()
            .setTitle(this.client.language.titles.closed_dm)
            .setColor(this.client.embeds.general_color)
            .setFooter({ text: member.user.username, iconURL: member.user.displayAvatarURL() })
            .setTimestamp()
            .setDescription(this.client.language.ticket.closed_dm);
    
          ticketOwner.send({ embeds: [dmUserEmbed] }).catch((err) => {
            console.error("User's DM Closed");
          });
        }

				await db.set(`tickets_${ticketData?.owner}`, memberTickets);
        await db.delete(`choosingCategory_${ticketData?.owner}`);
  
        if (config.general.transcripts == false) {
          setTimeout(async() => {
            message.channel.delete();
          }, this.client.config.general.delete_after * 1000);
          return;
        }
        if (config.channels.transcripts == "")
          return message.channel.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.no_transcript, this.client.embeds.error_color)] });
        
        let canRename = await this.client.utils.canEditName(message.guild, message.channel);
        if(this.client.config.general.rename_close == true && canRename == true && !message.channel.name.includes(this.client.config.channels.priority_name.replace("<priority>", ""))) {
          message.channel.setName(this.client.utils.ticketPlaceholders(config.channels.closed_name, ticketOwner, ticketData?.id)).catch((e) => this.client.utils.sendWarn("Bot cannot rename this channel at the moment."));
        }

        if(config.general.transcript_type == "HTML") {
          await htmlTranscript(this.client, message.channel, message.member, reason);
        } else {
          await textTranscript(this.client, message.channel, message.member, reason);
        }
      } else if (b.customId == `cancelClose`) {
        collector.stop("claimed");
        confirmRow.components[0].setStyle(ButtonStyle.Secondary).setDisabled(true);
        confirmRow.components[1].setStyle(ButtonStyle.Secondary).setDisabled(true);
        m.edit({ embeds: [confirm], components: [confirmRow] });
        message.channel.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.cancel_delete, this.client.embeds.success_color)] });
      }
    });
    collector.on("end", (collected, reason) => {
      if(!message.channel) return;
      confirmRow.components[0].setStyle(ButtonStyle.Secondary).setDisabled(true);
      confirmRow.components[1].setStyle(ButtonStyle.Secondary).setDisabled(true);

      m.edit({ embeds: [confirm], components: [confirmRow] });
      if(reason.toLowerCase() == "claimed") return;
      
      message.channel.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.time_expired, this.client.embeds.error_color)] });
    });
  }
};
