const Command = require("../../structures/Command");
const Discord = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();

module.exports = class Quote extends Command {
  constructor(client) {
    super(client, {
      name: "quote",
      description: client.cmdConfig.quote.description,
      usage: client.cmdConfig.quote.usage,
      permissions: client.cmdConfig.quote.permissions,
      aliases: client.cmdConfig.quote.aliases,
      category: "service",
      listed: client.cmdConfig.quote.enabled,
      slash: true,
    });
  }

  async run(message, args) {
    let price = args[0];
    let timeFrame = args[1];
    let notes = args.slice(2).join(' ');

    let commission = await db.get(`commission_${message.channel.id}`);
    if(!commission || commission?.status != "NO_STATUS") return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.commission.not_commission, this.client.embeds.error_color)] });
    if(!price) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.quote.usage)] });

    let chAnswers = await db.get(`channelQuestions_${message.channel.id}`) || [];
    if(chAnswers.length == 0) message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.commission.no_data, this.client.embeds.error_color)] });

    let embed = new Discord.EmbedBuilder()
      .setColor(this.client.embeds.service.quote.color);
    if(this.client.embeds.service.quote.title) embed.setTitle(this.client.embeds.service.quote.title);

    let history = await db.get(`reviews_${message.guild.id}_${message.author.id}`) || [];
    let bio = await db.get(`bio_${message.guild.id}_${message.author.id}`) || "N/A";
    let availableHours = await db.get(`availableHours_${message.author.id}`) || "N/A";

    let totalRating = 0;
    for(let i = 0; i < history.length; i++) {
      totalRating += parseInt(history[i].rating);
    }
    
    totalRating = Math.floor(totalRating/history.length);
    
    if(this.client.embeds.service.quote.description) embed.setDescription(this.client.embeds.service.quote.description.replace("<price>", price)
      .replace("<priceWithTax>", this.client.utils.priceWithTax(this.client, price))
      .replace("<user>", message.author)
      .replace("<bio>", bio)
      .replace("<availableHours>", availableHours)
      .replace("<client>", `<@!${commission.user}>`)
      .replace("<currency>", this.client.config.general.currency)
      .replace("<currencySymbol>", this.client.config.general.currency_symbol)
      .replace("<timeFrame>", timeFrame || this.client.language.service.commission.no_time_frame)
      .replace("<notes>", notes || this.client.language.service.commission.no_notes)
      .replace("<rating>", this.client.config.emojis.review.star.repeat(totalRating)));
    
    let field = this.client.embeds.service.quote.fields;
    for(let i = 0; i < this.client.embeds.service.quote.fields.length; i++) {
      embed.addFields([{ name: field[i].title.replace("<currency>", this.client.config.general.currency), value: field[i].description.replace("<price>", price)
        .replace("<priceWithTax>", this.client.utils.priceWithTax(this.client, price))
        .replace("<user>", message.author)
        .replace("<bio>", bio)
        .replace("<availableHours>", availableHours)
        .replace("<client>", `<@!${commission.user}>`)
        .replace("<currency>", this.client.config.general.currency)
        .replace("<currencySymbol>", this.client.config.general.currency_symbol)
        .replace("<timeFrame>", timeFrame || this.client.language.service.commission.no_time_frame)
        .replace("<notes>", notes || this.client.language.service.commission.no_notes)
        .replace("<rating>", this.client.config.emojis.review.star.repeat(totalRating)), inline: true }])
    }
    
    if(this.client.embeds.service.quote.footer == true ) embed.setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL() }).setTimestamp();
    if(this.client.embeds.service.quote.thumbnail == true) embed.setThumbnail(user.displayAvatarURL());
      
    let bttnRow = new Discord.ActionRowBuilder().addComponents(
      new Discord.ButtonBuilder()
        .setLabel(this.client.language.buttons.quote)
        .setStyle(Discord.ButtonStyle.Success)
        .setEmoji(this.client.config.emojis.quote || {})
        .setCustomId("accept_quote")
    );

    message.channel.send({ content: `<@!${commission.user}>`, embeds: [embed], components: [bttnRow] }).then(async(msg) => {
      commission.quoteList.push({
        user: message.author.id,
        messageId: msg.id,
        timeFrame,
        price,
        notes,
      });

      await db.set(`commission_${message.channel.id}`, commission);
      
      setTimeout(() => message.delete().catch((err) => {}), 1000);
    });
  }
  
  async slashRun(interaction, args) {
    let commission = await db.get(`commission_${interaction.channel.id}`);
    if(!commission || commission?.status != "NO_STATUS") return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.not_commission, this.client.embeds.error_color)], ephemeral: this.client.cmdConfig.quote.ephemeral });

    let chAnswers = await db.get(`channelQuestions_${interaction.channel.id}`) || [];
    if(chAnswers.length == 0) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.no_data, this.client.embeds.error_color)], ephemeral: this.client.cmdConfig.quote.ephemeral });

    let commPrice = new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.TextInputBuilder()
        .setCustomId("commission_price")
        .setLabel(this.client.language.modals.labels.comm_price)
        .setPlaceholder(this.client.language.modals.placeholders.comm_price)
        .setMinLength(1)
        .setRequired(true)
        .setStyle(Discord.TextInputStyle.Short)
      );
    
    let commTime = new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.TextInputBuilder()
        .setCustomId("commission_time")
        .setLabel(this.client.language.modals.labels.comm_time)
        .setPlaceholder(this.client.language.modals.placeholders.comm_time)
        .setMinLength(1)
        .setRequired(true)
        .setStyle(Discord.TextInputStyle.Short)
      );
    
    let commNote = new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.TextInputBuilder()
        .setCustomId("commission_note")
        .setLabel(this.client.language.modals.labels.comm_note)
        .setPlaceholder(this.client.language.modals.placeholders.comm_note)
        .setStyle(Discord.TextInputStyle.Paragraph)
      );

    let commissionModal = new Discord.ModalBuilder()
      .setTitle(this.client.language.titles.review)
      .setCustomId("commission_modal")
      .addComponents([commPrice, commTime, commNote]);

    interaction.showModal(commissionModal);

    const filter = (i) => i.customId == 'commission_modal' && i.user.id == interaction.user.id;
    interaction.awaitModalSubmit({ filter, time: 120_000 }).then(async(md) => {
      const price = md.fields.getTextInputValue("commission_price");
      const timeFrame = md.fields.getTextInputValue("commission_time");
      const notes = md.fields.getTextInputValue("commission_note");

      let commission = await db.get(`commission_${interaction.channel.id}`);
      if(!commission || commission?.status != "NO_STATUS") return md.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.not_commission, this.client.embeds.error_color)], ephemeral: this.client.cmdConfig.quote.ephemeral });

      let embed = new Discord.EmbedBuilder()
        .setColor(this.client.embeds.service.quote.color);
      if(this.client.embeds.service.quote.title) embed.setTitle(this.client.embeds.service.quote.title);

      let history = await db.get(`reviews_${interaction.guild.id}_${interaction.user.id}`) || [];
      let bio = await db.get(`bio_${interaction.guild.id}_${interaction.user.id}`) || "N/A";
      let availableHours = await db.get(`availableHours_${interaction.user.id}`) || "N/A";

      let totalRating = 0;
      for(let i = 0; i < history.length; i++) {
        totalRating += parseInt(history[i].rating);
      }

      totalRating = Math.floor(totalRating/history.length);

      if(this.client.embeds.service.quote.description) embed.setDescription(this.client.embeds.service.quote.description.replace("<price>", price)
        .replace("<priceWithTax>", this.client.utils.priceWithTax(this.client, price))
        .replace("<user>", interaction.user)
        .replace("<bio>", bio)
        .replace("<availableHours>", availableHours)
        .replace("<currency>", this.client.config.general.currency)
        .replace("<currencySymbol>", this.client.config.general.currency_symbol)
        .replace("<timeFrame>", timeFrame || this.client.language.service.commission.no_time_frame)
        .replace("<notes>", notes || this.client.language.service.commission.no_notes)
        .replace("<rating>", this.client.config.emojis.review.star.repeat(totalRating)));

      let field = this.client.embeds.service.quote.fields;
      for(let i = 0; i < this.client.embeds.service.quote.fields.length; i++) {
        embed.addFields([{ name: field[i].title.replace("<currency>", this.client.config.general.currency), value: field[i].description.replace("<price>", price)
          .replace("<priceWithTax>", this.client.utils.priceWithTax(this.client, price))
          .replace("<user>", interaction.user)
          .replace("<bio>", bio)
          .replace("<availableHours>", availableHours)
          .replace("<currency>", this.client.config.general.currency)
          .replace("<currencySymbol>", this.client.config.general.currency_symbol)
          .replace("<timeFrame>", timeFrame || this.client.language.service.commission.no_time_frame)
          .replace("<notes>", notes || this.client.language.service.commission.no_notes)
          .replace("<rating>", this.client.config.emojis.review.star.repeat(totalRating)), inline: true }])
      }

      if(this.client.embeds.service.quote.footer == true ) embed.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() }).setTimestamp();
      if(this.client.embeds.service.quote.thumbnail == true) embed.setThumbnail(user.displayAvatarURL());
        
      let bttnRow = new Discord.ActionRowBuilder().addComponents(
        new Discord.ButtonBuilder()
          .setLabel(this.client.language.buttons.quote)
          .setStyle(Discord.ButtonStyle.Success)
          .setEmoji(this.client.config.emojis.quote || {})
          .setCustomId("accept_quote")
      );

      await md.reply({ content: `<@!${commission.user}>`, embeds: [embed], components: [bttnRow], fetchReply: true }).then(async(msg) => {
        commission.quoteList.push({
          user: interaction.user.id,
          messageId: msg.id,
          price,
          timeFrame,
          notes,
        });

        await db.set(`commission_${interaction.channel.id}`, commission);
      });
    });
  }
};
