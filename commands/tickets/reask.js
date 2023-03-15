const Command = require("../../structures/Command");
const { QuickDB } = require("quick.db");
const { chatAskQuestions } = require("../../utils/askQuestions");
const db = new QuickDB();

module.exports = class Reask extends Command {
	constructor(client) {
		super(client, {
			name: "reask",
			description: client.cmdConfig.reask.description,
			usage: client.cmdConfig.reask.usage,
			permissions: client.cmdConfig.reask.permissions,
      aliases: client.cmdConfig.reask.aliases,
			category: "tickets",
			listed: true,
			slash: true,
		});
	}
  
  async run(message, args) {
    const ticketData = await db.get(`ticketData_${message.channel.id}`);
    const commissionMsg = await db.get(`commission_${message.channel.id}`);
		const listOfQuestions = await db.get(`listOfQuestions_${message.channel.id}`);
		const questionsAnswered = await db.get(`channelQuestions_${message.channel.id}`);
		
		if (!await this.client.utils.isTicket(this.client, message.channel)) 
			return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)] });
		
		if(!listOfQuestions || !questionsAnswered || questionsAnswered?.length == 0)
			return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.not_answered, this.client.embeds.error_color)] });
		
    const ticketOwner = message.guild.members.cache.get(ticketData?.owner);

    if(commissionMsg && commissionMsg?.quoteMsgChannel) {
			const commissionsChannel = this.client.utils.findChannel(message.guild, commissionMsg.quoteMsgChannel);
			const commFetchedMsg = await commissionsChannel.messages.fetch({ message: commissionMsg.commMessageId });
			if(commFetchedMsg) await commFetchedMsg.delete();
		} else if(commissionMsg && !commissionMsg?.quoteMsgChannel) {
			const commissionsChannel = this.client.utils.findChannel(message.guild, this.client.config.channels.commissions);
			const commFetchedMsg = await commissionsChannel.messages.fetch({ message: commissionMsg.commMessageId });
			if(commFetchedMsg) await commFetchedMsg.delete();
		}

		if(commissionMsg) {
			let bulkArr = commissionMsg.quoteList.map((x) => x.messageId);
			await message.channel.bulkDelete(bulkArr).catch((err) => {});
	
			await db.set(`commission_${message.channel.id}`, {
				user: ticketOwner.id,
				commMessageId: null,
				quoteMsgChannel: null,
				quoteList: [],
				status: "NO_STATUS",
				date: new Date()
			});
		}

		message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.reask, this.client.embeds.general_color)] });

		await chatAskQuestions(this.client, ticketOwner, message.channel, listOfQuestions.list, listOfQuestions.ticketCategory);
  }
	async slashRun(interaction, args) {
		const ticketData = await db.get(`ticketData_${interaction.channel.id}`);
		const commissionMsg = await db.get(`commission_${interaction.channel.id}`);
		const listOfQuestions = await db.get(`listOfQuestions_${interaction.channel.id}`);
		const questionsAnswered = await db.get(`channelQuestions_${interaction.channel.id}`);
		
		if (!await this.client.utils.isTicket(this.client, interaction.channel)) 
			return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)], ephemeral: this.client.cmdConfig.reask.ephemeral });
		
		if(!listOfQuestions || !questionsAnswered || questionsAnswered?.length == 0)
			return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.not_answered, this.client.embeds.error_color)], ephemeral: this.client.cmdConfig.reask.ephemeral });
		
		const ticketOwner = interaction.guild.members.cache.get(ticketData?.owner);
		
		if(commissionMsg && commissionMsg?.quoteMsgChannel) {
			const commissionsChannel = this.client.utils.findChannel(interaction.guild, commissionMsg.quoteMsgChannel);
			const commFetchedMsg = await commissionsChannel.messages.fetch({ message: commissionMsg.commMessageId });
			if(commFetchedMsg) await commFetchedMsg.delete();
		} else if(commissionMsg && !commissionMsg?.quoteMsgChannel) {
			const commissionsChannel = this.client.utils.findChannel(interaction.guild, this.client.config.channels.commissions);
			const commFetchedMsg = await commissionsChannel.messages.fetch({ message: commissionMsg.commMessageId });
			if(commFetchedMsg) await commFetchedMsg.delete();
		}
		
		if(commissionMsg) {
			let bulkArr = commissionMsg.quoteList.map((x) => x.messageId);
			await interaction.channel.bulkDelete(bulkArr).catch((err) => {});
			
			await db.set(`commission_${interaction.channel.id}`, {
				user: ticketOwner.id,
				commMessageId: null,
				quoteMsgChannel: null,
				quoteList: [],
				status: "NO_STATUS",
				date: new Date()
			});
		}
		
		interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.reask, this.client.embeds.general_color)], ephemeral: this.client.cmdConfig.reask.ephemeral });
		
		await chatAskQuestions(this.client, ticketOwner, interaction.channel, listOfQuestions.list, listOfQuestions.ticketCategory);
	}
};