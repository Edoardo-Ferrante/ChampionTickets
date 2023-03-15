const { ButtonBuilder, ButtonStyle, ComponentType, InteractionType, ActionRowBuilder } = require("discord.js");
const { chatAskQuestions } = require("./askQuestions");
const { QuickDB } = require("quick.db");
const { isUnavailable } = require("./utils");
const db = new QuickDB();
let haveTicket = false;

const checkIsAvailable = async(client, channel, member) => {
  if(client.config.general?.availability == "" || !client.config.general?.availability) return;
  const getAvailability = await isUnavailable(client);
  const startAvailable = `<t:${Math.floor(new Date().setHours(getAvailability.start.split(":")[0], getAvailability.start.split(":")[1], 0) / 1000)}:t>`;
  const endAvailable = `<t:${Math.floor(new Date().setHours(getAvailability.end.split(":")[0], getAvailability.end.split(":")[1], 0) / 1000)}:t>`;

  if(getAvailability.unavailable == true) {
    channel.send({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.not_available.replace("<user>", member.user)
      .replace("<start>", getAvailability.start)
      .replace("<end>", getAvailability.end)
      .replace("<startFormatted>", startAvailable)
      .replace("<endFormatted>", endAvailable), client.embeds.error_color)] }); 
  }
}

const mentionSupportRoles = async(client, message, category, channel) => {
  const config = client.config;
  if(config.general.mention_support == false) return;

  if(config.category.mention_support_type == "CATEGORY_ROLES") {
    let suppCategory = category.roles.map((r) => {
      let caSupport = client.utils.findRole(message.guild, r);
      
      if(caSupport) return caSupport;
    });
    
    if(suppCategory.length > 0) channel.send({ content: `${suppCategory.join(" ")}` }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000));
  } else if(config.category.mention_support_type == "SUPPORT_ROLES") {
    let suppRoles = config.roles.support.map((r) => {
      let findSupport = client.utils.findRole(message.guild, r);
      
      if(findSupport) return findSupport;
    });
    
    if(suppRoles.length > 0) channel.send({ content: `${suppRoles.join(" ")}` }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000));
  } else {
    let suppRoles = config.roles.support.map((r) => {
      let findSupport = client.utils.findRole(message.guild, r);
      
      if(findSupport) return findSupport;
    });

    let suppCategory = category.roles.map((r) => {
      let caSupport = client.utils.findRole(message.guild, r);
      
      if(caSupport) return caSupport;
    });

    const bothRoles = suppRoles.concat(suppCategory) || [];

    if(bothRoles.length > 0) channel.send({ content: `${bothRoles.join(" ")}` }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000));
  }
}

