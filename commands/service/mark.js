const Command = require("../../structures/Command");
const { ApplicationCommandOptionType } = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();

module.exports = class Mark extends Command {
  constructor(client) {
    super(client, {
      name: "mark",
      description: client.cmdConfig.mark.description,
      usage: client.cmdConfig.mark.usage,
      permissions: client.cmdConfig.mark.permissions,
      aliases: client.cmdConfig.mark.aliases,
      category: "service",
      listed: client.cmdConfig.mark.enabled,
      slash: true,
      options: [{
        name: "type",
        description: "Change commission status",
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: [
          {
            name: "Completed",
            value: "completed"
          }
        ]
      }]
    });
  }

  async run(message, args) {
    let type = args[0];
    let options = ["completed"];
    if(!type || !options.includes(type?.toLowerCase())) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.mark.usage)] });
    let commission = await db.get(`commission_${message.channel.id}`);
    if(!commission) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.commission.not_commission, this.client.embeds.error_color)] });

    if(type?.toLowerCase() == "completed") {
      if(commission.status != "QUOTE_ACCEPTED") return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.commission.no_quote, this.client.embeds.error_color)] });

      commission.status = "COMPLETED";
      await db.set(`commission_${message.channel.id}`, commission);

      let basePrice = Number(commission.quoteList[0].price);
      if(this.client.config.paypal.taxes.length > 0) {
        basePrice = this.client.utils.priceWithTax(this.client, basePrice);
      }

      let countTax = Number(((basePrice * Number(this.client.config.general.commission_tax)) / 100).toFixed(2));

      message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.commission.marked.replace("<user>", message.author).replace("<type>", "COMPLETED"), this.client.embeds.success_color)] });

      if(this.client.config.general.add_balance == true) {
        await db.add(`balance_${commission.quoteList[0].user}`, countTax);
        message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.commission.complete.replace("<freelancer>", `<@!${commission.quoteList[0].user}>`).replace("<percentage>", this.client.config.general.commission_tax).replaceAll("<currency>", this.client.config.general.currency_symbol).replace("<fullAmount>", basePrice).replace("<taxAmount>", countTax), this.client.embeds.success_color)] });
      }

      const ticketData = await this.client.db.get(`ticketData_${message.channel.id}`) || {};

      await this.client.utils.serverLogs({
        date: new Date().toLocaleString("en-GB"),
        author_id: message.author.id,
        author: message.author.tag,
        user_id: null,
        user: null,
        channel_id: `${message.channel.id}`,
        channel_name: `${message.channel.name}`,
        ticketId: ticketData.id || "N/A",
        message: `mark_complete`
      });

      await db.add(`totalIncome_${message.guild.id}`, countTax);
      if(this.client.config.general.client_info == true) {
        const clientProfile = await db.get(`clientProfile_${message.guild.id}_${commission.user}`) || await db.set(`clientProfile_${message.guild.id}_${commission.user}`, {
          orderCount: 0,
          amountSpent: 0,
        });

        clientProfile.orderCount++;
        clientProfile.amountSpent += Number(basePrice);
        await db.set(`clientProfile_${message.guild.id}_${commission.user}`, clientProfile);
      }
    }
  }
  async slashRun(interaction, args) {
    await interaction.deferReply({ ephemeral: this.client.cmdConfig.mark.ephemeral });
    let type = interaction.options.getString("type");

    let options = ["completed"];
    if(!options.includes(type?.toLowerCase())) return interaction.followUp({ embeds: [this.client.utils.usage(this.client, interaction, this.client.cmdConfig.mark.usage)] });
    let commission = await db.get(`commission_${interaction.channel.id}`);
    if(!commission) return interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.not_commission, this.client.embeds.error_color)], ephemeral: this.client.cmdConfig.mark.ephemeral });

    if(type == "completed") {
      if(commission.status != "QUOTE_ACCEPTED") return interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.no_quote, this.client.embeds.error_color)], ephemeral: this.client.cmdConfig.mark.ephemeral });

      commission.status = "COMPLETED";
      await db.set(`commission_${interaction.channel.id}`, commission);

      let basePrice = Number(commission.quoteList[0].price);
      if(this.client.config.paypal.taxes.length > 0) {
        basePrice = this.client.utils.priceWithTax(this.client, basePrice);
      }

      let countTax = Number(((basePrice * Number(this.client.config.general.commission_tax)) / 100).toFixed(2));
      
      interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.marked.replace("<user>", interaction.user).replace("<type>", "COMPLETED"), this.client.embeds.success_color)], ephemeral: this.client.cmdConfig.mark.ephemeral });

      if(this.client.config.general.add_balance == true) {
        await db.add(`balance_${commission.quoteList[0].user}`, countTax);
        interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.complete.replace("<freelancer>", `<@!${commission.quoteList[0].user}>`).replace("<percentage>", this.client.config.general.commission_tax).replaceAll("<currency>", this.client.config.general.currency_symbol).replace("<fullAmount>", commission.quoteList[0].price).replace("<taxAmount>", countTax), this.client.embeds.success_color)], ephemeral: this.client.cmdConfig.mark.ephemeral });
      }

      const ticketData = await this.client.db.get(`ticketData_${interaction.channel.id}`) || {};

      await this.client.utils.serverLogs({
        date: new Date().toLocaleString("en-GB"),
        author_id: interaction.user.id,
        author: interaction.user.tag,
        user_id: null,
        user: null,
        channel_id: `${interaction.channel.id}`,
        channel_name: `${interaction.channel.name}`,
        ticketId: ticketData.id || "N/A",
        message: `mark_complete`
      });

      await db.add(`totalIncome_${interaction.guild.id}`, countTax);
      if(this.client.config.general.client_info == true) {
        const clientProfile = await db.get(`clientProfile_${interaction.guild.id}_${commission.user}`) || await db.set(`clientProfile_${interaction.guild.id}_${commission.user}`, {
          orderCount: 0,
          amountSpent: 0,
        });

        clientProfile.orderCount++;
        clientProfile.amountSpent += Number(basePrice);
        await db.set(`clientProfile_${interaction.guild.id}_${commission.user}`, clientProfile);
      }
    }
  }
};