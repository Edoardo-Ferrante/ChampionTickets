const { QuickDB } = require("quick.db");
const db = new QuickDB();
const Event = require("../../structures/Events");

module.exports = class ChannelDelete extends Event {
	constructor(...args) {
		super(...args);
	}

	async run(channel) {
	  if(!channel.guild.members.me.permissions.has("ManageGuild")) return;
    if(!channel.guild) return;

		let dataRemove = (await db.all())
			.filter((i) => i.id.includes(channel.id));

		let dataRemoveExtra = (await db.all())
			.filter((i) => `${i.value}`.includes(channel.id));

		const ticketData = await db.get(`ticketData_${channel.id}`);
		if(ticketData) {
			await db.delete(`choosingCategory_${ticketData.owner}`);
		}

		const commissionMsg = await db.get(`commission_${channel.id}`);
		if(commissionMsg && commissionMsg?.quoteMsgChannel) {
			const commissionsChannel = this.client.utils.findChannel(channel.guild, commissionMsg.quoteMsgChannel);
			const commFetchedMsg = await commissionsChannel.messages.fetch({ message: commissionMsg.commMessageId }).catch((err) => {});
			if(commFetchedMsg) await commFetchedMsg.delete();
		} else if(commissionMsg && !commissionMsg?.quoteMsgChannel) {
			const commissionsChannel = this.client.utils.findChannel(channel.guild, this.client.config.channels.commissions);
			const commFetchedMsg = await commissionsChannel.messages.fetch({ message: commissionMsg.commMessageId }).catch((err) => {});
			if(commFetchedMsg) await commFetchedMsg.delete();
		}

		dataRemove.forEach(async(x) => await db.delete(x.id));
		dataRemoveExtra.forEach(async(x) => await db.delete(x.id));
	} 
};