const ticketCategory = async(client, { message, msg, member, embed, interaction },
  componentList, reason, { buttonRow, row }, collector, ca, c, separatedPanel = false) => {
  const config = client.config;
  const ticketId = await db.get(`ticketCount_${message.guild.id}`);
  if(ca.type == "COMMISSION") {
    await db.set(`commission_${c.id}`, {
      user: member.id,
      commMessageId: null,
      quoteMsgChannel: null,
      quoteList: [],
      status: "NO_STATUS",
      date: new Date()
    });
  }
  let moveCategory = client.utils.findChannel(message.guild, ca.category);
  if(config.category.separateCategories == true && ca.category != "" && moveCategory) {
    let childrenTickets = await db.get(`tickets_${member.id}`) || [];
    let childrenArray = childrenTickets.filter((x) => x.parent == moveCategory.id && x.ticketCategory == ca.id);

    if(childrenArray.length < ca.limit) {
      let memberTicket = await db.get(`tickets_${member.id}`);
      memberTicket.find((x) => x.channel == c.id).ticketCategory = ca.id;
      memberTicket.find((x) => x.channel == c.id).parent = moveCategory.id;
      await db.set(`tickets_${member.id}`, memberTicket);

      c.edit({ name: config.general.rename_choose == true && ca.channel_name != "" ? client.utils.ticketPlaceholders(ca.channel_name, member.user, ticketId) : null, 
      parent: moveCategory, lockPermissions: false }).then((ch) => {
        if(client.config.category.separateRoles.enabled == true && ca.roles.length > 0) {
          let editRole = ca.roles.map((x) => client.utils.findRole(message.guild, x));
          editRole = editRole.filter((r) => r != undefined);
      
          for(const r of editRole) {
            c.permissionOverwrites.edit(r, {
              SendMessages: true,
              ViewChannel: true
            }); 
          }
          if(config.roles.support.length > 0 && client.config.category.separateRoles.both == false) {
            let suppEdit = config.roles.support.map((x) => client.utils.findRole(message.guild, x));
            suppEdit = suppEdit.filter((r) => r != undefined); 
            
            for(const supp of suppEdit) {
              c.permissionOverwrites.edit(supp, {
                SendMessages: false,
                ViewChannel: false
              });
            }
          }
        }

        if(ca.ask == false || config.category.lock_ticket == false) {
          c.permissionOverwrites.edit(member.user, {
            SendMessages: true,
            ViewChannel: true
          });
        }
        if(ca.type == "COMMISSION" && client.config.roles.commission_access.length > 0 && client.config.general.commission_perms == true) {
          client.utils.commissionAccess(client, ch, message.guild);
        }
      });
      embed.setTitle(ca.title);
      embed.setColor(ca.embed.color);
      embed.setDescription(ca.embed.description.replace("<user>", member)
        .replace("<reason>", `${reason}`)
        .replace("<category>", ca.name));
      msg.edit({ embeds: [embed], components: componentList(buttonRow)});
      let ticketData = await db.get(`ticketData_${c.id}`);
      ticketData.category = ca.id;
      await db.set(`ticketData_${c.id}`, ticketData);
      haveTicket = false;

      await mentionSupportRoles(client, message, ca, c);
      await checkIsAvailable(client, c, member);

      if(ca.ask == true && config.category.questions == false && config.category.questions_type == "MODAL") {
        buttonRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`ask_${ca.id}`)
            .setLabel(client.language.buttons.answer_questions.replace("<page>", "1"))
            .setEmoji(config.emojis.answer_questions || {})
            .setStyle(ButtonStyle.Success)
          );
        
        msg.edit({ embeds: [embed], components: componentList(buttonRow) });
        
        startCollector(client, `${ca.id}`, c, msg, member);
        // await categoryCollector(client, member, ca, c);
      } else if(ca.ask == true && config.category.questions == false && config.category.questions_type == "CHAT") {
        await chatAskQuestions(client, message.member, c, ca.questionsList, ca);
      }
    } else {
      msg.edit({ embeds: [embed], components: componentList(buttonRow, row)});
      haveTicket = true;
    }

    if(haveTicket == true) {
      if(interaction.type == InteractionType.ApplicationCommand) {
        interaction.reply({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.have_ticket_category, client.embeds.error_color)], ephemeral: true });
        return;
      } else if(interaction.type == InteractionType.MessageComponent) {
        interaction.followUp({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.have_ticket_category, client.embeds.error_color)], ephemeral: true });
        return;
      } else {
        c.send({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.have_ticket_category, client.embeds.error_color)] }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000)) 
        return;
      }
    } else {
      if(collector) collector.stop()
    }
  } else {
    let memberTickets = await db.get(`tickets_${member.id}`);
    let listOfTickets = memberTickets.filter((x) => x.member == member.id && x.ticketCategory == ca.id);

    if(listOfTickets.length < ca.limit) {
      c.setName(config.general.rename_choose == true && ca.channel_name != "" ? client.utils.ticketPlaceholders(ca.channel_name, member.user, ticketId) : null);

      let memberTicket = await db.get(`tickets_${member.id}`);
      memberTicket.find((x) => x.channel == c.id).ticketCategory = ca.id;
      await db.set(`tickets_${member.id}`, memberTicket);

      if(client.config.category.separateRoles.enabled == true && ca.roles.length > 0) {
        let editRole = ca.roles.map((x) => client.utils.findRole(message.guild, x));
        editRole = editRole.filter((r) => r != undefined);
        
        for(const r of editRole) {
          c.permissionOverwrites.edit(r, {
            SendMessages: true,
            ViewChannel: true
          }); 
        }
        if(config.roles.support.length > 0 && client.config.category.separateRoles.both == false) {
          let suppEdit = config.roles.support.map((x) => client.utils.findRole(message.guild, x));
          suppEdit = suppEdit.filter((r) => r != undefined); 
          
          for(const supp of suppEdit) {
            c.permissionOverwrites.edit(supp, {
              SendMessages: false,
              ViewChannel: false
            });
          }
        }
      }
      if(ca.type == "COMMISSION" && client.config.roles.commission_access.length > 0 && client.config.general.commission_perms == true) {
        client.utils.commissionAccess(client, c, message.guild);
      }
      if(ca.ask == false || config.category.lock_ticket == false) {
        c.permissionOverwrites.edit(member.user, {
          SendMessages: true,
          ViewChannel: true
        });
      }
      embed.setTitle(ca.title);
      embed.setColor(ca.embed.color);
      embed.setDescription(ca.embed.description.replace("<user>", member)
        .replace("<reason>", `${reason}`)
        .replace("<category>", ca.name));
      
      msg.edit({ embeds: [embed], components: componentList(buttonRow)});
      haveTicket = false;
      await db.delete(`choosingCategory_${member.id}`);
      let ticketData = await db.get(`ticketData_${c.id}`);
      ticketData.category = ca.id;
      await db.set(`ticketData_${c.id}`, ticketData);

      await mentionSupportRoles(client, message, ca, c);
      await checkIsAvailable(client, c, member);

      if(ca.ask == true && config.category.questions == false && config.category.questions_type == "MODAL") {
        buttonRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`ask_${ca.id}`)
            .setLabel(client.language.buttons.answer_questions.replace("<page>", "1"))
            .setEmoji(config.emojis.answer_questions || {})
            .setStyle(ButtonStyle.Success)
          );
          
        msg.edit({ embeds: [embed], components: componentList(buttonRow) });
        
        startCollector(client, `${ca.id}`, c, msg, member);
        // await categoryCollector(client, member, ca, c);
      } else if(ca.ask == true && config.category.questions == false && config.category.questions_type == "CHAT") {
        await chatAskQuestions(client, message.member, c, ca.questionsList, ca);
      }
    } else {
      msg.edit({ embeds: [embed], components: componentList(buttonRow, row)});
      haveTicket = true;
    }

    if(haveTicket == true) {
      if(interaction.type == InteractionType.ApplicationCommand) {
        interaction.reply({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.have_ticket_category, client.embeds.error_color)], ephemeral: true });
        return;
      } else if(interaction.type == InteractionType.MessageComponent) {
        interaction.followUp({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.have_ticket_category, client.embeds.error_color)], ephemeral: true });
        return;
      } else {
        c.send({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.have_ticket_category, client.embeds.error_color)] }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000)) 
        return;
      }
    } else {
      if(collector) collector.stop()
    }
  }
}

