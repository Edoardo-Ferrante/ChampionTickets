const Command = require("../../structures/Command");
const Discord = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();

module.exports = class GetReview extends Command {
  constructor(client) {
    super(client, {
      name: "getreview",
      description: client.cmdConfig.getreview.description,
      usage: client.cmdConfig.getreview.usage,
      permissions: client.cmdConfig.getreview.permissions,
      aliases: client.cmdConfig.getreview.aliases,
      category: "service",
      listed: client.cmdConfig.getreview.enabled,
      slash: true,
      options: [{
        name: 'user',
        type: Discord.ApplicationCommandOptionType.User,
        description: "User who's Review to get",
        required: true,
      },{
        name: 'id',
        type: Discord.ApplicationCommandOptionType.Number,
        description: "ID of Review",
        required: true,
      }]
    });
  }

  async run(message, args) {
    let config = this.client.config;

    let user = message.mentions.users.first() || this.client.users.cache.get(args[0]) || message.author;
    let id = args[1];
    
    if(!id) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.getreview.usage)] });
    if(id.startsWith("#"))  id = id.slice(1);
    
    let data = await db.get(`reviews_${message.guild.id}_${user.id}`) || [];
    
    let find = data.find((d) => d.id.toLowerCase() == id.toLowerCase() && d.user == user.id);
    if(!find) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.language.titles.error, this.client.language.service.no_review, this.client.embeds.error_color )] });
    
    let rUser = this.client.users.cache.get(find.user);
    if(rUser == undefined || rUser == null) rUser = "Unknown User";
    
    let author = this.client.users.cache.get(find.author);
    if(author == undefined || author == null) author = "Unknown Author";
    
    let rate = config.emojis.review.star.repeat(parseInt(find.rating));
    let formatDate = find.date.toLocaleString("en-GB");
    
    let embed = new Discord.EmbedBuilder()
      .setDescription(this.client.embeds.service.reviewInfo.description.replace("<id>", find.id)
        .replace("<author>", author)
        .replace("<user>", rUser)
        .replace("<comment>", find.comment)
        .replace("<rating>", rate)
        .replace("<date>", formatDate))
      .setColor(this.client.embeds.service.reviewInfo.color);
      
    if(this.client.embeds.service.reviewInfo.title) embed.setTitle(this.client.embeds.service.reviewInfo.title);
    if(this.client.embeds.service.reviewInfo.footer == true) embed.setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL() }).setTimestamp();
    
    message.channel.send({ embeds: [embed] });
  }
  async slashRun(interaction, args) {
    let config = this.client.config;

    let user = interaction.options.getUser("user");
    let id = interaction.options.getNumber("id");

    if(id.startsWith("#"))  id = id.slice(1);

    let data = await db.get(`reviews_${interaction.guild.id}_${user.id}`) || [];
    
    let find = data.find(d => d.id == id && d.user == user.id);
    if(!find) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.language.titles.error, this.client.language.service.no_review, this.client.embeds.error_color )] });
    
    let rUser = this.client.users.cache.get(find.user);
    if(rUser == undefined || rUser == null) rUser = "Unknown User";
    
    let author = this.client.users.cache.get(find.author);
    if(author == undefined || author == null) author = "Unknown Author";
    
    let rate = config.emojis.review.star.repeat(parseInt(find.rating));
    let formatDate = find.date.toLocaleString("en-GB");
    
    let embed = new Discord.EmbedBuilder()
      .setDescription(this.client.embeds.service.reviewInfo.description.replace("<id>", find.id)
        .replace("<author>", author)
        .replace("<user>", rUser)
        .replace("<comment>", find.comment)
        .replace("<rating>", rate)
        .replace("<date>", formatDate))
      .setColor(this.client.embeds.service.reviewInfo.color);
      
    if(this.client.embeds.service.reviewInfo.title) embed.setTitle(this.client.embeds.service.reviewInfo.title);
    if(this.client.embeds.service.reviewInfo.footer == true) embed.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() }).setTimestamp();
    
    interaction.reply({ embeds: [embed], ephemeral: this.client.cmdConfig.getreview.ephemeral });
  }
};