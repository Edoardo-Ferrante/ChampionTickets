const Command = require("../../structures/Command");
const Discord = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();

module.exports = class Notes extends Command {
  constructor(client) {
    super(client, {
      name: "notes",
      description: client.cmdConfig.notes.description,
      usage: client.cmdConfig.notes.usage,
      permissions: client.cmdConfig.notes.permissions,
      aliases: client.cmdConfig.notes.aliases,
      category: "service",
      listed: client.cmdConfig.notes.enabled,
      slash: true,
    });
  }

  async run(message, args) {
    let notes = args.join(" ");
    let option = await db.get(`notes_${message.channel.id}`);

    if(args[0]) {
      await db.set(`notes_${message.channel.id}`, notes);
      message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.note_added.replace("<note>", notes), this.client.embeds.success_color)] });
    } else {
      if(!option || option == null) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.general.not_set, this.client.embeds.error_color)] });
      await db.delete(`notes_${message.channel.id}`);
      message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.note_reseted, this.client.embeds.success_color)] });
    }
  }
  
  async slashRun(interaction, args) {
    let option = await db.get(`notes_${interaction.channel.id}`) || "";
    
    let notesRow = new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.TextInputBuilder()
          .setLabel(this.client.language.modals.labels.notes)
          .setPlaceholder(this.client.language.modals.placeholders.notes)
          .setStyle(Discord.TextInputStyle.Paragraph)
          .setCustomId("notes_value")
          .setValue(option)
      );
    let modal = new Discord.ModalBuilder()
      .setTitle(this.client.language.titles.notes)
      .setCustomId("notes_modal")
      .addComponents(notesRow);
      
    interaction.showModal(modal);
    
    let filter = (int) => int.customId == "notes_modal" && int.user.id == interaction.user.id;
    interaction.awaitModalSubmit({ filter, time: 120_000 }).then(async (int) => {
      let notesValue = int.fields.getTextInputValue("notes_value");
      
      if (notesValue.length > 6) {
        await db.set(`notes_${interaction.channel.id}`, notesValue);
        int.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.note_added.replace("<note>", notesValue), this.client.embeds.success_color)] });
      } else {
        await db.delete(`notes_${interaction.channel.id}`);
        int.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.note_reseted, this.client.embeds.success_color)] });
      }
    }).catch((err) => { })
  }
};
