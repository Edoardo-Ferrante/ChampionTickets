const Command = require("../../structures/Command");
const Discord = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();

module.exports = class Suggest extends Command {
  constructor(client) {
    super(client, {
      name: "suggest",
      description: client.cmdConfig.suggest.description,
      usage: client.cmdConfig.suggest.usage,
      permissions: client.cmdConfig.suggest.permissions,
      aliases: client.cmdConfig.suggest.aliases,
      category: "member",
      listed: client.cmdConfig.suggest.enabled,
      slash: true,
    });
  }

  async run(message, args) {
    const config = this.client.config;

    if(config.channels.suggestions == "") 
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.suggestion_title, this.client.language.general.no_suggest, this.client.embeds.error_color)] });
    if(!args[0]) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.suggest.usage)] });
    let suggestion = args.join(" ");

    let suggChannel = this.client.utils.findChannel(message.guild, config.channels.suggestions);
    let decisionChannel = this.client.utils.findChannel(message.guild, config.channels.sugg_decision);

    let suggMenu = new Discord.EmbedBuilder()
      .setColor(this.client.embeds.suggestion.color);
    
    if(this.client.embeds.suggestion.title) suggMenu.setTitle(this.client.embeds.suggestion.title);
    let field = this.client.embeds.suggestion.fields;
    for(let i = 0; i < this.client.embeds.suggestion.fields.length; i++) {
      suggMenu.addFields([{ name: field[i].title, value: field[i].description.replace("<author>", message.author)
      .replace("<suggestion>", `${suggestion}`)
      .replace("<yes_vote>", 0)
      .replace("<no_vote>", 0)
      .replace("<date>", `${new Date().toLocaleString("en-GB")}`) }])
    }
    
    if(this.client.embeds.suggestion.footer == true) suggMenu.setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL({ dynamic: true }) }).setTimestamp();
    if(this.client.embeds.suggestion.thumbnail == true) suggMenu.setThumbnail(message.guild.iconURL());
    
    if(this.client.embeds.suggestion.description) suggMenu.setDescription(this.client.embeds.suggestion.description.replace("<author>", message.author)
      .replace("<suggestion>", `${suggestion}`)
      .replace("<yes_vote>", 0)
      .replace("<no_vote>", 0)
      .replace("<date>", `${new Date().toLocaleString("en-GB")}`));

    let suggRow = new Discord.ActionRowBuilder().addComponents(
      new Discord.ButtonBuilder()
        .setLabel(this.client.language.buttons.yes_vote.replace("<count>", 0))
        .setEmoji(this.client.config.emojis.yes_emoji || {})
        .setCustomId("vote_yes")
        .setStyle(Discord.ButtonStyle.Primary),
      new Discord.ButtonBuilder()
        .setLabel(this.client.language.buttons.no_vote.replace("<count>", 0))
        .setEmoji(this.client.config.emojis.no_emoji || {})
        .setCustomId("vote_no")
        .setStyle(Discord.ButtonStyle.Danger),
      new Discord.ButtonBuilder()
        .setLabel(this.client.language.buttons.remove_vote)
        .setEmoji(this.client.config.emojis.remove_vote || {})
        .setCustomId("vote_reset")
        .setStyle(Discord.ButtonStyle.Secondary)
    );

    let decisionRow = new Discord.ActionRowBuilder().addComponents(
      new Discord.StringSelectMenuBuilder()
        .setCustomId("decision_menu")
        .setPlaceholder(this.client.language.general.suggestions.placeholder)
        .addOptions([{
          label: this.client.language.general.suggestions.decision.accept,
          value: "decision_accept",
          emoji: this.client.config.emojis.yes_emoji
        }, {
          label: this.client.language.general.suggestions.decision.deny,
          value: "decision_deny",
          emoji: this.client.config.emojis.no_emoji
        }, {
          label: this.client.language.general.suggestions.decision.delete,
          value: "decision_delete",
          emoji: this.client.config.emojis.remove_vote
        }])
    );

    message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.general.suggestions.sent, this.client.embeds.success_color)] }).then((m) => setTimeout(() => m.delete().catch((err) => {}), 5000));
    let m = await suggChannel.send({ embeds: [suggMenu], components: [suggRow] });
    if(this.client.config.general.sugg_decision == true && decisionChannel) {
      let decisionMsg = await decisionChannel.send({ embeds: [suggMenu], components: [decisionRow] });
  
      await db.set(`suggestion_${message.guild.id}_${m.id}`, {
        text: `${suggestion}`,
        date: `${new Date().toLocaleString("en-GB")}`,
        decision: `${decisionMsg.id}`,
        author: message.author,
        yes: 0,
        no: 0,
        voters: []
      });
  
      await db.set(`suggestionDecision_${message.guild.id}_${decisionMsg.id}`, `${m.id}`);
    } else {
      await db.set(`suggestion_${message.guild.id}_${m.id}`, {
        text: `${suggestion}`,
        date: `${new Date().toLocaleString("en-GB")}`,
        decision: null,
        author: message.author,
        yes: 0,
        no: 0,
        voters: []
      });
    }
    if(this.client.config.general.remove_command == false) await message.delete();
  }
  async slashRun(interaction, args) {
    const config = this.client.config;
    if(config.channels.suggestions == "") 
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.suggestion_title, this.client.language.general.no_suggest, this.client.embeds.error_color)] });

    let suggChannel = this.client.utils.findChannel(interaction.guild, config.channels.suggestions);
    let decisionChannel = this.client.utils.findChannel(interaction.guild, config.channels.sugg_decision);

    let suggMenu = new Discord.EmbedBuilder()
      .setColor(this.client.embeds.suggestion.color);
    
    if(this.client.embeds.suggestion.title) suggMenu.setTitle(this.client.embeds.suggestion.title);
    let field = this.client.embeds.suggestion.fields;
    
    if(this.client.embeds.suggestion.footer == true) suggMenu.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) }).setTimestamp();
    if(this.client.embeds.suggestion.thumbnail == true) suggMenu.setThumbnail(interaction.guild.iconURL());
    
    let suggRow = new Discord.ActionRowBuilder().addComponents(
      new Discord.ButtonBuilder()
        .setLabel(this.client.language.buttons.yes_vote.replace("<count>", 0))
        .setEmoji(this.client.config.emojis.yes_emoji || {})
        .setCustomId("vote_yes")
        .setStyle(Discord.ButtonStyle.Primary),
      new Discord.ButtonBuilder()
        .setLabel(this.client.language.buttons.no_vote.replace("<count>", 0))
        .setEmoji(this.client.config.emojis.no_emoji || {})
        .setCustomId("vote_no")
        .setStyle(Discord.ButtonStyle.Danger),
      new Discord.ButtonBuilder()
        .setLabel(this.client.language.buttons.remove_vote)
        .setEmoji(this.client.config.emojis.remove_vote || {})
        .setCustomId("vote_reset")
        .setStyle(Discord.ButtonStyle.Secondary)
    );

    let decisionRow = new Discord.ActionRowBuilder().addComponents(
      new Discord.StringSelectMenuBuilder()
        .setCustomId("decision_menu")
        .setPlaceholder(this.client.language.general.suggestions.placeholder)
        .addOptions([{
          label: this.client.language.general.suggestions.decision.accept,
          value: "decision_accept",
          emoji: this.client.config.emojis.yes_emoji
        }, {
          label: this.client.language.general.suggestions.decision.deny,
          value: "decision_deny",
          emoji: this.client.config.emojis.no_emoji
        }, {
          label: this.client.language.general.suggestions.decision.delete,
          value: "decision_delete",
          emoji: this.client.config.emojis.remove_vote
        }])
    );
    
    let suggInput = new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.TextInputBuilder()
          .setCustomId("sugg_text")
          .setLabel(this.client.language.titles.sugg_label)
          .setPlaceholder(this.client.language.modals.placeholders.suggestion)
          .setMinLength(6)
          .setRequired(true)
          .setStyle(Discord.TextInputStyle.Paragraph)
      );
    
    let suggModal = new Discord.ModalBuilder()
      .setTitle(this.client.embeds.suggestion_title)
      .setCustomId("sugg_modal")
      .addComponents(suggInput);
      
    interaction.showModal(suggModal);
    
    const filter = (i) => i.customId == 'sugg_modal' && i.user.id == interaction.user.id;
    interaction.awaitModalSubmit({ filter, time: 120_000 })
      .then(async(md) => {
      let suggValue = md.fields.getTextInputValue("sugg_text");
      
      for(let i = 0; i < this.client.embeds.suggestion.fields.length; i++) {
        suggMenu.addFields([{ name: field[i].title, value: field[i].description.replace("<author>", interaction.user)
          .replace("<suggestion>", `${suggValue}`)
          .replace("<yes_vote>", 0)
          .replace("<no_vote>", 0)
          .replace("<date>", `${new Date().toLocaleString("en-GB")}`) }])
      }
      
      if(this.client.embeds.suggestion.description) suggMenu.setDescription(this.client.embeds.suggestion.description.replace("<author>", interaction.user)
        .replace("<suggestion>", `${suggValue}`)
        .replace("<yes_vote>", 0)
        .replace("<no_vote>", 0)
        .replace("<date>", `${new Date().toLocaleString("en-GB")}`));

      md.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.sent, this.client.embeds.success_color)], ephemeral: true });
      let m = await suggChannel.send({ embeds: [suggMenu], components: [suggRow] });
      
      if(this.client.config.general.sugg_decision == true && decisionChannel) {
        let decisionMsg = await decisionChannel.send({ embeds: [suggMenu], components: [decisionRow] });
    
        await db.set(`suggestion_${interaction.guild.id}_${m.id}`, {
          text: `${suggValue}`,
          date: `${new Date().toLocaleString("en-GB")}`,
          decision: `${decisionMsg.id}`,
          author: interaction.user,
          yes: 0,
          no: 0,
          voters: []
        });
    
        await db.set(`suggestionDecision_${interaction.guild.id}_${decisionMsg.id}`, `${m.id}`);
      } else {
        await db.set(`suggestion_${interaction.guild.id}_${m.id}`, {
          text: `${suggValue}`,
          date: `${new Date().toLocaleString("en-GB")}`,
          decision: null,
          author: interaction.user,
          yes: 0,
          no: 0,
          voters: []
        });
      }
    }).catch((err) => { });
  }
};
