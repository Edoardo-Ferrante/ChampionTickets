const Command = require("../../structures/Command");
const { QuickDB } = require("quick.db");
const db = new QuickDB();
const Discord = require("discord.js");

module.exports = class Withdraw extends Command {
  constructor(client) {
    super(client, {
      name: "withdraw",
      description: client.cmdConfig.withdraw.description,
      usage: client.cmdConfig.withdraw.usage,
      permissions: client.cmdConfig.withdraw.permissions,
      aliases: client.cmdConfig.withdraw.aliases,
      category: "service",
      listed: client.cmdConfig.withdraw.enabled,
      slash: true,
      options: [{
        name: "amount",
        description: "Amount to request to withdraw",
        type: Discord.ApplicationCommandOptionType.Number,
        required: true
      }]
    });
  }

  async run(message, args) {
    let amount = args[0];
    if(!amount || isNaN(amount)) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.withdraw.usage)] }); 
    const balance = await db.get(`balance_${message.author.id}`) || 0;
    const mail = await db.get(`paypal_${message.author.id}`);

    if(amount > balance || balance < 1 || amount < 1) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.invalid_amount, this.client.embeds.error_color)] });
    if(!mail) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.no_mail, this.client.embeds.error_color)] });

    let channel = this.client.utils.findChannel(message.guild, this.client.config.channels.withdraw);

    let withdrawMenu = new Discord.EmbedBuilder()
      .setColor(this.client.embeds.service.withdraw.color);
    
    if(this.client.embeds.service.withdraw.title) withdrawMenu.setTitle(this.client.embeds.service.withdraw.title);
    let field = this.client.embeds.service.withdraw.fields;
    for(let i = 0; i < this.client.embeds.service.withdraw.fields.length; i++) {
      withdrawMenu.addFields([{ name: field[i].title.replace("<currency>", this.client.config.general.currency), value: field[i].description.replace("<user>", message.author)
      .replace("<amount>", amount)
      .replace("<currency>", this.client.config.general.currency)
      .replace("<currencySymbol>", this.client.config.general.currency_symbol)
      .replace("<mail>", mail)
      .replace("<balance>", Number(balance).toFixed(2)) }])
    }
    
    if(this.client.embeds.service.withdraw.footer == true) withdrawMenu.setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL({ dynamic: true }) }).setTimestamp();
    if(this.client.embeds.service.withdraw.thumbnail == true) withdrawMenu.setThumbnail(message.author.displayAvatarURL());
    
    if(this.client.embeds.service.withdraw.description) withdrawMenu.setDescription(this.client.embeds.service.withdraw.description.replace("<user>", message.author)
      .replace("<amount>", amount)
      .replace("<currency>", this.client.config.general.currency)
      .replace("<currencySymbol>", this.client.config.general.currency_symbol)
      .replace("<mail>", mail)
      .replace("<balance>", Number(balance).toFixed(2)));

    let withdrawRow = new Discord.ActionRowBuilder().addComponents(
      new Discord.ButtonBuilder()
        .setLabel(this.client.language.buttons.withdraw_yes)
        .setEmoji(this.client.config.emojis.yes_emoji || {})
        .setCustomId("withdraw_yes")
        .setStyle(Discord.ButtonStyle.Primary),
      new Discord.ButtonBuilder()
        .setLabel(this.client.language.buttons.withdraw_no)
        .setEmoji(this.client.config.emojis.no_emoji || {})
        .setCustomId("withdraw_no")
        .setStyle(Discord.ButtonStyle.Danger)
    );

    if(channel) {
      let msg = await channel.send({ embeds: [withdrawMenu], components: [withdrawRow] });
      await db.set(`withdrawRequest_${msg.id}`, {
        user: message.author.id,
        amount,
        mail,
      });

      message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.withdraw_request.replace("<user>", message.author).replace("<amount>", amount).replace("<balance>", Number(balance).toFixed(2)), this.client.embeds.success_color)] });
    } else {
      message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.no_withdraw_channel, this.client.embeds.error_color)] });
    }
  }
  async slashRun(interaction, args) {
    let amount = interaction.options.getNumber("amount");
    const balance = await db.get(`balance_${interaction.user.id}`) || 0;
    const mail = await db.get(`paypal_${interaction.user.id}`);
    
    if(amount > balance || balance < 1 || amount < 1) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.invalid_amount, this.client.embeds.error_color)], ephemeral: this.client.cmdConfig.withdraw.ephemeral });
    if(!mail) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.no_mail, this.client.embeds.error_color)], ephemeral: this.client.cmdConfig.withdraw.ephemeral });
    
    let channel = this.client.utils.findChannel(interaction.guild, this.client.config.channels.withdraw);
    
    let withdrawMenu = new Discord.EmbedBuilder()
      .setColor(this.client.embeds.service.withdraw.color);
    
    if(this.client.embeds.service.withdraw.title) withdrawMenu.setTitle(this.client.embeds.service.withdraw.title);
    let field = this.client.embeds.service.withdraw.fields;
    for(let i = 0; i < this.client.embeds.service.withdraw.fields.length; i++) {
      withdrawMenu.addFields([{ name: field[i].title.replace("<currency>", this.client.config.general.currency), value: field[i].description.replace("<user>", interaction.user)
      .replace("<amount>", amount)
      .replace("<currency>", this.client.config.general.currency)
      .replace("<currencySymbol>", this.client.config.general.currency_symbol)
      .replace("<mail>", mail)
      .replace("<balance>", Number(balance).toFixed(2)) }])
    }
    
    if(this.client.embeds.service.withdraw.footer == true) withdrawMenu.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) }).setTimestamp();
    if(this.client.embeds.service.withdraw.thumbnail == true) withdrawMenu.setThumbnail(interaction.user.displayAvatarURL());
    
    if(this.client.embeds.service.withdraw.description) withdrawMenu.setDescription(this.client.embeds.service.withdraw.description.replace("<user>", interaction.user)
      .replace("<amount>", amount)
      .replace("<currency>", this.client.config.general.currency)
      .replace("<currencySymbol>", this.client.config.general.currency_symbol)
      .replace("<mail>", mail)
      .replace("<balance>", Number(balance).toFixed(2)));
    
    let withdrawRow = new Discord.ActionRowBuilder().addComponents(
      new Discord.ButtonBuilder()
        .setLabel(this.client.language.buttons.withdraw_yes)
        .setEmoji(this.client.config.emojis.yes_emoji || {})
        .setCustomId("withdraw_yes")
        .setStyle(Discord.ButtonStyle.Primary),
      new Discord.ButtonBuilder()
        .setLabel(this.client.language.buttons.withdraw_no)
        .setEmoji(this.client.config.emojis.no_emoji || {})
        .setCustomId("withdraw_no")
        .setStyle(Discord.ButtonStyle.Danger)
    );
    
    if(channel) {
      let msg = await channel.send({ embeds: [withdrawMenu], components: [withdrawRow] });
      await db.set(`withdrawRequest_${msg.id}`, {
        user: interaction.user.id,
        amount,
        mail,
      });
    
      interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.withdraw_request.replace("<user>", interaction.user).replace("<amount>", amount).replace("<balance>", Number(balance).toFixed(2)), this.client.embeds.success_color)], ephemeral: this.client.cmdConfig.withdraw.ephemeral });
    } else {
      interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.no_withdraw_channel, this.client.embeds.error_color)], ephemeral: this.client.cmdConfig.withdraw.ephemeral });
    }
  }
};