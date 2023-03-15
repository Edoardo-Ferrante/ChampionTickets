const Command = require("../../structures/Command");
const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();

module.exports = class GetInvoice extends Command {
  constructor(client) {
    super(client, {
      name: "getinvoice",
      description: client.cmdConfig.getinvoice.description,
      usage: client.cmdConfig.getinvoice.usage,
      permissions: client.cmdConfig.getinvoice.permissions,
      aliases: client.cmdConfig.getinvoice.aliases,
      category: "service",
      listed: client.cmdConfig.getinvoice.enabled,
      slash: true,
      options: [{
        name: 'invoice',
        type: ApplicationCommandOptionType.String,
        description: "ID of Invoice to check",
        required: true,
      }]
    });
  }

  async run(message, args) {
    const config = this.client.config;
    const language = this.client.language;
    const embeds = this.client.embeds;

    let invoiceId = args[0];
    
    if(!config.paypal.secret || !config.paypal.client_id) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, embeds.title, language.general.paypal_cred, embeds.error_color)] });
    
    if(!invoiceId) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.invoice.usage)] }); 
    const savedInvoice = await db.get(`invoice_${invoiceId.toUpperCase()}`);

    if(!savedInvoice) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, embeds.title, language.service.invalid_invoice, embeds.error_color)] });
    
    this.client.paypal.invoice.get(invoiceId.toUpperCase(), async(err, invoice) => {
      if (err) {
        this.client.utils.sendError("Invalid PayPal API Secret or Client ID have been provided.");
      } else {
        let invoiceData = await db.get(`invoice_${invoice.id}`) || {};
        let embed = new EmbedBuilder()
          .setColor(embeds.service.invoiceGet.color);
        if (embeds.service.invoiceGet.title) embed.setTitle(embeds.service.invoiceGet.title);
        
        if (embeds.service.invoiceGet.description) embed.setDescription(embeds.service.invoiceGet.description.replace("<amount>", invoice.total_amount.value)
          .replace("<seller>", invoiceData.author ? `<@!${invoiceData.author}>` : 'N/A')
          .replace("<invoiceId>", invoice.id)
          .replace("<user>", invoiceData.user ? `<@!${invoiceData.user}>` : 'N/A')
          .replace("<tos>", invoice.terms || 'N/A')
          .replace("<notes>", invoice.note || 'N/A')
          .replace("<status>", invoice.status)
          .replace("<sellerMail>", invoice.merchant_info.email)
          .replace("<currency>", config.general.currency)
          .replace("<currencySymbol>", config.general.currency_symbol)
          .replace("<service>", invoice.items[0].name));
        
        let field = embeds.service.invoiceGet.fields;
        for (let i = 0; i < embeds.service.invoiceGet.fields.length; i++) {
          embed.addFields([{ name: field[i].title.replace("<currency>", config.general.currency), value: field[i].description.replace("<amount>", invoice.total_amount.value)
            .replace("<seller>", invoiceData.author ? `<@!${invoiceData.author}>` : 'N/A')
            .replace("<invoiceId>", invoice.id)
            .replace("<user>", invoiceData.user ? `<@!${invoiceData.user}>` : 'N/A')
            .replace("<tos>", invoice.terms || 'N/A')
            .replace("<notes>", invoice.note || 'N/A')
            .replace("<status>", invoice.status)
            .replace("<sellerMail>", invoice.merchant_info.email)
            .replace("<currency>", config.general.currency)
            .replace("<currencySymbol>", config.general.currency_symbol)
            .replace("<service>", invoice.items[0].name), inline: true }])
        }
        
        if (embeds.service.invoiceGet.footer == true) embed.setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL() }).setTimestamp();
        if (embeds.service.invoiceGet.thumbnail == true) embed.setThumbnail(message.author.displayAvatarURL());
        
        message.channel.send({ embeds: [embed] });
      }
    });
  }
  async slashRun(interaction, args) {
    const config = this.client.config;
    const language = this.client.language;
    const embeds = this.client.embeds;

    let invoiceId = interaction.options.getString("invoice");
    const savedInvoice = await db.get(`invoice_${invoiceId.toUpperCase()}`);

    if(!config.paypal.secret || !config.paypal.client_id) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, embeds.title, language.general.paypal_cred, embeds.error_color)] });
    if(!savedInvoice) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, embeds.title, language.service.invalid_invoice, embeds.error_color)] });

    this.client.paypal.invoice.get(invoiceId.toUpperCase(), async (err, invoice) => {
      if (err) {
        this.client.utils.sendError("Invalid PayPal API Secret or Client ID have been provided.");
      } else {
        let invoiceData = await db.get(`invoice_${invoice.id}`) || {};
        let embed = new EmbedBuilder()
          .setColor(embeds.service.invoiceGet.color);
        if (embeds.service.invoiceGet.title) embed.setTitle(embeds.service.invoiceGet.title);
        
        if (embeds.service.invoiceGet.description) embed.setDescription(embeds.service.invoiceGet.description.replace("<amount>", invoice.total_amount.value)
          .replace("<seller>", invoiceData.author ? `<@!${invoiceData.author}>` : 'N/A')
          .replace("<invoiceId>", invoice.id)
          .replace("<user>", invoiceData.user ? `<@!${invoiceData.user}>` : 'N/A')
          .replace("<tos>", invoice.terms || 'N/A')
          .replace("<notes>", invoice.note || 'N/A')
          .replace("<status>", invoice.status)
          .replace("<sellerMail>", invoice.merchant_info.email)
          .replace("<currency>", config.general.currency)
          .replace("<currencySymbol>", config.general.currency_symbol)
          .replace("<service>", invoice.items[0].name));
        
        let field = embeds.service.invoiceGet.fields;
        for (let i = 0; i < embeds.service.invoiceGet.fields.length; i++) {
          embed.addFields([{ name: field[i].title.replace("<currency>", config.general.currency), value: field[i].description.replace("<amount>", invoice.total_amount.value)
            .replace("<seller>", invoiceData.author ? `<@!${invoiceData.author}>` : 'N/A')
            .replace("<invoiceId>", invoice.id)
            .replace("<user>", invoiceData.user ? `<@!${invoiceData.user}>` : 'N/A')
            .replace("<tos>", invoice.terms || 'N/A')
            .replace("<notes>", invoice.note || 'N/A')
            .replace("<status>", invoice.status)
            .replace("<sellerMail>", invoice.merchant_info.email)
            .replace("<currency>", config.general.currency)
            .replace("<currencySymbol>", config.general.currency_symbol)
            .replace("<service>", invoice.items[0].name), inline: true }])
        }
        
        if (embeds.service.invoiceGet.footer == true) embed.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() }).setTimestamp();
        if (embeds.service.invoiceGet.thumbnail == true) embed.setThumbnail(interaction.user.displayAvatarURL());
        
        interaction.reply({ embeds: [embed] });
      }
    });
  }
};
