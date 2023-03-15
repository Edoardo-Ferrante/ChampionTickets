const Command = require("../../structures/Command");
const Discord = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();

module.exports = class Review extends Command {
  constructor(client) {
    super(client, {
      name: "review",
      description: client.cmdConfig.review.description,
      usage: client.cmdConfig.review.usage,
      permissions: client.cmdConfig.review.permissions,
      aliases: client.cmdConfig.review.aliases,
      category: "service",
      listed: client.cmdConfig.review.enabled,
      slash: true,
      options: [{
        name: 'user',
        type: Discord.ApplicationCommandOptionType.User,
        description: "User to review",
        required: true,
      }]
    });
  }

  async run(message, args) {
    let config = this.client.config;
    let language = this.client.language;
    let user = message.mentions.users.first() || this.client.users.cache.get(args[0]);

    if(!user) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.review.usage)] });

    let member = message.guild.members.cache.get(user.id);
    if((!this.client.utils.hasPermissions(message, member, config.general.review_req.permissions) || !this.client.utils.hasRole(this.client, message.guild, member, config.general.review_req.roles, true)) 
      && this.client.config.general.review_type == "NORMAL")
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.reviews.cannot_review, this.client.embeds.error_color)] });

    // if(user.id == message.author.id && this.client.config.general.review_type == "NORMAL") return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.language.titles.error, this.client.language.service.review_self, this.client.embeds.error_color )] });
    
    let commission = await db.get(`commission_${message.channel.id}`);
    if(this.client.config.general.review_type == "STAFF") {
      message.author = user;
      user = this.client.users.cache.get(commission.quoteList[0].user);
      if(user.id == message.author.id) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.language.titles.error, this.client.language.service.review_self, this.client.embeds.error_color )] });
    }

    let dataReview = {
      user: user.id,
      comment: "",
      stars: 0
    }
  
    let selectRow = new Discord.ActionRowBuilder().addComponents(
      new Discord.StringSelectMenuBuilder()
        .setCustomId("rate_select_menu")
        .setPlaceholder(language.service.reviews.placeholder)
        .addOptions([{
          label: language.service.reviews.stars.one,
          value: "1",
          emoji: config.emojis.review.one
        }, {
          label: language.service.reviews.stars.two,
          value: "2",
          emoji: config.emojis.review.two
        }, {
          label: language.service.reviews.stars.three,
          value: "3",
          emoji: config.emojis.review.three
      }, {
         label: language.service.reviews.stars.four,
         value: "4",
         emoji: config.emojis.review.four
      }, {
         label: language.service.reviews.stars.five,
         value: "5",
         emoji: config.emojis.review.five
      }])
    );

    let cancelRow = new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.ButtonBuilder()
          .setCustomId("review_cancel")
          .setLabel(language.buttons.cancel_review)
          .setStyle(Discord.ButtonStyle.Danger)
          .setEmoji(config.emojis.stop)
      );
    
    let rateMsg = await message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.reviews.rating, this.client.embeds.general_color)], components: [selectRow, cancelRow] });
    
    let rateFilter = (i) => (i.customId == "rate_select_menu" || i.customId == "review_cancel") && i.user.id == message.author.id;
    let rateCollector = await rateMsg.createMessageComponentCollector({ filter: rateFilter, time: 300_000 });
    
    rateCollector.on("collect", async(i) => {
      if(i.type == Discord.InteractionType.MessageComponent && i.customId == "rate_select_menu") {
        let value = i.values[0];
        if(!isNaN(value)) {
          selectRow.components[0].setDisabled(true);
          await rateMsg.edit({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.reviews.rating, this.client.embeds.general_color)], components: [selectRow] });
          
          dataReview.stars = value;
          let commentInput = new Discord.ActionRowBuilder()
            .addComponents(
              new Discord.TextInputBuilder()
              .setCustomId("review_comment")
              .setLabel(language.modals.labels.comment)
              .setPlaceholder(language.modals.placeholders.comment)
              .setMinLength(6)
              .setMaxLength(config.general.review_limit)
              .setRequired(false)
              .setStyle(Discord.TextInputStyle.Paragraph)
            );
          
          let commentModal = new Discord.ModalBuilder()
            .setTitle(language.titles.review)
            .setCustomId("comment_modal")
            .addComponents(commentInput);
            
          i.showModal(commentModal);
          
          rateCollector.stop("collected");
        
          const filter = (i) => i.customId == 'comment_modal' && i.user.id == message.author.id;
          i.awaitModalSubmit({ filter, time: 120_000 }).then(async(md) => {
            let commentValue = md.fields.getTextInputValue("review_comment").split(/\r?\n/)
              .filter(line => line.trim() !== "")
              .join("\n");
            
            dataReview.comment = commentValue || "";
            
            await md.reply({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.reviews.sent, this.client.embeds.success_color)] });
            
            let rId = this.client.utils.generateId();
            
            let rObject = {
              id: rId,
              author: message.author.id,
              user: user.id,
              rating: dataReview.stars,
              comment: dataReview.comment,
              date: new Date()
            }
            
            this.client.utils.pushReview(message.channel, user.id, rObject);
            
            let embed = new Discord.EmbedBuilder()
              .setColor(this.client.embeds.service.review.color);
            
            if (this.client.embeds.service.review.title) embed.setTitle(this.client.embeds.service.review.title);
            
            let review = config.emojis.review.star.repeat(Math.floor(dataReview.stars));
            
            if (this.client.embeds.service.review.description) embed.setDescription(this.client.embeds.service.review.description.replace("<author>", message.author)
              .replace("<user>", user)
              .replace("<date>", new Date().toLocaleString("en-GB"))
              .replace("<review>", review)
              .replace("<numRating>", dataReview.stars)
              .replace("<comment>", commentValue || this.client.language.service.reviews.no_comment));
            
            let field = this.client.embeds.service.review.fields;
            for (let i = 0; i < this.client.embeds.service.review.fields.length; i++) {
              embed.addFields([{ name: field[i].title, value: field[i].description.replace("<author>", message.author)
                .replace("<user>", user)
                .replace("<date>", new Date().toLocaleString("en-GB"))
                .replace("<review>", review)
                .replace("<numRating>", dataReview.stars)
                .replace("<comment>", commentValue || this.client.language.service.reviews.no_comment) }])
            }
            
            if (this.client.config.general.send_review == true) {
              if (this.client.utils.findChannel(message.guild, this.client.config.channels.reviews)) {
                let reviewCh = this.client.utils.findChannel(message.guild, this.client.config.channels.reviews);
                let secondEmbed = new Discord.EmbedBuilder()
                  .setColor(this.client.embeds.service.reviewAnnounce.color);
            
                if (this.client.embeds.service.reviewAnnounce.title) secondEmbed.setTitle(this.client.embeds.service.reviewAnnounce.title);
            
                if (this.client.embeds.service.reviewAnnounce.description) secondEmbed.setDescription(this.client.embeds.service.reviewAnnounce.description.replace("<author>", message.author)
                  .replace("<user>", user)
                  .replace("<date>", new Date().toLocaleString("en-GB"))
                  .replace("<review>", review)
                  .replace("<numRating>", dataReview.stars)
                  .replace("<comment>", commentValue || this.client.language.service.reviews.no_comment));
            
                let field = this.client.embeds.service.reviewAnnounce.fields;
                for (let i = 0; i < this.client.embeds.service.reviewAnnounce.fields.length; i++) {
                  secondEmbed.addFields([{ name: field[i].title, value: field[i].description.replace("<author>", message.author)
                    .replace("<user>", user)
                    .replace("<date>", new Date().toLocaleString("en-GB"))
                    .replace("<review>", review)
                    .replace("<numRating>", dataReview.stars)
                    .replace("<comment>", commentValue || this.client.language.service.reviews.no_comment) }])
                }
            
                if (this.client.embeds.service.reviewAnnounce.footer == true) secondEmbed.setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL() }).setTimestamp();
                if (this.client.embeds.service.reviewAnnounce.thumbnail == true) secondEmbed.setThumbnail(user.displayAvatarURL());
            
                reviewCh.send({ embeds: [secondEmbed] });
              }
            }
            
            if (this.client.embeds.service.review.footer == true) embed.setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL() }).setTimestamp();
            if (this.client.embeds.service.review.thumbnail == true) embed.setThumbnail(user.displayAvatarURL({ dynamic: true }));
            
            message.channel.send({ embeds: [embed] });
          }).catch((err) => {
            message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.reviews.time, this.client.embeds.error_color)] });
          });
        }
      } else if(i.type == Discord.InteractionType.MessageComponent && i.customId == "review_cancel") {
        message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.reviews.cancel, this.client.embeds.success_color)] });
        rateCollector.stop("canceled");
      }
    });
  
    rateCollector.on("end", async(collected, reason) => {
      if(reason != "collected" && reason != "canceled") {
        selectRow.components[0].setDisabled(true);
        if(rateMsg) await rateMsg.edit({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.reviews.rating, this.client.embeds.general_color)], components: [selectRow] });
        
        await message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.reviews.time, this.client.embeds.error_color)] });
      }
    });
  }
  async slashRun(interaction, args) {
    let config = this.client.config;
    let language = this.client.language;

    let user = interaction.options.getUser("user");

    let member = interaction.guild.members.cache.get(user.id);
    if((!this.client.utils.hasPermissions(interaction, member, config.general.review_req.permissions) || !this.client.utils.hasRole(this.client, interaction.guild, member, config.general.review_req.roles, true))
      && this.client.config.general.review_type == "NORMAL") 
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.reviews.cannot_review, this.client.embeds.error_color)] });

    if(user.id == interaction.user.id && this.client.config.general.review_type == "NORMAL") return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.language.titles.error, this.client.language.service.review_self, this.client.embeds.error_color )] });

    
    let commission = await db.get(`commission_${interaction.channel.id}`);
    if(this.client.config.general.review_type == "STAFF") {
      interaction.user = user;
      user = this.client.users.cache.get(commission.quoteList[0].user);
      if(user.id == interaction.user.id) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.language.titles.error, this.client.language.service.review_self, this.client.embeds.error_color )] });
    }

    let dataReview = {
      user: user.id,
      comment: "",
      stars: 0
    }
  
    let selectRow = new Discord.ActionRowBuilder().addComponents(
      new Discord.StringSelectMenuBuilder()
        .setCustomId("rate_select_menu")
        .setPlaceholder(language.service.reviews.placeholder)
        .addOptions([{
          label: language.service.reviews.stars.one,
          value: "1",
          emoji: config.emojis.review.one
        }, {
          label: language.service.reviews.stars.two,
          value: "2",
          emoji: config.emojis.review.two
        }, {
          label: language.service.reviews.stars.three,
          value: "3",
          emoji: config.emojis.review.three
      }, {
         label: language.service.reviews.stars.four,
         value: "4",
         emoji: config.emojis.review.four
      }, {
         label: language.service.reviews.stars.five,
         value: "5",
         emoji: config.emojis.review.five
      }])
    );

    let cancelRow = new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.ButtonBuilder()
          .setCustomId("review_cancel")
          .setLabel(language.buttons.cancel_review)
          .setStyle(Discord.ButtonStyle.Danger)
          .setEmoji(config.emojis.stop)
      );
    
    let rateMsg = await interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.reviews.rating, this.client.embeds.general_color)], components: [selectRow, cancelRow], fetchReply: true });
    
    let rateFilter = (i) => (i.customId == "rate_select_menu" || i.customId == "review_cancel") && i.user.id == interaction.user.id;

    let rateCollector = await rateMsg.createMessageComponentCollector({ filter: rateFilter, componentType: Discord.ComponentType.SelectMenu, time: 300_000 });
    
    rateCollector.on("collect", async(i) => {
      if(i.type == Discord.InteractionType.MessageComponent && i.customId == "rate_select_menu") {
        let value = i.values[0];
        if(!isNaN(value)) {
          selectRow.components[0].setDisabled(true);
          await rateMsg.edit({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.reviews.rating, this.client.embeds.general_color)], components: [selectRow] });
          
          dataReview.stars = value;
          let commentInput = new Discord.ActionRowBuilder()
            .addComponents(
              new Discord.TextInputBuilder()
              .setCustomId("review_comment")
              .setLabel(language.modals.labels.comment)
              .setPlaceholder(language.modals.placeholders.comment)
              .setMinLength(6)
              .setMaxLength(config.general.review_limit)
              .setRequired(true)
              .setStyle(Discord.TextInputStyle.Paragraph)
            );
          
          let commentModal = new Discord.ModalBuilder()
            .setTitle(language.titles.review)
            .setCustomId("comment_modal")
            .addComponents(commentInput);
            
          i.showModal(commentModal);
          
          rateCollector.stop("collected");
        
          const filter = (i) => i.customId == 'comment_modal' && i.user.id == interaction.user.id;
          i.awaitModalSubmit({ filter, time: 120_000 }).then(async(md) => {
            let commentValue = md.fields.getTextInputValue("review_comment").split(/\r?\n/)
            .filter(line => line.trim() !== "")
            .join("\n");
            
            dataReview.comment = commentValue || this.client.language.service.reviews.no_comment;
            
            await md.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.reviews.sent, this.client.embeds.success_color)] });
            
            let rId = this.client.utils.generateId();
            
            let rObject = {
              id: rId,
              author: interaction.user.id,
              user: user.id,
              rating: dataReview.stars,
              comment: dataReview.comment,
              date: new Date()
            }
            
            this.client.utils.pushReview(interaction.channel, user.id, rObject);
            
            let embed = new Discord.EmbedBuilder()
              .setColor(this.client.embeds.service.review.color);
            
            if (this.client.embeds.service.review.title) embed.setTitle(this.client.embeds.service.review.title);
            
            let review = config.emojis.review.star.repeat(Math.floor(dataReview.stars));
            
            if (this.client.embeds.service.review.description) embed.setDescription(this.client.embeds.service.review.description.replace("<author>", interaction.user)
              .replace("<user>", user)
              .replace("<date>", new Date().toLocaleString("en-GB"))
              .replace("<review>", review)
              .replace("<numRating>", dataReview.stars)
              .replace("<comment>", commentValue || this.client.language.service.reviews.no_comment));
            
            let field = this.client.embeds.service.review.fields;
            for (let i = 0; i < this.client.embeds.service.review.fields.length; i++) {
              embed.addFields([{ name: field[i].title, value: field[i].description.replace("<author>", interaction.user)
                .replace("<user>", user)
                .replace("<date>", new Date().toLocaleString("en-GB"))
                .replace("<review>", review)
                .replace("<numRating>", dataReview.stars)
                .replace("<comment>", commentValue || this.client.language.service.reviews.no_comment) }])
            }
            
            if (this.client.config.general.send_review == true) {
              if (this.client.utils.findChannel(interaction.guild, this.client.config.channels.reviews)) {
                let reviewCh = this.client.utils.findChannel(interaction.guild, this.client.config.channels.reviews);
                let secondEmbed = new Discord.EmbedBuilder()
                  .setColor(this.client.embeds.service.reviewAnnounce.color);
            
                if (this.client.embeds.service.reviewAnnounce.title) secondEmbed.setTitle(this.client.embeds.service.reviewAnnounce.title);
            
                if (this.client.embeds.service.reviewAnnounce.description) secondEmbed.setDescription(this.client.embeds.service.reviewAnnounce.description.replace("<author>", interaction.user)
                  .replace("<user>", user)
                  .replace("<date>", new Date().toLocaleString("en-GB"))
                  .replace("<review>", review)
                  .replace("<numRating>", dataReview.stars)
                  .replace("<comment>", commentValue || this.client.language.service.reviews.no_comment));
            
                let field = this.client.embeds.service.reviewAnnounce.fields;
                for (let i = 0; i < this.client.embeds.service.reviewAnnounce.fields.length; i++) {
                  secondEmbed.addFields([{ name: field[i].title, value: field[i].description.replace("<author>", interaction.user)
                    .replace("<user>", user)
                    .replace("<date>", new Date().toLocaleString("en-GB"))
                    .replace("<review>", review)
                    .replace("<numRating>", dataReview.stars)
                    .replace("<comment>", commentValue || this.client.language.service.reviews.no_comment) }])
                }
            
                if (this.client.embeds.service.reviewAnnounce.footer == true) secondEmbed.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() }).setTimestamp();
                if (this.client.embeds.service.reviewAnnounce.thumbnail == true) secondEmbed.setThumbnail(interaction.user.displayAvatarURL());
            
                reviewCh.send({ embeds: [secondEmbed] });
              }
            }
            
            if (this.client.embeds.service.review.footer == true) embed.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() }).setTimestamp();
            if (this.client.embeds.service.review.thumbnail == true) embed.setThumbnail(user.displayAvatarURL({ dynamic: true }));
            
            interaction.followUp({ embeds: [embed] });
          }).catch ((err) => {
            console.log(err)
            interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.reviews.time, this.client.embeds.error_color)] });
          });
        }
      } else if(i.type == Discord.InteractionType.MessageComponent && i.customId == "rate_cancel") {
        interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.reviews.cancel, this.client.embeds.success_color)] });
        rateCollector.stop("canceled");
      }
    });
  
    rateCollector.on("end", async(collected, reason) => {
      if(reason != "collected" && reason != "canceled") {
        selectRow.components[0].setDisabled(true);
        if(rateMsg) await rateMsg.edit({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.reviews.rating, this.client.embeds.general_color)], components: [selectRow] });
        
        await interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.reviews.time, this.client.embeds.error_color)] });
      }
    });
  }
};
