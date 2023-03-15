const { QuickDB } = require("quick.db");
const db = new QuickDB();
const Event = require("../../structures/Events");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder,
  PermissionFlagsBits, ComponentType, ChannelType, ButtonStyle, InteractionType } = require("discord.js");
const { chatAskQuestions } = require("../../utils/askQuestions");
const { ticketCategory, ticketSubCategory } = require("../../utils/ticketCategory");

module.exports = class TicketCreate extends Event {
  constructor(...args) {
    super(...args);
  }

  async run(message, member, reason = "No Reason Provided", separatedPanel = {
    status: false,
    cat_id: "n/a",
    subcategory: null
  }) {
    let config = this.client.config;
    let language = this.client.language;
    let mainCategory = this.client.utils.findChannel(message.guild, config.channels.category_id);
    if(!mainCategory) this.client.utils.sendError("Provided Channel Category ID (category_id) is invalid or belongs to other Server.");
    let everyone = message.guild.roles.cache.find(r => r.name === "@everyone");

    const componentList = (row, select = null) => {
      if(config.general.close_button == false) row.components = row.components.filter((x) => x.data.custom_id != "closeTicket");
      if(config.general.claim_button == false) row.components = row.components.filter((x) => x.data.custom_id != "claimTicket");

      if(select) return row.components.length == 0 ? [select] : [select, row];

      return row.components.length == 0 ? [] : [row];
    }
    
    if(config.category.status == false) {
      let memberTicket = await db.get(`tickets_${member.id}`) || [];
      
      if(memberTicket.length >= config.general.ticket_limit) {
        if(message.type == InteractionType.ApplicationCommand) {
          message.reply({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.already_open, this.client.embeds.error_color)], ephemeral: true }); 
          return;
        } else if(message.type == InteractionType.MessageComponent) {
          message.followUp({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.already_open, this.client.embeds.error_color)], ephemeral: true }); 
          return;
        } else {
          message.channel.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.already_open, this.client.embeds.error_color)] }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000)) 
          return;
        }
      }
    } else if(config.category.status == true && config.category.separateCategories == true) {
      let memberTicket = await db.get(`tickets_${member.id}`) || [];
      let userTickets = memberTicket.filter((x) => x.member == member.id && x.parent == mainCategory.id)

      if(userTickets.length >= 1) {
        if(message.type == InteractionType.ApplicationCommand) {
          message.reply({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.have_in_sel, this.client.embeds.error_color)], ephemeral: true }); 
          return;
        } else if(message.type == InteractionType.MessageComponent) {
          message.followUp({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.have_in_sel, this.client.embeds.error_color)], ephemeral: true }); 
          return;
        } else {
          message.channel.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.have_in_sel, this.client.embeds.error_color)] }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000)) 
          return;
        }
      }
    } else if(config.category.status == true && config.category.separateCategories == false) {
      let isChoosing = await db.get(`choosingCategory_${member.id}`);
      if(isChoosing != null) {
        if(message.type == InteractionType.ApplicationCommand) {
          message.reply({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.have_in_sel, this.client.embeds.error_color)], ephemeral: true }); 
          return;
        } else if(message.type == InteractionType.MessageComponent) {
          message.followUp({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.have_in_sel, this.client.embeds.error_color)], ephemeral: true }); 
          return;
        } else {
          message.channel.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.have_in_sel, this.client.embeds.error_color)] }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000)) 
          return;
        }
      }
    }
    if(separatedPanel.status == true) {
      let ca = this.client.categories.find((cat) => cat.id.toLowerCase() == separatedPanel.cat_id.toLowerCase());
      if(!ca) {
        message.followUp({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.invalid_panel, this.client.embeds.error_color)], ephemeral: true });
        return;
      }

      if(separatedPanel.subcategory)
        ca = ca.subcategories.find((sub) => sub.id.toLowerCase() == separatedPanel.subcategory.toLowerCase());

      let memberTickets = await db.get(`tickets_${member.id}`) || [];
      let listOfTickets = memberTickets.filter((x) => x.member == member.id && x.ticketCategory == ca.id);

      if(config.category.separateCategories == false) {
        if(listOfTickets.length >= ca.limit) {
          message.followUp({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.have_ticket_category, this.client.embeds.error_color)], ephemeral: true });
          return;
        }
      } else if(config.category.separateCategories == true) {
        let childrenTickets = await db.get(`tickets_${member.id}`) || [];
        let separatePanelCategory = childrenTickets.filter((x) => x.parent == ca.category && x.ticketCategory == ca.id);
        
        if(separatePanelCategory.length >= ca.limit) {
          message.followUp({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.have_ticket_category, this.client.embeds.error_color)], ephemeral: true });
          return;
        }
      }
    }
    const blacklistedNumbers = [1352, 1390, 1423, 1488];    
    let ticketId = parseInt(await db.get(`ticketCount_${message.guild.id}`) + 1);
    if(blacklistedNumbers.includes(parseInt(ticketId))) ticketId++;
    message.guild.channels.create({
        name: this.client.utils.ticketPlaceholders(config.channels.channel_name, member.user, ticketId),
        type: ChannelType.GuildText,
        parent: mainCategory,
        permissionOverwrites: [
          {
            id: this.client.user,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
          },
          {
            id: member.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
          },
          {
            id: everyone,
            deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
          }
        ],
      }).then(async (c) => {
        await db.push(`tickets_${member.id}`, {
          member: member.id,
          channel: c.id,
          reason: reason || "N/A",
          parent: c.parentId
        });

        await db.set(`ticketData_${c.id}`, {
          owner: member.user.id,
          openedAt: new Date(),
          openedTimestamp: message.createdTimestamp,
          id: ticketId
        });

        await this.client.utils.serverLogs({
          date: new Date().toLocaleString("en-GB"),
          author_id: member.user.id,
          author: member.user.tag,
          user_id: null,
          user: null,
          channel_id: `${c.id}`,
          channel_name: `${c.name}`,
          ticketId: ticketId,
          message: `ticket_create`
        });
        
        await db.add(`ticketCount_${message.guild.id}`, 1);

        if(this.client.config.category.status == false) {
          c.permissionOverwrites.edit(member.user, {
            SendMessages: true,
            ViewChannel: true
          });
        } else {
          c.permissionOverwrites.edit(member.user, {
            SendMessages: false,
            ViewChannel: true
          });
        }

        c.setTopic(language.ticket.channel_topic.replace("<author>", member.user.username));
        if(config.roles.support.length > 0) {
          for(let i = 0; i < config.roles.support.length; i++) {
            let findRole = this.client.utils.findRole(message.guild, config.roles.support[i]);
            c.permissionOverwrites.create(findRole, {
                SendMessages: true,
                ViewChannel: true
            });
          }
        }
  
        const buttonRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('closeTicket')
              .setLabel(this.client.language.buttons.close)
              .setEmoji(config.emojis.close || {})
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('claimTicket')
              .setLabel(this.client.language.buttons.claim)
              .setEmoji(this.client.config.emojis.claim || {})
              .setStyle(ButtonStyle.Success)
          );

        if(config.category.questions == true && config.category.questions_type == "MODAL" && this.client.config.category.status == false && separatedPanel.status == false) {
          buttonRow.addComponents(
            new ButtonBuilder()
              .setCustomId('ask_noCategory')
              .setLabel(this.client.language.buttons.answer_questions.replace("<page>", "1"))
              .setEmoji(config.emojis.answer_questions || {})
              .setStyle(ButtonStyle.Success),
          )
        }
        
        const jumpRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setURL(`https://discord.com/channels/${message.guild.id}/${c.id}`)
              .setLabel(this.client.language.buttons.go_ticket)
              .setStyle(ButtonStyle.Link)
          );
  
        if(message.type == InteractionType.ApplicationCommand) {
          message.reply({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.ticket_created
            .replace("<channel>", `<#${c.id}>`)
            .replace("<reason>", `${reason}`)
            .replace("<user>", member), this.client.embeds.success_color)], components: [jumpRow], ephemeral: this.client.cmdConfig.new.ephemeral });
        } else if(message.type == InteractionType.MessageComponent) {
          message.followUp({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.ticket_created
            .replace("<channel>", `<#${c.id}>`)
            .replace("<reason>", `${reason}`)
            .replace("<user>", member), this.client.embeds.success_color)], components: [jumpRow], ephemeral: true });
        } else {
          message.channel.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.ticket_created
            .replace("<channel>", `<#${c.id}>`)
            .replace("<reason>", `${reason}`)
            .replace("<user>", member), this.client.embeds.success_color)], components: [jumpRow] }).then(m => setTimeout(() => m.delete(), 5000)); 
        }
        
        if(config.general.mention_author == true) c.send(`<@${member.id}>`).then(async(msg) => {
          setTimeout(async() => {
            if(msg) await msg.delete().catch((err) => { });
          }, 5000)
        });
        
        const embed = new EmbedBuilder()
          .setColor(this.client.embeds.general_color)
          .setTitle(this.client.embeds.title)
          .setDescription(this.client.embeds.ticket_message.replace("<user>", member)
            .replace("<reason>", `${reason}`));
            
        if(config.category.status == true) {
          embed.setDescription(this.client.embeds.select_category.description);
          let field = this.client.embeds.select_category.fields;
          for(let i = 0; i < this.client.embeds.select_category.fields.length; i++) {
            embed.addFields([{ name: field[i].title, value: field[i].description }])
          }
        }
        if(this.client.embeds.ticket.footer.enabled == true) embed.setFooter({ text: this.client.embeds.footer, iconURL: this.client.user.displayAvatarURL({ size: 1024, dynamic: true }) }).setTimestamp();
        if(this.client.embeds.ticket.image.enabled == true) embed.setImage(this.client.embeds.ticket.image.url);
        if(this.client.embeds.ticket.thumbnail.enabled == true) embed.setThumbnail(this.client.embeds.ticket.thumbnail.url);
        let msg = await c.send({ embeds: [embed], components: componentList(buttonRow) });

        if(config.category.questions == true && this.client.config.category.status == false && separatedPanel.status == false && config.category.questions_type == "MODAL") {
          startCollector(this.client, "noCategory", c, msg, member);
        } else if(config.category.questions == true && this.client.config.category.status == false && config.category.questions_type == "CHAT") {
          await chatAskQuestions(this.client, message.member, c, this.client.config.category.questionsList);
        }

        if(separatedPanel.status == true) {
          let ca = this.client.categories.find((cat) => cat.id.toLowerCase() == separatedPanel.cat_id.toLowerCase());
          if(!ca) {
            message.followUp({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.invalid_panel, this.client.embeds.error_color)], ephemeral: true });
            this.client.utils.sendError("Ticket Category with such ID " + ca.id + " couldn't be found (Separated Panels).");
            return;
          }

          if(separatedPanel.subcategory) {
            let subCategory = ca.subcategories.find((sub) => sub.id == separatedPanel.subcategory);

            embed.setDescription(this.client.embeds.select_subcategory.description
              .replace("<subcategories>", ca.subcategories.map((x) => `${x.emoji} - ${x.label}`).join("\n")));
            let field = this.client.embeds.select_subcategory.fields;
            for(let i = 0; i < this.client.embeds.select_subcategory.fields.length; i++) {
              embed.addFields([{ name: field[i].title, value: field[i].description
                .replace("<subcategories>", ca.subcategories.map((x) => `${x.emoji} - ${x.label}`).join("\n")) }])
            }
  
            msg.edit({ embeds: [embed], components: componentList(buttonRow) });

            await ticketSubCategory(this.client, { message, msg, member, embed, interaction: message }, componentList, reason,
              { buttonRow, subRow: null }, null, ca, subCategory, c);
          } else {
            await ticketCategory(this.client, { message, msg, member, embed, interaction: message }, componentList, reason, { buttonRow }, null, ca, c, true);
          }
        }

        if(this.client.config.category.status == false || separatedPanel.status == true) return;
        await db.set(`choosingCategory_${member.id}`, true);

        setTimeout(async() => {
          await db.delete(`choosingCategory_${member.id}`);
        }, 5 * 60000);

        const options = [];
        this.client.categories.forEach(c => {
          options.push({
            label: c.name,
            value: c.id, 
            emoji: c.emoji,
            description: c.placeholder != "" ? c.placeholder : ""
          });
        });
        
        let sMenu = new StringSelectMenuBuilder()
          .setCustomId("categorySelect")
          .setPlaceholder(config.category.placeholder)
          .addOptions(options);
  
        let row = new ActionRowBuilder()
          .addComponents(sMenu);

        msg.edit({ embeds: [embed], components: componentList(buttonRow, row) });
        
        const filter = (interaction) => interaction.customId == "categorySelect" && interaction.user.id === member.id;
        const rCollector = msg.createMessageComponentCollector({ filter, componentType: ComponentType.SelectMenu, time: this.client.config.general.no_select_delete * 1000 });
        
        let claimed = false;
              
        rCollector.on("collect", async (i) => {
          await i.deferUpdate();
          let value = i.values[0];
          claimed = true;

          const ca = this.client.categories.find((x) => x.id == value);

          if(ca) {
            if(ca.type == "SUBCATEGORY_PARENT") {
              rCollector.stop();
              const subCategories = [];
              ca.subcategories.forEach((x) => {
                subCategories.push({
                  label: x.name,
                  value: x.id, 
                  emoji: x.emoji,
                  description: x.placeholder != "" ? x.placeholder : ""
                });
              });

              const subFilter = (interaction) => interaction.customId == "subCategorySelect" && interaction.user.id === member.id;
              const subCollector = msg.createMessageComponentCollector({ filter: subFilter, componentType: ComponentType.SelectMenu, time: this.client.config.general.no_select_delete * 1000 });

              sMenu.setCustomId("subCategorySelect")
                .setOptions(subCategories)
        
              let subRow = new ActionRowBuilder()
                .setComponents(sMenu);

              embed.setDescription(this.client.embeds.select_subcategory.description
                .replace("<subcategories>", subCategories.map((x) => `${x.emoji} - ${x.label}`).join("\n")));
              let field = this.client.embeds.select_subcategory.fields;
              for(let i = 0; i < this.client.embeds.select_subcategory.fields.length; i++) {
                embed.addFields([{ name: field[i].title, value: field[i].description
                  .replace("<subcategories>", subCategories.map((x) => `${x.emoji} - ${x.label}`).join("\n")) }])
              }
    
              msg.edit({ embeds: [embed], components: componentList(buttonRow, subRow) });

              subCollector.on("collect", async(sel) => {
                await sel.deferUpdate();

                let subValue = sel.values[0];
                const subCategory = ca.subcategories.find((sub) => sub.id == subValue);
                await ticketSubCategory(this.client, { message, msg, member, embed, interaction: sel }, componentList, reason,
                  { buttonRow, subRow }, subCollector, ca, subCategory, c);
              });

              subCollector.on("end", async(collected, reason) => {
                if(claimed == true) return;
                if(reason != "time") return;
                await db.delete(`choosingCategory_${member.id}`);
      
                let ticketList = await db.get(`tickets_${member.id}`) || [];
                ticketList = ticketList.filter((x) => x.channel != c.id);
                await db.set(`tickets_${member.id}`, ticketList);
      
                setTimeout(async() => {
                  c.delete();
                }, 500);
              });
            } else {
              await ticketCategory(this.client, { message, msg, member, embed, interaction: i }, componentList, reason, { buttonRow, row }, rCollector, ca, c);
            }
          }
        });
        
        rCollector.on("end", async(collected, reason) => {
          if(claimed == true) return;
          if(reason != "time") return;
          await db.delete(`choosingCategory_${member.id}`);

          let ticketList = await db.get(`tickets_${member.id}`) || [];
          ticketList = ticketList.filter((x) => x.channel != c.id);
          await db.set(`tickets_${member.id}`, ticketList);

          setTimeout(async() => {
            c.delete();
          }, 500);
        });
      }).catch((err) => console.log(err));
  }
};

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
      let editActionRow = Discord.ActionRowBuilder.from(msg.components[0]);
      editActionRow.components.forEach((c) => {
        if(c.data.custom_id != "closeTicket" && c.data.custom_id != "claimTicket") c.setDisabled(true);
      });

      msg.edit({ embeds: [msg.embeds[0]], components: [editActionRow] }).catch((err) => { });
  })
}
