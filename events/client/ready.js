const Event = require("../../structures/Events");
const Discord = require("discord.js");
const { QuickDB } = require("quick.db");
const chalk = require("chalk");
const { channelRoleCheck, filesCheck } = require("../../utils/utils.js");
const { htmlTranscript } = require("../../utils/createTranscript.js");
const db = new QuickDB();
const cron = require("cron");

module.exports = class Ready extends Event {
	constructor(client) {
	  super(client, "ready");
		this.client = client;
	}

	async run() {
		const config = this.client.config;
		let usedGuild = this.client.guilds.cache.get(config.general.guild);
		let error = false;
		let foundErrors = [];
		let foundWarn = [];
		
		//== Look for Missing Directories and Files ==//
		filesCheck();

		//== Check NodeJS Version ==//
		let nodeVersion = process.version.replace("v", "");
		if(nodeVersion.split(".")[1].length == 1) nodeVersion = nodeVersion.split(".")[0] + ".0" + nodeVersion.split(".")[1];

		if(nodeVersion < "16.09" && !process.version.replace("v", "").includes("16.9")) {
		  error = true;
			this.client.utils.sendError(" ");
			this.client.utils.sendError("Detected NodeJS Version (" + process.version + ") but expected v16.9+. Please Upgrade your NodeJS Version.");
			this.client.utils.sendError(" ");
			foundErrors.push("UnSupported NodeJS Version");
		}
		
		if(!this.client.config.general.guild || !this.client.guilds.cache.get(this.client.config.general.guild)) {
			error = true;
			this.client.utils.sendError(" ");
			this.client.utils.sendError("Config Field (general.guild) contains invalid Guild ID. Bot cannot work without this!");
			this.client.utils.sendError(" ");
			foundErrors.push("Invalid Guild ID");
		}
		
		//== Remove some Data ==//
		
		this.client.utils.deleteUnusedData(this.client);

		//== Look for Invalid Channel & Roles in Config ==//
		channelRoleCheck(this.client, usedGuild, foundWarn);

		let totalTickets = 0, currentTickets = 0;		
		
		if (usedGuild && config.general.guild != "") {
		  currentTickets = (await db.all())
				.filter((i) => i.id.startsWith("ticketData_")).length;
		  totalTickets = await db.get(`ticketCount_${usedGuild.id}`) || 0;
		}
		
		setInterval(async() => {
		  if (usedGuild && config.general.guild != "") {
		    currentTickets = (await db.all())
					.filter((i) => i.id.startsWith("tickets_")).length;
		    totalTickets = await db.get(`ticketCount_${usedGuild.id}`) || 0;
		  }
		}, 120000);
		
		if(config.autoAnnounce.enabled == true) {
		  setInterval(() => {
		    const annRand = Math.floor(Math.random() * config.autoAnnounce.list.length);
  		  if (this.client.config.autoAnnounce.type == "EMBED") {
  		    let annEmbed = new Discord.EmbedBuilder()
  		      .setTitle(this.client.language.titles.auto_announce)
  		      .setColor(this.client.embeds.general_color)
						.setFooter({ text: this.client.embeds.footer, iconURL: this.client.user.displayAvatarURL({ dynamic: true }) })
						.setTimestamp()
  		      .setDescription(this.client.language.general.auto_announce.replace("<message>", this.client.config.autoAnnounce.list[annRand]));
  
					let annChannel = this.client.utils.findChannel(usedGuild, config.channels.announce);
  		    annChannel.send({ embeds: [annEmbed] });
  		  } else if (this.client.config.autoAnnounce.type == "TEXT") {
  		    let annChannel = this.client.utils.findChannel(usedGuild, config.channels.announce);
  		    annChannel.send({ content: this.client.config.autoAnnounce.list[annRand] });
  		  } else {
  		    this.client.utils.sendWarn("Invalid Message Type for Auto Announcements Message Provided.");
  		  }
		  }, config.autoAnnounce.interval * 1000);
		}
		
		if(config.status.change_random == true) {
			const rand = config.status.messages.length == 1 ? 0 : Math.floor(Math.random() * (config.status.messages.length));
      
			this.client.user.setActivity(config.status.messages[rand].replace("<members>", this.client.users.cache.size)
			  .replace("<channels>", this.client.channels.cache.size)
			  .replace("<currentTickets>", currentTickets)
			  .replace("<totalTickets>", totalTickets), { type: Discord.ActivityType[config.status.type] });
			
			setInterval(() => {
				const index = config.status.messages.length == 1 ? 0 : Math.floor(Math.random() * (config.status.messages.length));
				this.client.user.setActivity(config.status.messages[index].replace("<members>", this.client.users.cache.size)
				  .replace("<channels>", this.client.channels.cache.size)
			    .replace("<currentTickets>", currentTickets)
			    .replace("<totalTickets>", totalTickets), { type: Discord.ActivityType[config.status.type] });
			}, config.status.interval * 1000);
		} else {
			this.client.user.setActivity(this.client.config.status.message.replace("<members>", this.client.users.cache.size)
			  .replace("<channels>", this.client.channels.cache.size)
			  .replace("<currentTickets>", currentTickets)
			  .replace("<totalTickets>", totalTickets), { type: Discord.ActivityType[config.status.type] });
		}
		this.client.guilds.cache.forEach((g) => {
			setInterval(() => {
				this.client.utils.updateStats(this.client, g)
			}, 30000);
		});

		//== Check for inactive Tickets ==//
		if(this.client.config.general.inactivity_check == true) {
			new cron.CronJob("00 01 00 * * *", async() => {
				const allTickets = (await db.all()).filter((i) => i.id.startsWith("ticketData_"));
				allTickets.forEach(async(x, i) => {
					setTimeout(async() => {
						const channel = usedGuild.channels.cache.get(x.id.split("_")[1]);

						let lastMessage = await channel.messages.fetch(channel.lastMessageId).catch((err) => { });
						let lastMessageDate = new Date(lastMessage.createdTimestamp);
						const dateDifference = new Date().getTime() - lastMessageDate.getTime();
						const timePassed = Math.floor(dateDifference / 1000 / 60 / 60);
	
						if(timePassed > this.client.config.general.inactivity_time) {
							const ticketMember = usedGuild.members.cache.get(x.value.owner);
							if(this.client.config.transcripts == true) await htmlTranscript(this.client, channel, ticketMember, "Ticket Inactive");
							else await channel.delete().catch((e) => { });
						}
					}, 140 * i);
				});
 			}, {
				timezone: this.client.config.general.timezone,
			}).start();
		}

    if(this.client.config.general.slash == true) {
			try {
				let oldCommands = await this.client.guilds.cache.get(this.client.config.general.guild).commands.fetch();
				oldCommands = Array.from(oldCommands).map((x) => {
					return {
						name: x[1].name,
						description: x[1].description,
						options: x[1].options ?? [],
					}
				}).sort((a, b) => b.name - a.name);

				const newCommands = JSON.stringify(this.client.slashArray.map((x) => {
					return {
						name: x.name,
						description: x.description,
						options: x.options ?? [],
					}
				}).sort((a, b) => b.name - a.name));

				if(oldCommands != newCommands) await this.client.guilds.cache.get(this.client.config.general.guild).commands.set(this.client.slashArray); 
				// await this.client.application.commands.set([]);
			} catch(e) {
				console.log(e)
				error = true;
				if(!foundErrors.includes("Invalid Guild ID")) {
					this.client.utils.sendError("Bot haven't been invited with applications.commands scope. Please ReInvite Bot with Required Scope(s).");
					foundErrors.push("Invalid Scopes");
				}
			}
    } else {
			try {
				await this.client.guilds.cache.get(this.client.config.general.guild).commands.set([]);
				// await this.client.application.commands.set([]);
			} catch(e) {
				error = true;
				if(!foundErrors.includes("Invalid Guild ID")) {
					this.client.utils.sendError("Bot haven't been invited with applications.commands scope. Please ReInvite Bot with Required Scope(s).");
					foundErrors.push("Invalid Scopes");
				}
			}
    }

		if(error || foundErrors.length > 0) {
			console.log("");
			console.log(chalk.gray("▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃"));
			console.log("")
			console.log(chalk.red.bold(`${config.general.name.toUpperCase()} ${config.version.toUpperCase()}`));
			console.log("");
			console.log(chalk.white(`There was an error while starting bot, please look above for detailed error.`));
			console.log(chalk.white(`Bot should be online if it's not an important error.`));
			console.log("");
			console.log(chalk.red(`Startup Errors (${foundErrors.length}): `) + chalk.white(foundErrors.join(", ").trim() + "."));
			console.log("")
			console.log(chalk.gray("▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃"));
			console.log(" ");
		} else {
			let addons = chalk.greenBright(`Loaded Addons (${this.client.addonList.length}): `) + chalk.white(this.client.addonList.join(", ") + ".");
			let warns = chalk.keyword("orange")(`Startup Warnings (${foundWarn.length}): `) + chalk.white(foundWarn.join(", ").trim() + ".");
			
			console.log("");
			console.log(chalk.gray("▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃"));
			console.log("")
			console.log(chalk.blue.bold(`${config.general.name.toUpperCase()} ${config.version.toUpperCase()}`));
			console.log("");
			console.log(chalk.white(`Thank you for your purchase, bot has started and is online now!`));
			console.log("")
			console.log(this.client.addonList.length > 0 ? addons : "No Addons Loaded");
			console.log(foundWarn.length > 0 ? warns : "No Warnings or Errors on startup, good job!")
			console.log("")
			console.log(chalk.gray("▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃"));
			console.log(" ");
		}
	}
};
