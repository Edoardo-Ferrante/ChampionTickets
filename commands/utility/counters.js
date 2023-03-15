const Command = require("../../structures/Command");
const Discord = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();

module.exports = class Counters extends Command {
  constructor(client) {
    super(client, {
      name: "counters",
      description: client.cmdConfig.counters.description,
      usage: client.cmdConfig.counters.usage,
      permissions: client.cmdConfig.counters.permissions,
      aliases: client.cmdConfig.counters.aliases,
      category: "utility",
      listed: client.cmdConfig.counters.enabled,
      slash: true,
    });
  }

  async run(message, args) {
    let config = this.client.config;

    let currentTickets = (await db.all())
      .filter((i) => i.id.startsWith("ticketData_"));
    let totalTickets = await db.get(`ticketCount_${message.guild.id}`) || 0;
    let claimedTickets = await db.get(`claimedTickets_${message.guild.id}`) || 0;

    let m = await message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.utility.counters_started, this.client.embeds.general_color)] });

    let chCategory = await message.guild.channels.create({
      name: this.client.language.utility.counters_category,
      type: Discord.ChannelType.GuildCategory,
    });
    
    if(config.general.stats_type != "GUILD_VOICE" && config.general.stats_type != "GUILD_TEXT") return this.client.utils.sendError("Provided Channel Type for Counters (stats_type) is invalid. Valid types: GUILD_VOICE, GUILD_TEXT.")

    let chOpened = await message.guild.channels.create({
      name: `${this.client.language.utility.opened_counter.replace("<stats>", currentTickets.length)}`,
      type: config.general.stats_type == "GUILD_VOICE" ? Discord.ChannelType.GuildVoice : Discord.ChannelType.GuildText,
      parent: chCategory,
      permissionOverwrites: [
        {
          id: message.guild.roles.everyone,
          deny: ['Connect']
        }
      ]
    });
    let chTotal = await message.guild.channels.create({
      name: `${this.client.language.utility.total_counter.replace("<stats>", totalTickets)}`,
      type: config.general.stats_type == "GUILD_VOICE" ? Discord.ChannelType.GuildVoice : Discord.ChannelType.GuildText,
      parent: chCategory,
      permissionOverwrites: [
        {
          id: message.guild.roles.everyone,
          deny: ['Connect']
        }
      ]
    });
    let chClaimed = await message.guild.channels.create({
      name: `${this.client.language.utility.claimed_counter.replace("<stats>", claimedTickets)}`,
      type: config.general.stats_type == "GUILD_VOICE" ? Discord.ChannelType.GuildVoice : Discord.ChannelType.GuildText,
      parent: chCategory,
      permissionOverwrites: [
        {
          id: message.guild.roles.everyone,
          deny: ['Connect']
        }
      ]
    });

    await db.set(`openedChannel_${message.guild.id}`, chOpened.id);
    await db.set(`totalChannel_${message.guild.id}`, chTotal.id);
    await db.set(`claimedChannel_${message.guild.id}`, chClaimed.id);

    await m.edit({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.utility.counters_created, this.client.embeds.general_color)] });
  }
  async slashRun(interaction, args) {
    let config = this.client.config;
  
    let currentTickets = (await db.all())
      .filter((i) => i.id.startsWith("ticketData_"));
    let totalTickets = await db.get(`ticketCount_${interaction.guild.id}`) || 0;
    let claimedTickets = await db.get(`claimedTickets_${interaction.guild.id}`) || 0;

    await interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.utility.counters_started, this.client.embeds.general_color)], ephemeral: this.client.cmdConfig.counters.ephemeral });
  
    let chCategory = await interaction.guild.channels.create({
      name: this.client.language.utility.counters_category,
      type: Discord.ChannelType.GuildCategory,
    });

    let chOpened = await interaction.guild.channels.create({
      name: `${this.client.language.utility.opened_counter.replace("<stats>", currentTickets.length)}`,
      type: config.general.stats_type == "GUILD_VOICE" ? Discord.ChannelType.GuildVoice : Discord.ChannelType.GuildText,
      parent: chCategory,
      permissionOverwrites: [
        {
          id: interaction.guild.roles.everyone,
          deny: ['Connect']
        }
      ]
    });
    let chTotal = await interaction.guild.channels.create({
      name: `${this.client.language.utility.total_counter.replace("<stats>", totalTickets)}`,
      type: config.general.stats_type == "GUILD_VOICE" ? Discord.ChannelType.GuildVoice : Discord.ChannelType.GuildText,
      parent: chCategory,
      permissionOverwrites: [
        {
          id: interaction.guild.roles.everyone,
          deny: ['Connect']
        }
      ]
    });
    let chClaimed = await interaction.guild.channels.create({
      name: `${this.client.language.utility.claimed_counter.replace("<stats>", claimedTickets)}`,
      type: config.general.stats_type == "GUILD_VOICE" ? Discord.ChannelType.GuildVoice : Discord.ChannelType.GuildText,
      parent: chCategory,
      permissionOverwrites: [
        {
          id: interaction.guild.roles.everyone,
          deny: ['Connect']
        }
      ]
    });
  
    await db.set(`openedChannel_${interaction.guild.id}`, chOpened.id);
    await db.set(`totalChannel_${interaction.guild.id}`, chTotal.id);
    await db.set(`claimedChannel_${interaction.guild.id}`, chClaimed.id);
  
    await interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.utility.counters_created, this.client.embeds.general_color)], ephemeral: this.client.cmdConfig.counters.ephemeral });
  }
};
