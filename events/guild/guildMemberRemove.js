const Discord = require("discord.js");
const Event = require("../../structures/Events");
const { QuickDB } = require("quick.db");
const db = new QuickDB();
const { htmlTranscript } = require("../../utils/createTranscript.js");

module.exports = class GuildMemberRemove extends Event {
	constructor(...args) {
		super(...args);
	}

	async run(member) {
	  let config = this.client.config;
    if(this.client.config.general.remove_leave == true) {
      let ticketList = await db.get(`tickets_${member.id}`) || [];
      if(!ticketList || ticketList.length == 0) return;
      ticketList.forEach(async(x) => {
        const channel = member.guild.channels.cache.get(x.channel);
				await htmlTranscript(this.client, channel, member, "Member Left");
      })
    }
  }
};