const ticketSubCategory = async(client, { message, msg, member, embed, interaction }, componentList, 
  reason, { buttonRow, subRow }, collector, parentCategory, ca, c) => {
  const config = client.config;
  const ticketId = await db.get(`ticketCount_${message.guild.id}`);
  if(ca.type == "COMMISSION") {
    await db.set(`commission_${c.id}`, {
      user: member.id,
      commMessageId: null,
      quoteMsgChannel: null,
      quoteList: [],
      status: "NO_STATUS",
      date: new Date()
    });
  }
  let moveCategory = client.utils.findChannel(message.guild, ca.category);
  if(config.category.separateCategories == true && ca.category != "" && moveCategory) {
    let childrenTickets = await db.get(`tickets_${member.id}`) || [];
    let childrenArray = childrenTickets.filter((x) => x.parent == moveCategory.id && x.ticketCategory == ca.id);

    if(childrenArray.length < ca.limit) {
      let memberTicket = await db.get(`tickets_${member.id}`);
      memberTicket.find((x) => x.channel == c.id).ticketCategory = ca.id;
      memberTicket.find((x) => x.channel == c.id).parent = moveCategory.id;
      await db.set(`tickets_${member.id}`, memberTicket);

      c.edit({ name: config.general.rename_choose == true && ca.channel_name != "" ? client.utils.ticketPlaceholders(ca.channel_name, member.user, ticketId) : null, 
      parent: moveCategory, lockPermissions: false }).then((ch) => {
        if(client.config.category.separateRoles.enabled == true && ca.roles.length > 0) {
          let editRole = ca.roles.map((x) => client.utils.findRole(message.guild, x));
          editRole = editRole.filter((r) => r != undefined);
      
          for(const r of editRole) {
            c.permissionOverwrites.edit(r, {
              SendMessages: true,
              ViewChannel: true
            });
          }
          if(config.roles.support.length > 0 && client.config.category.separateRoles.both == false) {
            let suppEdit = config.roles.support.map((x) => client.utils.findRole(message.guild, x));
            suppEdit = suppEdit.filter((r) => r != undefined); 
            
            for(const supp of suppEdit) {
              c.permissionOverwrites.edit(supp, {
                SendMessages: false,
                ViewChannel: false
              });
            }
          }
        }
        if(ca.type == "COMMISSION" && client.config.roles.commission_access.length > 0 && client.config.general.commission_perms == true) {
          client.utils.commissionAccess(client, ch, message.guild);
        }
        if(ca.ask == false || config.category.lock_ticket == false) {
          ch.permissionOverwrites.edit(member.user, {
            SendMessages: true,
            ViewChannel: true
          });
        }
      });
      embed.setTitle(ca.title);
      embed.setColor(ca.embed.color);
      embed.setDescription(ca.embed.description.replace("<user>", member)
        .replace("<reason>", `${reason}`)
        .replace("<category>", ca.name)
        .replace("<subcategory>", parentCategory.name));
      msg.edit({ embeds: [embed], components: componentList(buttonRow)});
      let ticketData = await db.get(`ticketData_${c.id}`);
      ticketData.category = ca.id;
      await db.set(`ticketData_${c.id}`, ticketData);
      haveTicket = false;


      await mentionSupportRoles(client, message, ca, c);
      await checkIsAvailable(client, c, member);

      if(ca.ask == true && config.category.questions == false && config.category.questions_type == "MODAL") {
        buttonRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`ask_${ca.id}`)
            .setLabel(client.language.buttons.answer_questions.replace("<page>", "1"))
            .setEmoji(config.emojis.answer_questions || {})
            .setStyle(ButtonStyle.Success)
          );
        
        msg.edit({ embeds: [embed], components: componentList(buttonRow) });
        
        startCollector(client, `${ca.id}`, c, msg, member);
        // await categoryCollector(client, member, ca, c);
      } else if(ca.ask == true && config.category.questions == false && config.category.questions_type == "CHAT") {
        await chatAskQuestions(client, message.member, c, ca.questionsList, ca);
      }
    } else {
      msg.edit({ embeds: [embed], components: componentList(buttonRow, subRow)});
      haveTicket = true;
    }

    if(haveTicket == true) {
      if(interaction.type == InteractionType.ApplicationCommand) {
        interaction.reply({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.have_ticket_category, client.embeds.error_color)], ephemeral: true });
        return;
      } else if(interaction.type == InteractionType.MessageComponent) {
        interaction.followUp({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.have_ticket_category, client.embeds.error_color)], ephemeral: true });
        return;
      } else {
        c.send({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.have_ticket_category, client.embeds.error_color)] }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000)) 
        return;
      }
    } else {
      if(collector) collector.stop()
    }
  } else {
    let memberTickets = await db.get(`tickets_${member.id}`);
    let listOfTickets = memberTickets.filter((x) => x.member == member.id && x.ticketCategory == ca.id);

    if(listOfTickets.length < ca.limit) {
      let memberTicket = await db.get(`tickets_${member.id}`);
      memberTicket.find((x) => x.channel == c.id).ticketCategory = ca.id;
      await db.set(`tickets_${member.id}`, memberTicket);

      c.edit({ name: config.general.rename_choose == true && ca.channel_name != "" ? client.utils.ticketPlaceholders(ca.channel_name, member.user, ticketId) : null, lockPermissions: false }).then((ch) => {
        if(client.config.category.separateRoles.enabled == true && ca.roles.length > 0) {
          let editRole = ca.roles.map((x) => client.utils.findRole(message.guild, x));
          editRole = editRole.filter((r) => r != undefined);
          
          for(const r of editRole) {
            ch.permissionOverwrites.edit(r, {
              SendMessages: true,
              ViewChannel: true
            }); 
          }
          if(config.roles.support.length > 0 && client.config.category.separateRoles.both == false) {
            let suppEdit = config.roles.support.map((x) => client.utils.findRole(message.guild, x));
            suppEdit = suppEdit.filter((r) => r != undefined); 
            
            for(const supp of suppEdit) {
              ch.permissionOverwrites.edit(supp, {
                SendMessages: false,
                ViewChannel: false
              });
            }
          }
        }
        if(ca.ask == false || config.category.lock_ticket == false) {
          ch.permissionOverwrites.edit(member.user, {
            SendMessages: true,
            ViewChannel: true
          });
        }
        if(ca.type == "COMMISSION" && client.config.roles.commission_access.length > 0 && client.config.general.commission_perms == true) {
          client.utils.commissionAccess(client, ch, message.guild);
        }
      });
      embed.setTitle(ca.title);
      embed.setColor(ca.embed.color);
      embed.setDescription(ca.embed.description.replace("<user>", member)
        .replace("<reason>", `${reason}`)
        .replace("<category>", ca.name)
        .replace("<subcategory>", parentCategory.name));
      
      msg.edit({ embeds: [embed], components: componentList(buttonRow)});
      haveTicket = false;
      await db.delete(`choosingCategory_${member.id}`);
      let ticketData = await db.get(`ticketData_${c.id}`);
      ticketData.category = ca.id;
      await db.set(`ticketData_${c.id}`, ticketData);

      await mentionSupportRoles(client, message, ca, c);
      /* if(config.general.mention_support == true && ca.roles.length > 0 && config.category.separateRoles.both == false && config.category.separateRoles.enabled == false) {
        let suppMention = ca.roles.map((r) => {
          let caSupport = client.utils.findRole(message.guild, r);
          
          if(caSupport) return caSupport;
        });

        if(suppMention.length > 0) c.send(suppMention.join(" ")).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000));
      } else if(config.general.mention_support == true && (ca.roles.length == 0 || config.category.separateRoles.both == true || config.category.separateRoles.enabled == false)) {
        let supp = config.roles.support.map((r) => {
          let findSupport = client.utils.findRole(message.guild, r);
          
          if(findSupport) return findSupport;
        });

        if(supp.length > 0) c.send({ content: `${supp.join(" ")}` }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000));
      } */

      await checkIsAvailable(client, c, member);

      if(ca.ask == true && config.category.questions == false && config.category.questions_type == "MODAL") {
        buttonRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`ask_${ca.id}`)
            .setLabel(client.language.buttons.answer_questions.replace("<page>", "1"))
            .setEmoji(config.emojis.answer_questions || {})
            .setStyle(ButtonStyle.Success)
          );
          
        msg.edit({ embeds: [embed], components: componentList(buttonRow) });
        
        startCollector(client, `${ca.id}`, c, msg, member);
        // await categoryCollector(client, member, ca, c);
      } else if(ca.ask == true && config.category.questions == false && config.category.questions_type == "CHAT") {
        await chatAskQuestions(client, message.member, c, ca.questionsList, ca);
      }
    } else {
      msg.edit({ embeds: [embed], components: componentList(buttonRow, subRow)});
      haveTicket = true;
    }

    if(haveTicket == true) {
      if(interaction.type == InteractionType.ApplicationCommand) {
        interaction.reply({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.have_ticket_category, client.embeds.error_color)], ephemeral: true });
        return;
      } else if(interaction.type == InteractionType.MessageComponent) {
        interaction.followUp({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.have_ticket_category, client.embeds.error_color)], ephemeral: true });
        return;
      } else {
        c.send({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.have_ticket_category, client.embeds.error_color)] }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000)) 
        return;
      }
    } else {
      if(collector) collector.stop();
    }

    // if(haveTicket == true) c.send.then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000))
  }
}

const startCollector = (client, category, channel, msg, member) => {
  if(client.config.category.lock_ticket == true) {
    channel.permissionOverwrites.edit(member.user, {
      SendMessages: false,
      ViewChannel: true
    });
  }

  const questFilter = (btn) => btn.customId == `ask_${category}` && btn.user.id == member.id;
  channel.awaitMessageComponent({ questFilter, componentType: ComponentType.Button, time: client.config.general.question_idle * 1000 })
    .then(interaction => {})
    .catch(() => {
      let editActionRow = ActionRowBuilder.from(msg.components[0]);
      editActionRow.components.forEach((c) => {
        if(c.data.custom_id != "closeTicket" && c.data.custom_id != "claimTicket") c.setDisabled(true);
      });

      msg.edit({ embeds: [msg.embeds[0]], components: [editActionRow] }).catch((err) => { });
  })
}

module.exports = {
  ticketCategory,
  ticketSubCategory
}
