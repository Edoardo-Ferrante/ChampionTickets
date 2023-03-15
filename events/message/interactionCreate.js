const Discord = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();
const Event = require("../../structures/Events");
const claimCommand = require("../../commands/tickets/claim");
const closeCommand = require("../../commands/tickets/close");

module.exports = class InteractionCreate extends Event {
	constructor(...args) {
		super(...args);
	}

	async run(interaction) {
    const message = interaction.message;
    const user = interaction.user;
    const config = this.client.config;
    const language = this.client.language;

    let modalArr = [];
    let questModal;
    
    if(user.bot) return;
    if (interaction.type == Discord.InteractionType.ApplicationCommand) {
      const cmd = this.client.slashCommands.get(interaction.commandName);
      if (!cmd) return interaction.reply({ content: "> Error occured, please contact Bot Owner.", ephemeral: true });

      interaction.member = interaction.guild.members.cache.get(interaction.user.id);
      
      if(!this.client.utils.hasPermissions(interaction, interaction.member, cmd.permissions) && !this.client.utils.hasRole(this.client, interaction.guild, interaction.member, this.client.config.roles.bypass.permission)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.language.titles.error, this.client.language.general.no_perm, this.client.embeds.error_color)], ephemeral: true });

      const args = [];
      for (let option of interaction.options.data) {
        if (option.type === Discord.ApplicationCommandOptionType.Subcommand) {
          if (option.name) args.push(option.name);
          option.options?.forEach((x) => {
            if (x.value) args.push(x.value);
          });
        } else if (option.value) args.push(option.value);
      }

      if(this.client.cmdConfig[cmd.name]) {
        let cmdConfig = this.client.cmdConfig[cmd.name];
        if(cmdConfig.enabled == false) {
          if(this.client.language.general.cmd_disabled != "") interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.cmd_disabled, this.client.embeds.error_color)] });
          return;
        }
        if(cmdConfig && cmdConfig.roles.length > 0 && !this.client.utils.hasRole(this.client, interaction.guild, interaction.member, this.client.config.roles.bypass.permission)) {
          let cmdRoles = cmdConfig.roles.map((x) => this.client.utils.findRole(interaction.guild, x));
          if(!this.client.utils.hasRole(this.client, interaction.guild, interaction.member, cmdConfig.roles)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.no_role.replace("<role>", cmdRoles.join(", ")), this.client.embeds.error_color)], ephemeral: true });
        }
        let findCooldown = this.client.cmdCooldowns.find((c) => c.name == cmd.name && c.id == interaction.user.id);
        if(!this.client.utils.hasRole(this.client, interaction.guild, interaction.member, this.client.config.roles.bypass.cooldown, true)) {
          if(findCooldown) {
            let time = this.client.utils.formatTime(findCooldown.expiring - Date.now());
            return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.cooldown.replace("<cooldown>", time), this.client.embeds.error_color)], ephemeral: true });
          } else if(!findCooldown && this.client.cmdConfig[cmd.name].cooldown > 0) {
            let cooldown = {
              id: interaction.user.id,
              name: cmd.name,
              expiring: Date.now() + (this.client.cmdConfig[cmd.name].cooldown * 1000),
            };
    
            this.client.cmdCooldowns.push(cooldown);
    
            setTimeout(() => {
              this.client.cmdCooldowns.splice(this.client.cmdCooldowns.indexOf(cooldown), 1);
            }, this.client.cmdConfig[cmd.name].cooldown * 1000);
          }
        }
      }

      cmd.slashRun(interaction, args);
    }
    if (interaction.isButton()) {
      if(interaction.customId.startsWith("createTicket")) {
        await interaction.deferUpdate();
        let blackListed = false;
        let member = interaction.guild.members.cache.get(user.id);
        for(let i = 0; i < config.roles.blacklist.length; i++) {
          if(member.roles.cache.has(config.roles.blacklist[i])) blackListed = true;
        }
        if(blackListed == true) 
          return interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.bl_role, this.client.embeds.error_color)], ephemeral: true })
        if(config.users.blacklist.includes(user.id))
          return interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.bl_user, this.client.embeds.error_color)], ephemeral: true })
        const noCategory = new Discord.EmbedBuilder()
          .setTitle(this.client.embeds.title)
          .setDescription(this.client.language.ticket.no_category)
          .setFooter({ text: this.client.embeds.footer, iconURL: user.displayAvatarURL({ dynamic: true }) })
          .setTimestamp()
          .setColor(this.client.embeds.error_color);
  
        if(config.channels.category_id == "") 
          return interaction.followUp({ embeds: [noCategory], ephemeral: true });

        const catId = interaction.customId.replace("createTicket_", "");

        let isSubCat = false;
        let findCategory = this.client.categories.find((c) => c.id.toLowerCase() == catId.toLowerCase());

        if(!findCategory) {
          findCategory = this.client.categories.map((c) => {
            if(c.subcategories?.find((sc) => sc.id.toLowerCase() == catId.toLowerCase()))
              return c.subcategories?.[0];
          }).filter(Boolean)?.[0];
          if(findCategory) isSubCat = true;
        }

        if(findCategory?.type == "SUBCATEGORY_PARENT") {
          const options = [];
          findCategory.subcategories.forEach(c => {
            options.push({
              label: c.name,
              value: c.id, 
              emoji: c.emoji,
              description: c.placeholder != "" ? c.placeholder : ""
            });
          });
          
          let sMenu = new Discord.StringSelectMenuBuilder()
            .setCustomId("instant_subCategory")
            .setPlaceholder(config.category.placeholder)
            .addOptions(options);
    
          let row = new Discord.ActionRowBuilder()
            .addComponents(sMenu);

          const selSubcategory = new Discord.EmbedBuilder()
            .setTitle(this.client.embeds.title)
            .setColor(this.client.embeds.general_color)

          selSubcategory.setDescription(this.client.embeds.select_subcategory.description
            .replace("<subcategories>", options.map((x) => `${x.emoji} - ${x.label}`).join("\n")));
          let field = this.client.embeds.select_subcategory.fields;
          for(let i = 0; i < this.client.embeds.select_subcategory.fields.length; i++) {
            selSubcategory.addFields([{ name: field[i].title, value: field[i].description
              .replace("<subcategories>", options.map((x) => `${x.emoji} - ${x.label}`).join("\n")) }])
          }
          
          if(this.client.embeds.ticket.footer.enabled == true) selSubcategory.setFooter({ text: this.client.embeds.footer, iconURL: this.client.user.displayAvatarURL({ size: 1024, dynamic: true }) }).setTimestamp();
          if(this.client.embeds.ticket.image.enabled == true) selSubcategory.setImage(this.client.embeds.ticket.image.url);
          if(this.client.embeds.ticket.thumbnail.enabled == true) selSubcategory.setThumbnail(this.client.embeds.ticket.thumbnail.url);

          await interaction.followUp({ embeds: [selSubcategory], components: [row], ephemeral: true, fetchReply: true })
          const filter = (i) => i.customId == "instant_subCategory" && i.user.id == interaction.user.id;
          const collector = await interaction.channel.createMessageComponentCollector({ filter, time: config.general.no_select_delete * 1000, componentType: Discord.ComponentType.SelectMenu, max: 1, maxComponents: 1, maxUsers: 1 });

          collector.on("collect", async(i) => {
            collector.stop("collected");
            await i.deferUpdate();
            let selSub = i.values[0];
            this.client.emit("ticketCreate", interaction, member, "No Reason", {
              status: true,
              cat_id: catId,
              subcategory: selSub
            });
          });

          collector.on("end", async(collected, reason) => { });            
        } else {
          if(isSubCat == true) {
            const findParent = this.client.categories.find((c) => c.subcategories?.find((sc) => sc.id.toLowerCase() == catId.toLowerCase()));
            this.client.emit("ticketCreate", interaction, member, "No Reason", {
              status: interaction.customId.includes("_"),
              cat_id: findParent.id,
              subcategory: findCategory.id
            });
          } else {
            this.client.emit("ticketCreate", interaction, member, "No Reason", {
              status: interaction.customId.includes("_"),
              cat_id: interaction.customId.includes("_") ? catId : 'n/a'
            });
          }
        }
      }
  
      if(interaction.customId == "closeTicket" && interaction.user.bot == false) {
        const cmd = this.client.slashCommands.get("close");
        const cmdConfig = this.client.cmdConfig["close"];
        if(!this.client.utils.hasPermissions(interaction, interaction.member, cmdConfig.permissions) && !this.client.utils.hasRole(this.client, interaction.guild, interaction.member, this.client.config.roles.bypass.permission)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.language.titles.error, this.client.language.general.no_perm, this.client.embeds.error_color)], ephemeral: true });

        if(cmdConfig && cmdConfig.roles.length > 0 && !this.client.utils.hasRole(this.client, interaction.guild, interaction.member, this.client.config.roles.bypass.permission)) {
          let cmdRoles = cmdConfig.roles.map((x) => this.client.utils.findRole(interaction.guild, x));
          if(!this.client.utils.hasRole(this.client, interaction.guild, interaction.member, cmdConfig.roles)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.no_role.replace("<role>", cmdRoles.join(", ")), this.client.embeds.error_color)], ephemeral: true });
        }

        let close = new closeCommand(this.client);
        await close.slashRun(interaction);
      }

      if(interaction.customId == "claimTicket" && interaction.user.bot == false) {
        const cmdConfig = this.client.cmdConfig["claim"];
        if(!this.client.utils.hasPermissions(interaction, interaction.member, cmdConfig.permissions) && !this.client.utils.hasRole(this.client, interaction.guild, interaction.member, this.client.config.roles.bypass.permission)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.language.titles.error, this.client.language.general.no_perm, this.client.embeds.error_color)], ephemeral: true });

        if(cmdConfig && cmdConfig.roles.length > 0 && !this.client.utils.hasRole(this.client, interaction.guild, interaction.member, this.client.config.roles.bypass.permission)) {
          let cmdRoles = cmdConfig.roles.map((x) => this.client.utils.findRole(interaction.guild, x));
          if(!this.client.utils.hasRole(this.client, interaction.guild, interaction.member, cmdConfig.roles)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.no_role.replace("<role>", cmdRoles.join(", ")), this.client.embeds.error_color)], ephemeral: true });
        }

        let claim = new claimCommand(this.client);
        await claim.slashRun(interaction);
      }

      if(interaction.customId == "accept_quote") {
        let commission = await db.get(`commission_${interaction.channel.id}`);
        if(commission && commission?.status == "NO_STATUS") {
          if(commission.quoteList.find((x) => x.user == interaction.user.id) || commission.user != interaction.user.id) return interaction.deferUpdate();
          let commissionMessage = commission.quoteList.find((m) => m.messageId == interaction.message.id);
          if(!commissionMessage) return interaction.deferUpdate();

          interaction.channel.permissionOverwrites.create(commissionMessage.user, {
            SendMessages: true,
            ViewChannel: true
          });

          let bulkArr = commission.quoteList.map((x) => x.messageId);

          let quoteEmbed = new Discord.EmbedBuilder()
            .setColor(this.client.embeds.service.quoteAccepted.color);
        
          if(this.client.embeds.service.quoteAccepted.title) quoteEmbed.setTitle(this.client.embeds.service.quoteAccepted.title);
          
          if(this.client.embeds.service.quoteAccepted.description) quoteEmbed.setDescription(this.client.embeds.service.quoteAccepted.description.replace("<price>", commissionMessage.price)
            .replace("<priceWithTax>", this.client.utils.priceWithTax(this.client, commissionMessage.price))
            .replace("<user>", `<@!${commissionMessage.user}>`)
            .replace("<currency>", this.client.config.general.currency)
            .replace("<currencySymbol>", this.client.config.general.currency_symbol)
            .replace("<timeFrame>", commissionMessage.timeFrame || this.client.language.service.commission.no_time_frame)
            .replace("<notes>", commissionMessage.notes || this.client.language.service.commission.no_notes));
          
          let field = this.client.embeds.service.quoteAccepted.fields;
          for(let i = 0; i < this.client.embeds.service.quoteAccepted.fields.length; i++) {
            quoteEmbed.addFields([{ name: field[i].title.replace("<currency>", this.client.config.general.currency), value: field[i].description.replace("<price>", commissionMessage.price)
              .replace("<priceWithTax>", this.client.utils.priceWithTax(this.client, commissionMessage.price))
              .replace("<user>", `<@!${commissionMessage.user}>`)
              .replace("<currency>", this.client.config.general.currency)
              .replace("<currencySymbol>", this.client.config.general.currency_symbol)
              .replace("<timeFrame>", commissionMessage.timeFrame || this.client.language.service.commission.no_time_frame)
              .replace("<notes>", commissionMessage.notes || this.client.language.service.commission.no_notes), inline: true }])
          }
          
          if(this.client.embeds.service.quoteAccepted.footer == true ) quoteEmbed.setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL() }).setTimestamp();
          if(this.client.embeds.service.quoteAccepted.thumbnail == true) quoteEmbed.setThumbnail(user.displayAvatarURL());
          
          interaction.reply({ embeds: [quoteEmbed] });
          
          commission.status = "QUOTE_ACCEPTED"
          commission.quoteList = [commissionMessage];
          
          let commissionsChannel = this.client.utils.findChannel(interaction.guild, commission.quoteMsgChannel);
          if(commissionsChannel) {
            let commFetchedMsg = await commissionsChannel.messages.fetch({ message: commission.commMessageId });
            await commFetchedMsg.delete();
          }
          
          interaction.channel.bulkDelete(bulkArr).catch((err) => {});
          await db.set(`commission_${interaction.channel.id}`, commission);
        }
      }

      if(interaction.customId.startsWith("commission_") && interaction.guild) {
        const commChannel = this.client.channels.cache.get(interaction.customId.split("_")[1]);
        if(!commChannel) return this.client.utils.sendError("Commissions Channel isn't set in config.yml");

        let commPrice = new Discord.ActionRowBuilder()
          .addComponents(
            new Discord.TextInputBuilder()
            .setCustomId("commission_price")
            .setLabel(language.modals.labels.comm_price)
            .setPlaceholder(language.modals.placeholders.comm_price)
            .setMinLength(1)
            .setRequired(true)
            .setStyle(Discord.TextInputStyle.Short)
          );
        
        let commTime = new Discord.ActionRowBuilder()
          .addComponents(
            new Discord.TextInputBuilder()
            .setCustomId("commission_time")
            .setLabel(language.modals.labels.comm_time)
            .setPlaceholder(language.modals.placeholders.comm_time)
            .setMinLength(1)
            .setRequired(true)
            .setStyle(Discord.TextInputStyle.Short)
          );
        
        let commNote = new Discord.ActionRowBuilder()
          .addComponents(
            new Discord.TextInputBuilder()
            .setCustomId("commission_note")
            .setLabel(language.modals.labels.comm_note)
            .setPlaceholder(language.modals.placeholders.comm_note)
            .setStyle(Discord.TextInputStyle.Paragraph)
          );

        let commissionModal = new Discord.ModalBuilder()
          .setTitle(language.titles.quote)
          .setCustomId("commission_modal")
          .addComponents([commPrice, commTime, commNote]);

        interaction.showModal(commissionModal);

        const filter = (i) => i.customId == 'commission_modal' && i.user.id == interaction.user.id;
        interaction.awaitModalSubmit({ filter, time: 120_000 }).then(async(md) => {
          await md.deferUpdate();
          
          const price = md.fields.getTextInputValue("commission_price");
          const timeFrame = md.fields.getTextInputValue("commission_time");
          const notes = md.fields.getTextInputValue("commission_note");

          let commission = await db.get(`commission_${commChannel.id}`);
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
            .replace("<rating>", config.emojis.review.star.repeat(totalRating)));

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
              .replace("<rating>", config.emojis.review.star.repeat(totalRating)), inline: true }])
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

          await md.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.quote_sent, this.client.embeds.success_color)], ephemeral: true });

          await commChannel.send({ content: `<@!${commission.user}>`, embeds: [embed], components: [bttnRow] }).then(async(msg) => {
            commission.quoteList.push({
              user: interaction.user.id,
              messageId: msg.id,
              price,
              timeFrame,
              notes,
            });

            await db.set(`commission_${commChannel.id}`, commission);
          });

        }).catch((err) => { });
      }

      if(interaction.customId.startsWith("withdraw_") && interaction.guild) {
        let request = await db.get(`withdrawRequest_${interaction.message.id}`);
        if(request) {
          if(request.user == interaction.user.id) return interaction.deferUpdate();
          let wType = interaction.customId.split("_")[1];
          if(wType == "yes") {
            const balance = await db.get(`balance_${request.user}`) || 1;
            const reqUser = this.client.users.cache.get(request.user);
            let mail = await db.get(`paypal_${request.user}`) || "";
            if(request.amount > balance) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.invalid_withdraw, this.client.embeds.error_color)], ephemeral: true });
            if(!mail) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.no_mail, this.client.embeds.error_color)], ephemeral: this.client.cmdConfig.withdraw.ephemeral });

            await db.sub(`balance_${request.user}`, request.amount);

            interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.withdraw_accepted.replace("<user>", `<@!${request.user}>`).replace("<amount>", request.amount), this.client.embeds.success_color)], ephemeral: true });
            await reqUser.send({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.withdraw_accepted_dm.replace("<acceptedBy>", interaction.user).replace("<user>", `<@!${request.user}>`).replace("<amount>", request.amount), this.client.embeds.success_color)] }).catch((err) => {
              console.error("User's DM Closed");
            });

            interaction.message.delete();

            let withdrawAccepted = new Discord.EmbedBuilder()
              .setColor(this.client.embeds.service.withdrawAccepted.color);

            if(this.client.embeds.service.withdrawAccepted.title) withdrawAccepted.setTitle(this.client.embeds.service.withdrawAccepted.title);
            let field = this.client.embeds.service.withdrawAccepted.fields;
            for(let i = 0; i < this.client.embeds.service.withdrawAccepted.fields.length; i++) {
            withdrawAccepted.addFields([{ name: field[i].title.replace("<currency>", this.client.config.general.currency), value: field[i].description.replace("<user>", interaction.user)
              .replace("<freelancer>", `<@!${request.user}>`)
              .replace("<amount>", request.amount)
              .replace("<currency>", this.client.config.general.currency)
              .replace("<currencySymbol>", this.client.config.general.currency_symbol)
              .replace("<mail>", mail)
              .replace("<balance>", Number(balance).toFixed(2)) }])
            }

            if(this.client.embeds.service.withdrawAccepted.footer == true) withdrawAccepted.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) }).setTimestamp();
            if(this.client.embeds.service.withdrawAccepted.thumbnail == true) withdrawAccepted.setThumbnail(interaction.guild.iconURL());

            if(this.client.embeds.service.withdrawAccepted.description) withdrawAccepted.setDescription(this.client.embeds.service.withdrawAccepted.description.replace("<user>", interaction.user)
              .replace("<freelancer>", `<@!${request.user}>`)
              .replace("<amount>", request.amount)
              .replace("<currency>", this.client.config.general.currency)
              .replace("<currencySymbol>", this.client.config.general.currency_symbol)
              .replace("<mail>", mail)
              .replace("<balance>", Number(balance).toFixed(2)));

            let withdrawRow = new Discord.ActionRowBuilder()
              .addComponents(
                new Discord.ButtonBuilder()
                  .setURL(`https://www.paypal.com/cgi-bin/webscr?&cmd=_xclick&business=${mail}&currency_code=${this.client.config.general.currency}&amount=${request.amount}&item_name=${encodeURIComponent(this.client.language.service.withdraw_reason.replace("<user>", interaction.user.username).trim())}&no_shipping=1`)
                  .setLabel(this.client.language.buttons.send_withdraw)
                  .setStyle(Discord.ButtonStyle.Link)
              );

            interaction.channel.send({ embeds: [withdrawAccepted], components: [withdrawRow] });

            await db.delete(`withdrawRequest_${interaction.message.id}`);
          } else {
            const reqUser = this.client.users.cache.get(request.user);
            
            interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.withdraw_denied.replace("<user>", `<@!${request.user}>`).replace("<amount>", request.amount), this.client.embeds.success_color)], ephemeral: true });
            await reqUser.send({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.withdraw_denied_dm.replace("<acceptedBy>", interaction.user).replace("<user>", `<@!${request.user}>`).replace("<amount>", request.amount), this.client.embeds.success_color)] }).catch((err) => {
              console.error("User's DM Closed");
            });

            interaction.message.delete();

            let withdrawDenied = new Discord.EmbedBuilder()
              .setColor(this.client.embeds.service.withdrawDenied.color);

            if(this.client.embeds.service.withdrawDenied.title) withdrawDenied.setTitle(this.client.embeds.service.withdrawDenied.title);
            let field = this.client.embeds.service.withdrawDenied.fields;
            for(let i = 0; i < this.client.embeds.service.withdrawDenied.fields.length; i++) {
              withdrawDenied.addFields([{ name: field[i].title.replace("<currency>", this.client.config.general.currency), value: field[i].description.replace("<user>", interaction.user)
                .replace("<freelancer>", `<@!${request.user}>`)
                .replace("<amount>", request.amount)
                .replace("<currency>", this.client.config.general.currency)
                .replace("<currencySymbol>", this.client.config.general.currency_symbol)
                .replace("<mail>", mail)
                .replace("<balance>", Number(balance).toFixed(2)) }])
            }

            if(this.client.embeds.service.withdrawDenied.footer == true) withdrawDenied.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) }).setTimestamp();
            if(this.client.embeds.service.withdrawDenied.thumbnail == true) withdrawDenied.setThumbnail(interaction.guild.iconURL());

            if(this.client.embeds.service.withdrawDenied.description) withdrawDenied.setDescription(this.client.embeds.service.withdrawDenied.description.replace("<user>", interaction.user)
              .replace("<freelancer>", `<@!${request.user}>`)
              .replace("<amount>", request.amount)
              .replace("<currency>", this.client.config.general.currency)
              .replace("<currencySymbol>", this.client.config.general.currency_symbol)
              .replace("<mail>", mail)
              .replace("<balance>", Number(balance).toFixed(2)));

            interaction.channel.send({ embeds: [withdrawDenied] });

            await db.delete(`withdrawRequest_${interaction.message.id}`);
          }
        }
      }

      if(interaction.customId == "ask_noCategory") {
        let catSelected = this.client.categories.find((ct) => ct.id.toLowerCase() == interaction.customId.replace("ask_", "").toLowerCase());
        if(!catSelected) {
          catSelected = this.client.categories.filter((x) => x.type == "SUBCATEGORY_PARENT" && x.subcategories);
          catSelected = catSelected.map((x) => {
            return x.subcategories.find((a) => a.id.toLowerCase() == interaction.customId.replace("ask_", "").toLowerCase())
          })[0];
        }

        let questionsList = this.client.config.category.questionsList;

        if(questionsList.length == 0) return;
        const chunkSize = 5;
        const arrOfChunks = [];

        for (let i = 0; i < questionsList.length; i += chunkSize) {
          const chunk = questionsList.slice(i, i + chunkSize);
          arrOfChunks.push(chunk)
        }

        for (let i = 0; i < arrOfChunks.length; i++) {
          modalArr.push(arrOfChunks[i].map((x) => {
            let questionIndex = questionsList.indexOf(questionsList.find((q) => q.name == x.name));
            let modalData = new Discord.ActionRowBuilder().addComponents(
              new Discord.TextInputBuilder()
              .setLabel(x.name)
              .setStyle(Discord.TextInputStyle.Paragraph)
              .setMaxLength(350)
              .setCustomId(`modalQuestion_${questionIndex}`)
              .setPlaceholder(x.question)
            );

            return modalData;
          }))
        }

        await db.set(`listOfQuestions_${interaction.channel.id}`, {
          list: questionsList,
          ticketCategory: catSelected,
          modalArr
        });

        let startingPage = await db.get(`questionPage_${interaction.channel.id}`) || 1;
        
        questModal = new Discord.ModalBuilder()
          .setTitle(this.client.language.titles.questions.replace("<page>", startingPage).replace("<max>", modalArr.length))
          .setComponents(modalArr[startingPage - 1])
          .setCustomId("askQuestions_modal");

        let isAnswered = await db.get(`questionsAnswered_${interaction.channel.id}`);
        
        if (isAnswered == true) {
          let editActionRow = Discord.ActionRowBuilder.from(interaction.message.components[0]);
          editActionRow.components.forEach((c) => {
            if(c.data.custom_id != "closeTicket" && c.data.custom_id != "claimTicket") c.setStyle(Discord.ButtonStyle.Secondary)
              .setLabel(this.client.language.buttons.answered_all)
              .setDisabled(true);
          });
          interaction.message.edit({ embeds: [interaction.message.embeds[0]], components: [editActionRow] }).catch((err) => { });
          return;
        }

        interaction.showModal(questModal);
      } else if(interaction.customId.startsWith("ask_") && interaction.customId.split("_")[1] != "noCategory") {
        let catSelected = this.client.categories.find((ct) => ct.id.toLowerCase() == interaction.customId.replace("ask_", "").toLowerCase());
        if(!catSelected) {
          catSelected = this.client.categories.filter((x) => x.type == "SUBCATEGORY_PARENT" && x.subcategories);
          catSelected = catSelected.map((x) => {
            return x.subcategories.find((a) => a.id.toLowerCase() == interaction.customId.replace("ask_", "").toLowerCase())
          }).filter(Boolean)[0];
        }

        let questionsList = catSelected.questionsList;

        if(questionsList.length == 0) return;
        const chunkSize = 5;
        const arrOfChunks = [];

        for (let i = 0; i < questionsList.length; i += chunkSize) {
          const chunk = questionsList.slice(i, i + chunkSize);
          arrOfChunks.push(chunk)
        }

        for (let i = 0; i < arrOfChunks.length; i++) {
          modalArr.push(arrOfChunks[i].map((x) => {
            let questionIndex = questionsList.indexOf(questionsList.find((q) => q.name == x.name));
            let modalData = new Discord.ActionRowBuilder().addComponents(
              new Discord.TextInputBuilder()
              .setLabel(x.name)
              .setMaxLength(350)
              .setStyle(Discord.TextInputStyle.Paragraph)
              .setCustomId(`modalQuestion_${questionIndex}`)
              .setPlaceholder(x.question)
            );

            return modalData;
          }))
        }

        await db.set(`listOfQuestions_${interaction.channel.id}`, {
          list: questionsList,
          ticketCategory: catSelected,
          modalArr
        });

        let startingPage = await db.get(`questionPage_${interaction.channel.id}`) || 1;
        
        questModal = new Discord.ModalBuilder()
          .setTitle(this.client.language.titles.questions.replace("<page>", startingPage).replace("<max>", modalArr.length))
          .setComponents(modalArr[startingPage - 1])
          .setCustomId("askQuestions_modal");

        let isAnswered = await db.get(`questionsAnswered_${interaction.channel.id}`);
        
        if (isAnswered == true) {
          let editActionRow = Discord.ActionRowBuilder.from(interaction.message.components[0]);
          editActionRow.components.forEach((c) => {
            if(c.data.custom_id != "closeTicket" && c.data.custom_id != "claimTicket") c.setStyle(Discord.ButtonStyle.Secondary)
              .setLabel(this.client.language.buttons.answered_all)
              .setDisabled(true);
          });
          interaction.message.edit({ embeds: [interaction.message.embeds[0]], components: [editActionRow] }).catch((err) => { });
          return;
        }

        interaction.showModal(questModal);
      }
  
      // Suggestion Vote
      if(interaction.customId.startsWith("vote_") && interaction.guild) {
        let suggestionData = await db.get(`suggestion_${interaction.guild.id}_${interaction.message.id}`);
        if(suggestionData) {
          let voteType = interaction.customId.split("_")[1].toLowerCase();
  
          if (voteType == "yes") {
            if (suggestionData.voters.some((u) => u.user == interaction.user.id)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.already_voted, this.client.embeds.error_color)], ephemeral: true });
            let newData = {
              text: suggestionData.text,
              date: suggestionData.date,
              decision: suggestionData.decision,
              author: suggestionData.author,
              yes: parseInt(suggestionData.yes) + 1,
              no: parseInt(suggestionData.no),
              voters: suggestionData.voters.concat({ user: interaction.user.id, type: "yes" }),
              status: 'none',
            };
            await db.set(`suggestion_${interaction.guild.id}_${interaction.message.id}`, newData);
            interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.vote_yes, this.client.embeds.success_color)], ephemeral: true });
            await this.client.utils.updateSuggestionEmbed(this.client, interaction);
          } else if (voteType == "no") {
            if (suggestionData.voters.some((u) => u.user == interaction.user.id)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.already_voted, this.client.embeds.error_color)], ephemeral: true });
            let newData = {
              text: suggestionData.text,
              date: suggestionData.date,
              decision: suggestionData.decision,
              author: suggestionData.author,
              yes: parseInt(suggestionData.yes),
              no: parseInt(suggestionData.no) + 1,
              voters: suggestionData.voters.concat({ user: interaction.user.id, type: "no" }),
              status: 'none',
            };
            await db.set(`suggestion_${interaction.guild.id}_${interaction.message.id}`, newData);
            interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.vote_no, this.client.embeds.success_color)], ephemeral: true });
            await this.client.utils.updateSuggestionEmbed(this.client, interaction);
          } else if (voteType == "reset") {
            if (!suggestionData.voters.some((u) => u.user == interaction.user.id)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.not_voted, this.client.embeds.error_color)], ephemeral: true });
            let removeYes = suggestionData.voters.find((d) => d.type == "yes" && d.user == interaction.user.id);
            let removeNo = suggestionData.voters.find((d) => d.type == "no" && d.user == interaction.user.id);
  
            let newData = {
              text: suggestionData.text,
              date: suggestionData.date,
              decision: suggestionData.decision,
              author: suggestionData.author,
              yes: removeYes ? parseInt(suggestionData.yes) - 1 : parseInt(suggestionData.yes),
              no: removeNo ? parseInt(suggestionData.no) - 1 : parseInt(suggestionData.no),
              voters: suggestionData.voters.filter((v) => v.user != interaction.user.id),
              status: 'none',
            };
            await db.set(`suggestion_${interaction.guild.id}_${interaction.message.id}`, newData);
            interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.vote_reset, this.client.embeds.success_color)], ephemeral: true });
            await this.client.utils.updateSuggestionEmbed(this.client, interaction);
          }
        }
      }

      if(interaction.customId.startsWith("commissionMessage_")) {
        const commChannel = interaction.guild.channels.cache.get(interaction.customId.split("_")[1]);
        const commission = await db.get(`commission_${interaction.customId.split("_")[1]}`);

        if(commChannel) {
          const commClient = this.client.users.cache.get(commission.user);

          let msgClientInput = new Discord.ActionRowBuilder()
            .addComponents(
              new Discord.TextInputBuilder()
                .setCustomId("msgclient_input")
                .setLabel(this.client.language.modals.labels.message_client)
                .setPlaceholder(this.client.language.modals.placeholders.message_client)
                .setMinLength(6)
                .setRequired(true)
                .setStyle(Discord.TextInputStyle.Paragraph)
            );
          
          let msgClientModal = new Discord.ModalBuilder()
            .setTitle(this.client.language.titles.message_client)
            .setCustomId("msgclient_modal")
            .addComponents(msgClientInput);
            
          interaction.showModal(msgClientModal);
          
          const filter = (i) => i.customId == 'msgclient_modal' && i.user.id == interaction.user.id;
          interaction.awaitModalSubmit({ filter, time: 120_000 })
            .then(async(md) => {
            let modalValue = md.fields.getTextInputValue("msgclient_input");
            
            const commRow = new Discord.ActionRowBuilder()
              .addComponents(
                new Discord.ButtonBuilder()
                  .setStyle(Discord.ButtonStyle.Secondary)
                  .setCustomId(`replyComm_${interaction.customId.split("_")[1]}_${interaction.user.id}`)
                  .setLabel(this.client.language.buttons.reply_message)
                  .setEmoji(config.emojis.reply_commission || {})
              );

            let msgClientEmbed = new Discord.EmbedBuilder()
              .setColor(this.client.embeds.service.messageClient.color);
          
            if(this.client.embeds.service.messageClient.title) msgClientEmbed.setTitle(this.client.embeds.service.messageClient.title);
            
            if(this.client.embeds.service.messageClient.description) msgClientEmbed.setDescription(this.client.embeds.service.messageClient.description.replace("<message>", modalValue)
              .replace("<user>", interaction.user));
            
            let field = this.client.embeds.service.messageClient.fields;
            for(let i = 0; i < this.client.embeds.service.messageClient.fields.length; i++) {
              msgClientEmbed.addFields([{ name: field[i].title, value: field[i].description.replace("<message>", modalValue)
                .replace("<user>", interaction.user), inline: true }])
            }
            
            if(this.client.embeds.service.messageClient.footer == true ) msgClientEmbed.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() }).setTimestamp();
            if(this.client.embeds.service.messageClient.thumbnail == true) msgClientEmbed.setThumbnail(interaction.user.displayAvatarURL());

            md.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.message_sent.replace("<user>", `<@!${commission.user}>`).replace("<channel>", commChannel), this.client.embeds.success_color)], ephemeral: true });
            commClient.send({ embeds: [msgClientEmbed], components: [commRow] }).catch(() => {
              md.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.dm_closed, this.client.embeds.error_color)], ephemeral: true }).catch((err) => {});
            });
          }).catch((err) => { });
        }
      }

      if(interaction.customId.startsWith("replyComm_")) {
        const commChannel = this.client.channels.cache.get(interaction.customId.split("_")[1]);
        const commission = await db.get(`commission_${interaction.customId.split("_")[1]}`);
        const userReply = this.client.users.cache.get(interaction.customId.split("_")[2]);

        if(commChannel) {
          let replyInput = new Discord.ActionRowBuilder()
            .addComponents(
              new Discord.TextInputBuilder()
                .setCustomId("replymsg_input")
                .setLabel(this.client.language.modals.labels.reply_comm)
                .setPlaceholder(this.client.language.modals.placeholders.reply_comm)
                .setMinLength(6)
                .setRequired(true)
                .setStyle(Discord.TextInputStyle.Paragraph)
            );
          
          let replyModal = new Discord.ModalBuilder()
            .setTitle(this.client.language.titles.reply_comm)
            .setCustomId("replymsg_modal")
            .addComponents(replyInput);
            
          interaction.showModal(replyModal);
          
          const filter = (i) => i.customId == 'replymsg_modal' && i.user.id == interaction.user.id;
          interaction.awaitModalSubmit({ filter, time: 120_000 })
            .then(async(md) => {
            let modalValue = md.fields.getTextInputValue("replymsg_input");
            
            let commReplyEmbed = new Discord.EmbedBuilder()
              .setColor(this.client.embeds.service.commissionReply.color);
          
            if(this.client.embeds.service.commissionReply.title) commReplyEmbed.setTitle(this.client.embeds.service.commissionReply.title);
            
            if(this.client.embeds.service.commissionReply.description) commReplyEmbed.setDescription(this.client.embeds.service.commissionReply.description.replace("<message>", modalValue)
              .replace("<channel>", commChannel)
              .replace("<user>", interaction.user));
            
            let field = this.client.embeds.service.commissionReply.fields;
            for(let i = 0; i < this.client.embeds.service.commissionReply.fields.length; i++) {
              commReplyEmbed.addFields([{ name: field[i].title, value: field[i].description.replace("<message>", modalValue)
                .replace("<channel>", commChannel)
                .replace("<user>", interaction.user), inline: true }])
            }
            
            if(this.client.embeds.service.commissionReply.footer == true ) commReplyEmbed.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() }).setTimestamp();
            if(this.client.embeds.service.commissionReply.thumbnail == true) commReplyEmbed.setThumbnail(interaction.user.displayAvatarURL());

            const commRow = new Discord.ActionRowBuilder()
              .addComponents(
                new Discord.ButtonBuilder()
                  .setStyle(Discord.ButtonStyle.Secondary)
                  .setCustomId(`replyComm_${interaction.customId.split("_")[1]}_${interaction.user.id}`)
                  .setLabel(this.client.language.buttons.reply_message)
                  .setEmoji(config.emojis.reply_commission || {})
              );

            userReply.send({ embeds: [commReplyEmbed], components: [commRow] }).catch(() => {
              md.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.dm_closed, this.client.embeds.error_color)], ephemeral: true });
              return;
            });

            md.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.reply_sent.replace("<user>", `<@!${commission.user}>`).replace("<channel>", commChannel), this.client.embeds.success_color)], ephemeral: true });
          }).catch((err) => { 
            console.log(err)
          });
        } 
      }
    }

    // Suggestion Decision
    if(interaction.isStringSelectMenu()) {
      if(interaction.channel.type != Discord.ChannelType.DM) {
        if(interaction.customId == "noSelection_panel") {
          const categoryValue = interaction.values[0];

          await interaction.deferUpdate();
          let blackListed = false;
          let member = interaction.guild.members.cache.get(user.id);
          if(config.roles.blacklist.some((bl) => member.roles.cache.has(bl))) blackListed = true;

          if(blackListed == true) 
            return interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.bl_role, this.client.embeds.error_color)], ephemeral: true })
          if(config.users.blacklist.includes(user.id))
            return interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.bl_user, this.client.embeds.error_color)], ephemeral: true })
          const noCategory = new Discord.EmbedBuilder()
            .setTitle(this.client.embeds.title)
            .setDescription(this.client.language.ticket.no_category)
            .setFooter({ text: this.client.embeds.footer, iconURL: user.displayAvatarURL({ dynamic: true }) })
            .setTimestamp()
            .setColor(this.client.embeds.error_color);
    
          if(config.channels.category_id == "") 
            return interaction.followUp({ embeds: [noCategory], ephemeral: true });

          await interaction.message.edit({ embeds: [interaction.message.embeds[0]], components: [interaction.message.components[0]] })
          const findCategory = this.client.categories.find((c) => c.id.toLowerCase() == categoryValue.toLowerCase());
          if(findCategory.type == "SUBCATEGORY_PARENT") {
            const options = [];
            findCategory.subcategories.forEach(c => {
              options.push({
                label: c.name,
                value: c.id, 
                emoji: c.emoji,
                description: c.placeholder != "" ? c.placeholder : ""
              });
            });
            
            let sMenu = new Discord.StringSelectMenuBuilder()
              .setCustomId("instant_subCategory")
              .setPlaceholder(config.category.placeholder)
              .addOptions(options);
      
            let row = new Discord.ActionRowBuilder()
              .addComponents(sMenu);

            const selSubcategory = new Discord.EmbedBuilder()
              .setTitle(this.client.embeds.title)
              .setColor(this.client.embeds.general_color)

            selSubcategory.setDescription(this.client.embeds.select_subcategory.description
              .replace("<subcategories>", options.map((x) => `${x.emoji} - ${x.label}`).join("\n")));
            let field = this.client.embeds.select_subcategory.fields;
            for(let i = 0; i < this.client.embeds.select_subcategory.fields.length; i++) {
              selSubcategory.addFields([{ name: field[i].title, value: field[i].description
                .replace("<subcategories>", options.map((x) => `${x.emoji} - ${x.label}`).join("\n")) }])
            }
            
            if(this.client.embeds.ticket.footer.enabled == true) selSubcategory.setFooter({ text: this.client.embeds.footer, iconURL: this.client.user.displayAvatarURL({ size: 1024, dynamic: true }) }).setTimestamp();
            if(this.client.embeds.ticket.image.enabled == true) selSubcategory.setImage(this.client.embeds.ticket.image.url);
            if(this.client.embeds.ticket.thumbnail.enabled == true) selSubcategory.setThumbnail(this.client.embeds.ticket.thumbnail.url);

            await interaction.followUp({ embeds: [selSubcategory], components: [row], ephemeral: true, fetchReply: true })
            const filter = (i) => i.customId == "instant_subCategory" && i.user.id == interaction.user.id;
            const collector = await interaction.channel.createMessageComponentCollector({ filter, time: config.general.no_select_delete * 1000, componentType: Discord.ComponentType.SelectMenu, max: 1, maxComponents: 1, maxUsers: 1 });

            collector.on("collect", async(i) => {
              collector.stop("collected");
              await i.deferUpdate();
              let selSub = i.values[0];
              this.client.emit("ticketCreate", interaction, member, "No Reason", {
                status: true,
                cat_id: categoryValue,
                subcategory: selSub
              });
            });

            collector.on("end", async(collected, reason) => { });            
          } else {
            this.client.emit("ticketCreate", interaction, member, "No Reason", {
              status: true,
              cat_id: categoryValue
            });
          }
        }
        let decisionData = await db.get(`suggestionDecision_${interaction.guild.id}_${interaction.message.id}`);
        if(interaction.customId == "decision_menu" && decisionData && this.client.config.general.sugg_decision == true) {
          let suggChannel = this.client.utils.findChannel(interaction.guild, this.client.config.channels.suggestions);
          let fetchSuggestion = await suggChannel.messages.fetch({ message: decisionData });
          if(!fetchSuggestion) return;
          let decidedChannel = this.client.utils.findChannel(interaction.guild, this.client.config.channels.sugg_logs);
          let value = interaction.values[0];
  
          if(value == "decision_accept") {
            let acceptEmbed = new Discord.EmbedBuilder()
              .setTitle(this.client.language.titles.sugg_accepted)
              .setColor(this.client.embeds.success_color);
            
            if(fetchSuggestion.embeds[0].data.description) acceptEmbed.setDescription(fetchSuggestion.embeds[0].data.description);
            if(fetchSuggestion.embeds[0].data.footer) acceptEmbed.setFooter(fetchSuggestion.embeds[0].data.footer).setTimestamp();
            if(fetchSuggestion.embeds[0].data.thumbnail) acceptEmbed.setThumbnail(fetchSuggestion.embeds[0].data.thumbnail.url);
            if(fetchSuggestion.embeds[0].data.fields) acceptEmbed.addFields(fetchSuggestion.embeds[0].data.fields);
  
            let reasonInput = new Discord.ActionRowBuilder()
              .addComponents(
                new Discord.TextInputBuilder()
                  .setCustomId("decision_reason")
                  .setLabel(this.client.language.modals.labels.decision)
                  .setPlaceholder(this.client.language.modals.placeholders.decision)
                  .setRequired(false)
                  .setStyle(Discord.TextInputStyle.Paragraph)
              );
            
            let reasonModal = new Discord.ModalBuilder()
              .setTitle(this.client.language.titles.sugg_accepted)
              .setCustomId("decision_modal")
              .addComponents(reasonInput);
            
            interaction.showModal(reasonModal);

            await interaction.message.delete();
            await fetchSuggestion.delete();
            let deicdedMsg = await decidedChannel.send({ embeds: [acceptEmbed] });
            interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.accepted, this.client.embeds.success_color)], ephemeral: true });

            const filter = (i) => i.customId == 'decision_modal' && i.user.id == interaction.user.id;
            interaction.awaitModalSubmit({ filter, time: 60_000 })
              .then(async(md) => {
              await md.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.decision_reason, this.client.embeds.success_color)], ephemeral: true });
              let reasonValue = md.fields.getTextInputValue("decision_reason");
              if(reasonValue.length > 1) {
                acceptEmbed.addFields([{ name: this.client.language.titles.accept_reason, value: reasonValue }]);
                await deicdedMsg.edit({ embeds: [acceptEmbed] });
              }
            }).catch((err) => { console.log(err) });
          } else if(value == "decision_deny") {
            let denyEmbed = new Discord.EmbedBuilder()
              .setTitle(this.client.language.titles.sugg_denied)
              .setColor(this.client.embeds.error_color);
  
            if(fetchSuggestion.embeds[0].data.description) denyEmbed.setDescription(fetchSuggestion.embeds[0].data.description);
            if(fetchSuggestion.embeds[0].data.footer) denyEmbed.setFooter(fetchSuggestion.embeds[0].data.footer).setTimestamp();
            if(fetchSuggestion.embeds[0].data.thumbnail) denyEmbed.setThumbnail(fetchSuggestion.embeds[0].data.thumbnail.url);
            if(fetchSuggestion.embeds[0].data.fields) denyEmbed.addFields(fetchSuggestion.embeds[0].data.fields);
  
            let reasonInput = new Discord.ActionRowBuilder()
              .addComponents(
                new Discord.TextInputBuilder()
                  .setCustomId("decision_reason")
                  .setLabel(this.client.language.modals.labels.decision)
                  .setPlaceholder(this.client.language.modals.placeholders.decision)
                  .setRequired(false)
                  .setStyle(Discord.TextInputStyle.Paragraph)
              );
            
            let reasonModal = new Discord.ModalBuilder()
              .setTitle(this.client.language.titles.sugg_denied)
              .setCustomId("decision_modal")
              .addComponents(reasonInput);
              
            interaction.showModal(reasonModal);

            await interaction.message.delete();
            await fetchSuggestion.delete();
            let deicdedMsg = await decidedChannel.send({ embeds: [denyEmbed] });
            interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.denied, this.client.embeds.success_color)], ephemeral: true });

            const filter = (i) => i.customId == 'decision_modal' && i.user.id == interaction.user.id;
            interaction.awaitModalSubmit({ filter, time: 60_000 })
              .then(async(md) => {
              await md.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.decision_reason, this.client.embeds.success_color)], ephemeral: true });
              let reasonValue = md.fields.getTextInputValue("decision_reason");
              if(reasonValue.length > 1) {
                denyEmbed.addFields([{ name: this.client.language.titles.deny_reason, value: reasonValue }]);
                await deicdedMsg.edit({ embeds: [denyEmbed] });
              }
            }).catch((err) => { console.log(err) });
          } else if(value == "decision_delete") {
            await interaction.message.delete();
            await fetchSuggestion.delete();
            interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.deleted, this.client.embeds.success_color)], ephemeral: true });
            await db.delete(`suggestion_${interaction.guild.id}_${decisionData}`);
          }
        }
      }
    } 

    if(interaction.type == Discord.InteractionType.ModalSubmit) {
      if(interaction.customId == "askQuestions_modal") {
        let currPage = await db.get(`questionPage_${interaction.channel.id}`);
        const listOfQuestions = await db.get(`listOfQuestions_${interaction.channel.id}`);
        if (parseInt(currPage + 1) > listOfQuestions.modalArr.length || listOfQuestions.modalArr.length == 1) {
          await interaction.deferUpdate().catch((err) => {});
          
          if(listOfQuestions.modalArr.length <= 5) {
            for(let i = 0; i < interaction.components.length; i++) {
              let questionIndex = interaction.components[i].components[0].customId.split("_")[1];
              await db.push(`channelQuestions_${interaction.channel.id}`, {
                question: listOfQuestions.list[questionIndex].name,
                answer: interaction.components[i].components[0].value || "N/A"
              });
            }
          }
          
          await db.set(`questionsAnswered_${interaction.channel.id}`, true);
    
          let editActionRow = Discord.ActionRowBuilder.from(interaction.message.components[0]);
          editActionRow.components.forEach((c) => {
            if(c.data.custom_id != "closeTicket" && c.data.custom_id != "claimTicket") c.setStyle(Discord.ButtonStyle.Secondary)
              .setLabel(this.client.language.buttons.answered_all)
              .setDisabled(true);
          });
    
          interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.answered_all, this.client.embeds.success_color)], ephemeral: true });
          interaction.message.edit({ embeds: [interaction.message.embeds[0]], components: [editActionRow] });
          let answerData = await db.get(`channelQuestions_${interaction.channel.id}`) || [];
          
          let submitEmbed = new Discord.EmbedBuilder()
            .setTitle(listOfQuestions.ticketCategory?.type == "COMMISSION" ? this.client.language.titles.commission : this.client.language.titles.answers)
            .setColor(this.client.embeds.general_color)
            .setFooter({ text: interaction.member.user.username, iconURL: interaction.member.user.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();
    
          for (let i = 0; i < answerData.length; i++) {
            submitEmbed.addFields([{ name: answerData[i].question, value: answerData[i].answer == "" 
              || !answerData[i].answer || !answerData[i].answer.trim() ? "N/A" : answerData[i].answer }]);
          }
    
          interaction.channel.permissionOverwrites.edit(interaction.user, {
            SendMessages: true,
            ViewChannel: true
          });
    
          interaction.followUp({ embeds: [submitEmbed] });
          
          if(config.general.send_commissions == true && config.channels.commissions != "" && listOfQuestions.ticketCategory?.type == "COMMISSION") {
            submitEmbed.setTitle(this.client.embeds.service.newCommission.title)
              .setColor(this.client.embeds.service.newCommission.color);
    
            if(this.client.embeds.service.newCommission.description) submitEmbed.setDescription(this.client.embeds.service.newCommission.description.replace("<user>", interaction.user));
            if(this.client.embeds.service.newCommission.thumbnail == true) submitEmbed.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));
            if(this.client.embeds.service.newCommission.footer == true) submitEmbed.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });
    
            let commChannel = this.client.utils.findChannel(interaction.guild, config.channels.commissions);
    
            const commRow = new Discord.ActionRowBuilder()
              .addComponents(
                new Discord.ButtonBuilder()
                  .setStyle(Discord.ButtonStyle.Success)
                  .setCustomId(`commission_${interaction.channel.id}`)
                  .setLabel(this.client.language.buttons.send_quote)
                  .setEmoji(config.emojis.send_quote || {})
              )
    
            if(config.general.msg_button == true) commRow.addComponents(
              new Discord.ButtonBuilder()
                .setStyle(Discord.ButtonStyle.Secondary)
                .setCustomId(`commissionMessage_${interaction.channel.id}`)
                .setLabel(this.client.language.buttons.message_client)
                .setEmoji(config.emojis.msg_commission || {})
            )
    
            if(listOfQuestions.ticketCategory && listOfQuestions.ticketCategory?.commission) {
              let categoryCommCh = this.client.utils.findChannel(interaction.guild, listOfQuestions.ticketCategory.commission.channel);
              let categoryCommRoles = listOfQuestions.ticketCategory.commission.roles.map((x) => {
                let findRole = this.client.utils.findRole(interaction.channel.guild, x);
                if(findRole) return findRole;
              });
    
              if(categoryCommCh) {
                await categoryCommCh.send({ content: categoryCommRoles.length > 0 ? `${categoryCommRoles.join(" ")}` : '', embeds: [submitEmbed], components: [commRow] }).then(async(m) => {
                  const commission = await db.get(`commission_${interaction.channel.id}`);
                  commission.commMessageId = m.id;
                  commission.quoteMsgChannel = m.channel.id;
                  await db.set(`commission_${interaction.channel.id}`, commission);
                });
              } else {
                await commChannel.send({ content: categoryCommRoles.length > 0 ? `${categoryCommRoles.join(" ")}` : '', embeds: [submitEmbed], components: [commRow] }).then(async(m) => {
                  const commission = await db.get(`commission_${interaction.channel.id}`);
                  commission.commMessageId = m.id;
                  commission.quoteMsgChannel = m.channel.id;
                  await db.set(`commission_${interaction.channel.id}`, commission);
                });
              }
            } else {
              await commChannel.send({ embeds: [submitEmbed], components: [commRow] }).then(async(m) => {
                const commission = await db.get(`commission_${interaction.channel.id}`);
                commission.commMessageId = m.id;
                commission.quoteMsgChannel = m.channel.id;
                await db.set(`commission_${interaction.channel.id}`, commission);
              });
            }
          }
        } else {
          let questionPage = await db.get(`questionPage_${interaction.channel.id}`);
          await db.add(`questionPage_${interaction.channel.id}`, questionPage ? 1 : 2);
          questionPage = await db.get(`questionPage_${interaction.channel.id}`);
    
          for(let i = 0; i < interaction.components.length; i++) {
            let questionIndex = interaction.components[i].components[0].customId.split("_")[1];
            await db.push(`channelQuestions_${interaction.channel.id}`, {
              question: listOfQuestions.list[questionIndex].name,
              answer: interaction.components[i].components[0].value || "N/A"
            });
          }
    
          questModal = new Discord.ModalBuilder()
            .setTitle(this.client.language.titles.questions.replace("<page>", parseInt(questionPage)).replace("<max>", listOfQuestions.modalArr.length))
            .setComponents(listOfQuestions.modalArr[parseInt(questionPage - 1)])
            .setCustomId("askQuestions_modal");
    
          let editActionRow = Discord.ActionRowBuilder.from(interaction.message.components[0]);
          editActionRow.components.forEach((c) => {
            if(c.data.custom_id != "closeTicket" && c.data.custom_id != "claimTicket") c.setLabel(this.client.language.buttons.answer_questions.replace("<page>", questionPage));
          });
          
          interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.answered_set, this.client.embeds.general_color)], ephemeral: true });
          interaction.message.edit({ embeds: [interaction.message.embeds[0]], components: [editActionRow] })
        }
      }
    }
	}
};
