const Discord = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();

module.exports = async(client, channel, guild) => {
  const config = client.config;
  const language = client.language;
  if(config.general.ask_review == false) return;
  const ticketData = await db.get(`ticketData_${channel.id}`);
  const claimedBy = await db.get(`ticketClaimed_${channel.id}`) || await db.get(`autoClaim_${channel.id}`) || null;
  const user = client.users.cache.get(ticketData?.owner);
  if(!user || claimedBy == null) return;
  let dataReview = {
    user,
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
        .setStyle(Discord.ButtonStyle.Danger)
        .setEmoji(config.emojis.stop)
    );
  
  let rateMsg;
  setTimeout(async() => {
    rateMsg = await user.send({ embeds: [client.embedBuilder(client, user, client.embeds.title, client.language.service.reviews.rating_dm, client.embeds.general_color)], components: [selectRow, cancelRow] }).catch((err) => {
      return console.error("User's DM Closed");
    });
  }, 2500);
  
  const dm = await user.createDM();
  
  let rateFilter = (i) => i.channel.type == Discord.ChannelType.DM && i.user.id == user.id;
  let rateCollector = await dm.createMessageComponentCollector({ filter: rateFilter, time: 300_000 });
  
  rateCollector.on("collect", async(i) => {
    if(i.type == Discord.InteractionType.MessageComponent && i.customId == "rate_select_menu") {
      let value = i.values[0];
      if(!isNaN(value)) {
        selectRow.components[0].setDisabled(true);

        await rateMsg.edit({ embeds: [client.embedBuilder(client, user, client.embeds.title, client.language.service.reviews.rating_dm, client.embeds.general_color)], components: [selectRow] });
        
        dataReview.stars = value;
        let commentInput = new Discord.ActionRowBuilder()
          .addComponents(
            new Discord.TextInputBuilder()
            .setCustomId("review_comment")
            .setLabel(language.modals.labels.comment)
            .setPlaceholder(language.modals.placeholders.comment)
            .setMinLength(6)
            .setRequired(true)
            .setStyle(Discord.TextInputStyle.Paragraph)
          );
        
        let commentModal = new Discord.ModalBuilder()
          .setTitle(language.titles.review)
          .setCustomId("comment_modal")
          .addComponents(commentInput);
          
        i.showModal(commentModal);
        
        rateCollector.stop("collected");
      
        const filter = (i) => i.customId == 'comment_modal' && i.user.id == user.id;
        i.awaitModalSubmit({ filter, time: 120_000 }).then(async(md) => {
          let commentValue = md.fields.getTextInputValue("review_comment").split(/\r?\n/)
            .filter(line => line.trim() !== "")
            .join("\n");
          
          dataReview.comment = commentValue || "";
          
          await md.reply({ embeds: [client.embedBuilder(client, user, client.embeds.title, client.language.service.reviews.sent, client.embeds.success_color)] });
          
          let rId = client.utils.generateId();
          
          let rObject = {
            id: rId,
            author: user.id,
            user: claimedBy,
            rating: dataReview.stars,
            comment: dataReview.comment,
            date: new Date()
          }

          const review = config.emojis.review.star.repeat(Math.floor(dataReview.stars));
          
          client.utils.pushReview(channel, claimedBy, rObject);
          
          let announceEmbed = new Discord.EmbedBuilder()
            .setColor(client.embeds.service.reviewAnnounce.color);
          
          if (client.embeds.service.reviewAnnounce.title) announceEmbed.setTitle(client.embeds.service.reviewAnnounce.title);
          
          if (client.embeds.service.reviewAnnounce.description) announceEmbed.setDescription(client.embeds.service.reviewAnnounce.description.replace("<author>", user)
            .replace("<user>", `<@!${claimedBy}>`)
            .replace("<review>", review)
            .replace("<numRating>", dataReview.stars)
            .replace("<date>", new Date().toLocaleString("en-GB"))
            .replace("<comment>", dataReview.comment));
          
          let field = client.embeds.service.reviewAnnounce.fields;
          for (let i = 0; i < client.embeds.service.reviewAnnounce.fields.length; i++) {
            announceEmbed.addFields([{ name: field[i].title, value: field[i].description.replace("<author>", user)
              .replace("<user>", `<@!${claimedBy}>`)
              .replace("<review>", review)
              .replace("<numRating>", dataReview.stars)
              .replace("<date>", new Date().toLocaleString("en-GB"))
              .replace("<comment>", dataReview.comment) }])
          }
          
          if (client.embeds.service.reviewAnnounce.footer == true) announceEmbed.setFooter({ text: user.username, iconURL: user.displayAvatarURL({ dynamic: true }) }).setTimestamp();
          if (client.embeds.service.reviewAnnounce.thumbnail == true) announceEmbed.setThumbnail(user.displayAvatarURL({ dynamic: true }));
          
          let reviewCh = client.utils.findChannel(guild, client.config.channels.reviews);
          if(reviewCh) reviewCh.send({ embeds: [announceEmbed] });
        
          rateCollector.stop("collected");
        }).catch(async(err) => {
          await user.send({ embeds: [client.embedBuilder(client, user, client.embeds.title, client.language.service.reviews.time, client.embeds.success_color)] }).catch((err) => console.log("User's DM Closed"));
        });
      }
    } else if(i.type == Discord.InteractionType.MessageComponent && i.customId == "review_cancel") {
      await i.deferUpdate();

      selectRow.components[0].setDisabled(true);

      await rateMsg.edit({ embeds: [client.embedBuilder(client, user, client.embeds.title, client.language.service.reviews.rating_dm, client.embeds.general_color)], components: [selectRow] });
        
      user.send({ embeds: [client.embedBuilder(client, user, client.embeds.title, client.language.service.reviews.cancel, client.embeds.success_color)] });
      rateCollector.stop("canceled");
    }
  });

  rateCollector.on("end", async(collected, reason) => {
    if(reason != "collected" && reason != "canceled") {
      selectRow.components[0].setDisabled(true);
      if(rateMsg) await rateMsg.edit({ embeds: [client.embedBuilder(client, user, client.embeds.title, client.language.service.reviews.rating_dm, client.embeds.general_color)], components: [selectRow] });
      
      await user.send({ embeds: [client.embedBuilder(client, user, client.embeds.title, client.language.service.reviews.time, client.embeds.success_color)] }).catch((err) => console.log("User's DM Closed"));
    }
  });
}
