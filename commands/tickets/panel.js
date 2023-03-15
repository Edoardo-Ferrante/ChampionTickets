const Command = require("../../structures/Command");
const { EmbedBuilder, ActionRowBuilder, 
  ButtonBuilder, ApplicationCommandOptionType, StringSelectMenuBuilder, ButtonStyle } = require('discord.js');

module.exports = class Panel extends Command {
	constructor(client) {
		super(client, {
			name: "panel",
			description: client.cmdConfig.panel.description,
			usage: client.cmdConfig.panel.usage,
			permissions: client.cmdConfig.panel.permissions,
      aliases: client.cmdConfig.panel.aliases,
			category: "tickets",
			listed: client.cmdConfig.panel.enabled,
      slash: true,
      options: [{
        name: "category",
        description: "Ticket Category for Panel (If want Separate Panels)",
        type: ApplicationCommandOptionType.String,
        required: false,
      }]
		});
	}
  
  async run(message, args) {
    let config = this.client.config;
    let language = this.client.language;
    let category = args[0] || "general";

    let separatedPanel = category.toLowerCase() != "general";
    const listOfCategories = this.client.categories;
    if(separatedPanel == true && !category) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, language.ticket.invalid_panel, this.client.embeds.error_color)] });
  
    let findCategory = listOfCategories.map((c) => {
      if(c.id.toLowerCase() == category.toLowerCase())
        return c;
      else if(c.subcategories?.find((sc) => sc.id.toLowerCase() == category.toLowerCase()))
        return c.subcategories?.[0];
    }).filter(Boolean)?.[0];
    /* let findCategory = listOfCategories.find((c) => c.id.toLowerCase() == category.toLowerCase() 
      || c.subcategories?.find((sc) => sc.id.toLowerCase() == category.toLowerCase())); */
    if(separatedPanel == true && !findCategory) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, language.ticket.invalid_panel, this.client.embeds.error_color)] });

    const buttonRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(separatedPanel == true ? `createTicket_${category}` : 'createTicket')
          .setLabel(separatedPanel == true ? `${findCategory.name}` : this.client.language.buttons.create)
          .setEmoji(separatedPanel == true ? `${findCategory.emoji || {}}` : config.emojis.create || {})
          .setStyle(ButtonStyle.Primary),
      );

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
      .setCustomId("noSelection_panel")
      .setPlaceholder(config.category.placeholder)
      .addOptions(options);

    let row = new ActionRowBuilder()
      .addComponents(sMenu);
      
    let embed = new EmbedBuilder()
      .setTitle(separatedPanel == true ? `${findCategory.panel.title}` : this.client.embeds.panel_title)
      .setDescription(separatedPanel == true ? `${findCategory.panel.description}` : this.client.embeds.panel_message)
      .setColor(separatedPanel == true ? `${findCategory.panel.color}` : this.client.embeds.general_color);

    if(this.client.embeds.panel.footer.enabled == true) embed.setFooter({ text: this.client.embeds.footer, iconURL: this.client.user.displayAvatarURL() }).setTimestamp();
    if(this.client.embeds.panel.image.enabled == true) embed.setImage(this.client.embeds.panel.image.url);
    if(this.client.embeds.panel.thumbnail.enabled == true) embed.setThumbnail(this.client.embeds.panel.thumbnail.url);

    message.channel.send({embeds: [embed], components: [config.category.instant_panel == true ? row : buttonRow]});
  }
  async slashRun(interaction, args) {
    let config = this.client.config;
    let language = this.client.language;
    let category = interaction.options.getString("category") || "general";

    const listOfCategories = this.client.categories;
    let separatedPanel = category.toLowerCase() != "general";
    if(separatedPanel == true && !category) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, language.ticket.invalid_panel, this.client.embeds.error_color)], ephemeral: true });
    
    let findCategory = listOfCategories.map((c) => {
      if(c.id.toLowerCase() == category.toLowerCase())
        return c;
      else if(c.subcategories?.find((sc) => sc.id.toLowerCase() == category.toLowerCase()))
        return c.subcategories?.[0];
    }).filter(Boolean)?.[0];
    if(separatedPanel == true && !findCategory) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, language.ticket.invalid_panel, this.client.embeds.error_color)], ephemeral: true });

    const buttonRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(separatedPanel == true ? `createTicket_${category}` : 'createTicket')
          .setLabel(separatedPanel == true ? `${findCategory.name}` : this.client.language.buttons.create)
          .setEmoji(separatedPanel == true ? `${findCategory.emoji || {}}` : config.emojis.create || {})
          .setStyle(ButtonStyle.Primary),
      );
      
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
      .setCustomId("noSelection_panel")
      .setPlaceholder(config.category.placeholder)
      .addOptions(options);

    let row = new ActionRowBuilder()
      .addComponents(sMenu);

    let embed = new EmbedBuilder()
      .setTitle(separatedPanel == true ? `${findCategory.panel.title}` : this.client.embeds.panel_title)
      .setDescription(separatedPanel == true ? `${findCategory.panel.description}` : this.client.embeds.panel_message)
      .setColor(separatedPanel == true ? `${findCategory.panel.color}` : this.client.embeds.general_color);

    if(this.client.embeds.panel.footer.enabled == true) embed.setFooter({ text: this.client.embeds.footer, iconURL: this.client.user.displayAvatarURL() }).setTimestamp();
    if(this.client.embeds.panel.image.enabled == true) embed.setImage(this.client.embeds.panel.image.url);
    if(this.client.embeds.panel.thumbnail.enabled == true) embed.setThumbnail(this.client.embeds.panel.thumbnail.url);

    interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.panel_created, this.client.embeds.success_color)], ephemeral: true });
    interaction.channel.send({embeds: [embed], components: [config.category.instant_panel == true ? row : buttonRow]});
  }
};