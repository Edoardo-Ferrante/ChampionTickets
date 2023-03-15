const Discord = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();
const fetch = require("node-fetch");

const chatAskQuestions = async(client, member, channel, questionsList, ticketCategory = {}) => {
  let config = client.config;
  if(questionsList.length == 0) return;
  let answersList = new Map();
  const filter = msg => msg.author.id === member.id;

  const collector = channel.createMessageCollector({ filter, idle: client.config.general.question_idle * 1000, max: questionsList.length });
  let questionNumber = 0;

  await db.set(`listOfQuestions_${channel.id}`, {
    list: questionsList,
    ticketCategory
  });

  const cancelAsk = new Discord.ActionRowBuilder()
    .addComponents(
      new Discord.ButtonBuilder().setCustomId("cancel_ask")
        .setEmoji(config.emojis.stop)
        .setStyle(Discord.ButtonStyle.Danger)
    );

  let questionEmbed = new Discord.EmbedBuilder()
    .setTitle(`${questionsList[questionNumber].name}`)
    .setDescription(`${questionsList[questionNumber].question}`)
    .setFooter({ text: member.user.username, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
    .setTimestamp()
    .setColor(client.embeds.general_color);
    
  let msg = await channel.send({ embeds: [questionEmbed], components: client.config.general.cancel_ask == true ? [cancelAsk] : [] });
    
  if(client.config.general.cancel_ask == true) {
    const awaitFilter = (i) => i.customId == "cancel_ask" && i.user.id == member.id;
    
    msg.awaitMessageComponent({ awaitFilter }).then(async (i) => {
      await i.deferUpdate();
      await msg.delete();
      collector.stop();
    }).catch((e) => {});
  }

  let content = "";
  collector.on('collect', async(m) => {
    if(m.content.length >= 350) content = `${m.content.slice(0, 347)}..`;
    else content = m.content;

    if(m.attachments.size > 0) {
      let attUrls = "";
      
      for(const att of m.attachments) {
        let uploaded = await uploadImage(att[1].url);
        attUrls += `\n` + uploaded.image.url;
      }

      if(m.content.length == 0) content = attUrls;
      else content += `\n\n` + attUrls;
    }

    answersList.set(questionsList[questionNumber].name, `${content}`);
    questionNumber++;
    m.delete();
    if(questionNumber < questionsList.length) {
      questionEmbed.setTitle(questionsList[questionNumber].name);
      questionEmbed.setDescription(questionsList[questionNumber].question);
      await msg.edit({ embeds: [questionEmbed], components: client.config.general.cancel_ask == true ? [cancelAsk] : [] });
    } else if(questionNumber == questionsList.length) {
      finalList = new Map(answersList)
      questionEmbed.setTitle(client.language.titles.answers);
      questionEmbed.setDescription(client.language.ticket.loading_answers);
      await msg.edit({ embeds: [questionEmbed], components: [] });

      let ansList = [];
      let answersArray = [...answersList.values()];
      let qAnswers = new Discord.EmbedBuilder()
        .setTitle(ticketCategory.type == "COMMISSION" ? client.language.titles.commission : client.language.titles.answers)
        .setColor(client.embeds.general_color)
        .setFooter({ text: member.user.username, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      for(let i = 0; i < answersArray.length; i++) {
        qAnswers.addFields([{ name: questionsList[i].name, value: answersArray[i] }]);
        ansList.push({
          question: questionsList[i].name,
          answer: answersArray[i]
        });
      }

      await db.set(`channelQuestions_${channel.id}`, ansList);

      await msg.edit({ embeds: [qAnswers], components: [] });

      if(config.general.send_commissions == true && config.channels.commissions != "" && ticketCategory.type == "COMMISSION") {
        qAnswers.setTitle(client.embeds.service.newCommission.title)
          .setColor(client.embeds.service.newCommission.color);

        if(client.embeds.service.newCommission.description) qAnswers.setDescription(client.embeds.service.newCommission.description.replace("<user>", member.user));
        if(client.embeds.service.newCommission.thumbnail == true) qAnswers.setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
        if(client.embeds.service.newCommission.footer == true) qAnswers.setFooter({ text: member.user.username, iconURL: member.user.displayAvatarURL({ dynamic: true }) });

        let commChannel = client.utils.findChannel(channel.guild, config.channels.commissions);

        const commRow = new Discord.ActionRowBuilder()
          .addComponents(
            new Discord.ButtonBuilder()
              .setStyle(Discord.ButtonStyle.Success)
              .setCustomId(`commission_${channel.id}`)
              .setLabel(client.language.buttons.send_quote)
              .setEmoji(config.emojis.send_quote || {})
          )
        
        if(config.general.msg_button == true) commRow.addComponents(
          new Discord.ButtonBuilder()
            .setStyle(Discord.ButtonStyle.Secondary)
            .setCustomId(`commissionMessage_${channel.id}`)
            .setLabel(client.language.buttons.message_client)
            .setEmoji(config.emojis.msg_commission || {})
        )

        if(ticketCategory && ticketCategory.commission) {
          let categoryCommCh = client.utils.findChannel(channel.guild, ticketCategory.commission.channel);
          let categoryCommRoles = ticketCategory.commission.roles.map((x) => {
            let findRole = client.utils.findRole(channel.guild, x);
            if(findRole) return findRole;
          });

          if(categoryCommCh) {
            await categoryCommCh.send({ content: categoryCommRoles.length > 0 ? `${categoryCommRoles.join(" ")}` : '', embeds: [qAnswers], components: [commRow] }).then(async(m) => {
              const commission = await db.get(`commission_${channel.id}`);
              commission.commMessageId = m.id;
              commission.quoteMsgChannel = m.channel.id;
              await db.set(`commission_${channel.id}`, commission);
            });
          } else {
            await commChannel.send({ content: categoryCommRoles.length > 0 ? `${categoryCommRoles.join(" ")}` : '', embeds: [qAnswers], components: [commRow] }).then(async(m) => {
              const commission = await db.get(`commission_${channel.id}`);
              commission.commMessageId = m.id;
              commission.quoteMsgChannel = m.channel.id;
              await db.set(`commission_${channel.id}`, commission);
            });
          }
        } else {
          await commChannel.send({ embeds: [qAnswers], components: [commRow] }).then(async(m) => {
            const commission = await db.get(`commission_${channel.id}`);
            commission.commMessageId = m.id;
            commission.quoteMsgChannel = m.channel.id;
            await db.set(`commission_${channel.id}`, commission);
          });
        }
      }

      collector.stop();
    }
  });

  collector.on('end', async (collected, reason) => {
    if(reason.toLowerCase() == "idle") {
      let idleEmbed = new Discord.EmbedBuilder()
        .setDescription(client.language.ticket.question_idle)
        .setColor(client.embeds.general_color);
        
      channel.send({ embeds: [idleEmbed] });
    }
  });
}

const uploadImage = (url) => {
  return fetch(`https://freeimage.host/api/1/upload?key=6d207e02198a847aa98d0a2a901485a5&source=${url}`, {
      method: "POST", 
  }).then((res) => res.json());
}

module.exports = {
  chatAskQuestions
}