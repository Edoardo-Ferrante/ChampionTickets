const Command = require("../../structures/Command");
const { QuickDB } = require("quick.db");
const db = new QuickDB();
const { ApplicationCommandOptionType } = require("discord.js");

module.exports = class TranscriptCode extends Command {
  constructor(client) {
    super(client, {
      name: "transcriptcode",
      description: client.cmdConfig.transcriptcode.description,
      usage: client.cmdConfig.transcriptcode.usage,
      permissions: client.cmdConfig.transcriptcode.permissions,
      aliases: client.cmdConfig.transcriptcode.aliases,
      category: "utility",
      listed: client.cmdConfig.transcriptcode.enabled,
      slash: true,
      options: [{
        name: "transcript", 
        description: "ID of Transcript for which to get code", 
        type: ApplicationCommandOptionType.Number, 
        required: true
      }]
    });
  }

  async run(message, args) {
    let transcript = args[0];
    
    if(!transcript || isNaN(transcript)) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.transcriptcode.usage)] });
    const code = await db.get(`transcript_${transcript}`)
    if(!code) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.transcriptcode.usage)] });
    
    await message.author.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.transcript_code.replace("<transcript>", transcript).replace("<code>", code), this.client.embeds.success_color)] }).catch(async(err) => {
      message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.general.dm_closed, this.client.embeds.error_color)] });
    });
  }
  async slashRun(interaction, args) {
    let transcript = interaction.options.getNumber("transcript");

    const code = await db.get(`transcript_${transcript}`)
    if(!code) return interaction.reply({ embeds: [this.client.utils.usage(this.client, interaction, this.client.cmdConfig.transcriptcode.usage)] });
    
    await interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.transcript_code.replace("<transcript>", transcript).replace("<code>", code), this.client.embeds.success_color)], ephemeral: true });
  }
};