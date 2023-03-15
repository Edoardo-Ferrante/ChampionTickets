const Command = require("../../structures/Command");
const { ApplicationCommandOptionType } = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();

module.exports = class ChangeCategory extends Command {
	constructor(client) {
		super(client, {
			name: "changecategory",
			description: client.cmdConfig.changecategory.description,
			usage: client.cmdConfig.changecategory.usage,
			permissions: client.cmdConfig.changecategory.permissions,
      aliases: client.cmdConfig.changecategory.aliases,
			category: "tickets",
			listed: client.cmdConfig.changecategory.enabled,
      slash: true,
      options: [{
        name: 'category',
        type: ApplicationCommandOptionType.String,
        description: "Category to which to move Ticket",
        required: true,
      }]
		});
	}
  
  async run(message, args) {
    let config = this.client.config;

    if (!await this.client.utils.isTicket(this.client, message.channel)) 
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)] });
    let category = args.join(" ");
    if(!category) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.changecategory.usage)] });

    let foundCategory = this.client.categories.find(c => c.name.toLowerCase().includes(category.toLowerCase()) || c.id.toLowerCase().includes(category.toLowerCase()));
    if(!foundCategory || foundCategory.category == "" || !this.client.utils.findChannel(message.guild, foundCategory.category)) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.language.titles.error, this.client.language.ticket.invalid_category, this.client.embeds.error_color)] });
    if(config.category.separateCategories == false || config.category.status == false) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.language.titles.error, this.client.language.ticket.not_separate, this.client.embeds.error_color)] });

    const ticketData = await db.get(`ticketData_${message.channel.id}`) || {};
    const ticketOwner = this.client.users.cache.get(ticketData.owner);

    let editCategory = this.client.utils.findChannel(message.guild, foundCategory.category);
    
    const canRename = await this.client.utils.canEditName(message.guild, message.channel);
    message.channel.edit({
      name: config.general.rename_choose == true && foundCategory.channel_name != "" && canRename == true && ticketOwner ? this.client.utils.ticketPlaceholders(foundCategory.channel_name, ticketOwner, ticketData.id) : null,
      parent: editCategory,
      lockPermissions: false,
    });

    if(!message.channel.topic) message.channel.setTopic(this.client.language.ticket.move_topic.replace("<category>", foundCategory.name).replace("<user>", message.author));
    else message.channel.setTopic("\n" + this.client.language.ticket.move_topic.replace("<category>", foundCategory.name).replace("<user>", message.author));

    message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.category_moved.replace("<category>", foundCategory.name).replace("<user>", message.author), this.client.embeds.general_color)] });
  }
  async slashRun(interaction, args) {
    let config = this.client.config;
    let category = interaction.options.getString("category");

    if (!await this.client.utils.isTicket(this.client, interaction.channel)) 
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)] });

    let foundCategory = this.client.categories.find(c => c.name.toLowerCase().includes(category.toLowerCase()) || c.id.toLowerCase().includes(category.toLowerCase()));
    if(!foundCategory || foundCategory.category == "" || !this.client.utils.findChannel(interaction.guild, foundCategory.category)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.language.titles.error, this.client.language.ticket.invalid_category, this.client.embeds.error_color)] });
    if(config.category.separateCategories == false || config.category.status == false) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.language.titles.error, this.client.language.ticket.not_separate, this.client.embeds.error_color)] });
    
    const ticketData = await db.get(`ticketData_${interaction.channel.id}`) || {};
    const ticketOwner = this.client.users.cache.get(ticketData.owner);

    let editCategory = this.client.utils.findChannel(interaction.guild, foundCategory.category);
    
    const canRename = await this.client.utils.canEditName(interaction.guild, interaction.channel);
    interaction.channel.edit({
      name: config.general.rename_choose == true && foundCategory.channel_name != "" && canRename == true && ticketOwner ? this.client.utils.ticketPlaceholders(foundCategory.channel_name, ticketOwner, ticketData.id) : null,
      parent: editCategory,
      lockPermissions: false,
    });

    if(!interaction.channel.topic) interaction.channel.setTopic(this.client.language.ticket.move_topic.replace("<category>", foundCategory.name).replace("<user>", interaction.user));
    else interaction.channel.setTopic("\n" + this.client.language.ticket.move_topic.replace("<category>", foundCategory.name).replace("<user>", interaction.user));
      
    interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.category_moved.replace("<category>", foundCategory.name).replace("<user>", interaction.user), this.client.embeds.general_color)], ephemeral: this.client.cmdConfig.changecategory.ephemeral });
  }
};