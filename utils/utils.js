const { QuickDB } = require("quick.db");
const db = new QuickDB();
const Discord = require("discord.js");
const fs = require("fs");
const chalk = require("chalk");
const FormData = require("form-data");
const fetch = require("node-fetch");
const yaml = require("yaml");
const jsdom = require("jsdom");
const { OverwriteType } = require("discord.js");
const { JSDOM } = jsdom;
const dom = new JSDOM();
const document = dom.window.document;
const config = yaml.parse(fs.readFileSync('./configs/config.yml', 'utf8'));
const language = yaml.parse(fs.readFileSync('./configs/language.yml', 'utf8'));

function formatTime(ms) {
  let roundNumber = ms > 0 ? Math.floor : Math.ceil;
  let days = roundNumber(ms / 86400000),
    hours = roundNumber(ms / 3600000) % 24,
    mins = roundNumber(ms / 60000) % 60,
    secs = roundNumber(ms / 1000) % 60;
  var time = (days > 0) ? `${days}d ` : "";
  time += (hours > 0) ? `${hours}h ` : "";
  time += (mins > 0) ? `${mins}m ` : "";
  time += (secs > 0) ? `${secs}s` : "0s";
  return time;
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

const updateStats = async(client, guild) => {
  let currentTickets = (await db.all())
    .filter((i) => i.id.startsWith("ticketData_"));
  let claimedTickets = await db.get(`claimedTickets_${guild.id}`) || 0;
  let totalTickets = await db.get(`ticketCount_${guild.id}`) || 0;

  let chOpened = await db.get(`openedChannel_${guild.id}`);
  let chClaimed = await db.get(`claimedChannel_${guild.id}`);
  let chTotal = await db.get(`totalChannel_${guild.id}`);

  if(chOpened != null && guild.channels.cache.get(chOpened)) {
    let ch = guild.channels.cache.get(chOpened);
    ch.setName(ch.name.replace(/[0-9]/g, "") + currentTickets.length);
  }
  if(chClaimed != null && guild.channels.cache.get(chClaimed)) {
    let ch = guild.channels.cache.get(chClaimed);
    ch.setName(ch.name.replace(/[0-9]/g, "") + claimedTickets);
  }
  if(chTotal != null && guild.channels.cache.get(chTotal)) {
    let ch = guild.channels.cache.get(chTotal);
    ch.setName(ch.name.replace(/[0-9]/g, "") + totalTickets);
  }
}

function commandsList(client, category) {
  prefix = client.config.general.prefix;
  let commands = client.commands.filter(
    c => c.category == category && c.listed == true
  );

  let loaded = [...commands.values()];
  let content = "";

  loaded.forEach(
    c => (content += `\`${c.name}\`, `)
  );
  if(content.length == 0) content = client.language.general.no_commands + ", ";

  return content.slice(0, -2);
}

const pushReview = async(message, userId, object) => {
  let history = await db.get(`reviews_${message.guild.id}_${userId}`) || [];
  history.unshift(object);
  await db.set(`reviews_${message.guild.id}_${userId}`, history);
}

const generateId = () => {
  let firstPart = (Math.random() * 46656) | 0;
  let secondPart = (Math.random() * 46656) | 0;
  firstPart = ("000" + firstPart.toString(36)).slice(-3);
  secondPart = ("000" + secondPart.toString(36)).slice(-3);

  return firstPart + secondPart;
}

const sendError = (error) => {
  console.log(chalk.red("[ERROR] ") + chalk.white(error));
  
  let errorMessage = `[${new Date().toLocaleString("en-GB")}] [ERROR] ${error}\n`;
  fs.appendFile("./errors.txt", errorMessage, (e) => {
    if(e) console.log(e);
  });
}

const sendWarn = (warn) => {
  console.log(chalk.keyword("orange")("[WARNING] ") + chalk.white(warn));

  let warnMessage = `[${new Date().toLocaleString("en-GB")}] [WARN] ${warn}\n`;
  fs.appendFile("./info.txt", warnMessage, (e) => {
    if(e) console.log(e);
  });
}

const sendInfo = (info) => {
  console.log(chalk.blue("[INFO] ") + chalk.white(info));
}

const findChannel = (guild, channel) => {
  if(channel == "") return undefined;

  return guild.channels.cache.find(ch => ch.name.toLowerCase().includes(`${channel}`.toLowerCase())) || guild.channels.cache.get(channel);
}

const usage = (client, message, validUsage) => {
  let embed = client.embedBuilder(client, message.member.user, client.embeds.title, client.language.general.usage.replace("<usage>", validUsage), client.embeds.error_color);
  return embed;
}

const findRole = (guild, role) => {
  if(role == "") return undefined;

  return guild.roles.cache.find(r => r.name.toLowerCase().includes(`${role}`.toLowerCase())) || guild.roles.cache.get(role);
}

const hasRole = (client, guild, member, roles, checkEmpty = false) => {
  if(checkEmpty == true && roles.length == 0) return true;

  let arr = roles.map((x, i) => {
    let findPerm = client.utils.findRole(guild, `${x}`.toLowerCase());
    if(!findPerm) return false;
    if(member.roles.cache.has(findPerm.id)) return true;

    return false;
  });
  if(checkEmpty == true && arr.length == 0) return true;

  return arr.includes(true) ? true : false;
}

const hasPermissions = (message, member, permList) => {
  if(permList.length == 0) return true;
  
  let userPerms = [];
  permList.forEach((perm) => {
    if(!Discord.PermissionFlagsBits[perm]) return userPerms.push(true);
    if(!message.channel.permissionsFor(member).has(perm)) return userPerms.push(false);
    else return userPerms.push(true);
  });

  return userPerms.includes(true) ? true : false;
}

const filesCheck = () => {
  if(!fs.existsSync('./info.txt')) {
    fs.open('./info.txt', 'w', function(err, file) {
      if(err) sendError("Couldn't create file (info.txt)");
      sendInfo("File (info.txt) doesn't exist, creating it.");
    });
  }
  if(!fs.existsSync('./errors.txt')) {
    fs.open('./errors.txt', 'w', function(err, file) {
      if(err) sendError("Couldn't create file (errors.txt)");
      sendInfo("File (errors.txt) doesn't exist, creating it.");
    });
  }
  if(!fs.existsSync('./transcripts')) {
    fs.mkdir('./transcripts', function(err) {
      if(err) sendError("Couldn't create folder (transcripts)");
      sendInfo("Folder (transcripts) doesn't exist, creating it.");
    })
  }
  if(!fs.existsSync('./products')) {
    fs.mkdir('./products', function(err) {
      if(err) sendError("Couldn't create folder (products)");
      sendInfo("Folder (products) doesn't exist, creating it.");
    })
  }
  if(!fs.existsSync('./addons')) {
    fs.mkdir('./addons', function(err) {
      if(err) sendError("Couldn't create folder (addons)");
      sendInfo("Folder (addons) doesn't exist, creating it.");
    })
  }
}

const generateTranscript = async (channel, msgs, ticket, save = true) => {
  let htmlContainer = "";
  let ticketData = await db.get(`ticketData_${channel.id}`);
  let data = await fs.readFileSync('./data/template.html', {
    encoding: 'utf-8'
  });
  if(save == true) {
    await fs.writeFileSync(`transcripts/ticket-${ticket}.html`, data);
  } else {
    htmlContainer += data;
  }

  let guildElement = document.createElement('div');

  let guildNameEl = document.createElement("span");
  let guildText = document.createTextNode(channel.guild.name);

  let openEl = document.createElement("span");
  let openText = document.createTextNode(language.ticket.creation + '' + new Date(parseInt(ticketData?.openedTimestamp || new Date().getTime())).toLocaleString("en-GB") || 'N/A')
  openEl.appendChild(openText);
  openEl.style = `display: flex; padding-top: 15px; font-size: 15px;`

  let closeEl = document.createElement("span");
  let closeText = document.createTextNode(language.ticket.closing + '' + new Date().toLocaleString("en-GB") || 'N/A');
  if(save == false) closeText = document.createTextNode('Current Time' + new Date().toLocaleString("en-GB") || 'N/A')
  closeEl.appendChild(closeText);
  closeEl.style = `display: flex; padding-top: 5px; font-size: 15px;`

  guildNameEl.appendChild(guildText);
  guildNameEl.appendChild(openEl)
  guildNameEl.appendChild(closeEl)
  guildNameEl.style = `margin-left: 43px`
  guildNameEl.style = `margin-top: 45px`

  let guildImg = document.createElement('img');
  guildImg.setAttribute('src', channel.guild.iconURL());
  guildImg.setAttribute('width', '128');
  guildImg.className = "guild-image";
  guildElement.appendChild(guildImg);
  guildElement.appendChild(guildNameEl);
  guildElement.style = "display: flex";
  if(save == true) {
    await fs.appendFileSync(`transcripts/ticket-${ticket}.html`, guildElement.outerHTML, (err) => {
      if(err) console.log(err)
    });
  } else {
    htmlContainer += guildElement.outerHTML;
  }

  for(const msg of msgs) {
    let parentContainer = document.createElement("div");
    parentContainer.className = "parent-container";

    let avatarDiv = document.createElement("div");
    avatarDiv.className = "avatar-container";
    let img = document.createElement('img');
    img.setAttribute('src', msg.author.displayAvatarURL());
    img.className = "avatar";
    avatarDiv.appendChild(img);

    parentContainer.appendChild(avatarDiv);

    let messageContainer = document.createElement('div');
    messageContainer.className = "message-container";

    let nameElement = document.createElement("span");
    let name = document.createTextNode(`${msg.author.tag} `)
    let dateSpan = document.createElement("span");
    let dateText = document.createTextNode(`${msg.createdAt.toLocaleString("en-GB")}`)
    dateSpan.appendChild(dateText)
    dateSpan.style = `font-size: 12px; color: #c4c4c4;`
    nameElement.appendChild(name);
    nameElement.appendChild(dateSpan)
    nameElement.style = `padding-bottom: 10px`
    messageContainer.append(nameElement);

    let msgNode = document.createElement('span');
    if(msg.content) 
      msgNode.innerHTML = replaceFormatting(channel.guild, msg.content);

    if(msg.attachments && msg.attachments.size > 0 && config.general.save_images == true) {
      for (const attachment of Array.from(msg.attachments.values())) {
        const attDiv = document.createElement("div");
        attDiv.classList.add("chat-image");

        const attachmentType = (attachment.name ?? 'unknown.png')
          .split('.')
          .pop()
          .toLowerCase();

        const formats = ["png", "jpg", "jpeg", "webp", "gif"];
        if(formats.includes(attachmentType)) {
          const attLink = document.createElement("a");
          const attImg = document.createElement("img");

          attImg.classList.add("chat-media");
          attImg.src = await getImage(attachment.proxyURL ?? attachment.url) ?? attachment.proxyURL ?? attachment.url;

          attImg.alt = "Transcript Image";

          attLink.appendChild(attImg);
          attDiv.appendChild(attLink);

          msgNode.appendChild(attDiv)
        }
      }
    }

    messageContainer.appendChild(msgNode);
    
    if(msg.embeds[0]) {
      let fields = [];
      if(msg.embeds[0].data.fields) {
        for (let i = 0; i < msg.embeds[0].data.fields.length; i++) {
          fields.push(
            `<b><font size="+1">${msg.embeds[0].data.fields[i].name}</font></b><br>${replaceFormatting(msg.guild, msg.embeds[0].data.fields[i].value)}<br>`
          )
        }
      }
      let msgEmbed = msg.embeds[0];
      let embedNode = document.createElement("div");
      embedNode.className = "embed";

      let colorNode = document.createElement("div");
      const dataColor = msgEmbed.data.color;
      const formatColor = Number(dataColor).toString(16);
      colorNode.className = "embed-color";
      colorNode.style = `background-color: #${`${dataColor}`.length == 3 ? `0000${formatColor}` : formatColor}`;
      embedNode.appendChild(colorNode);
      let embedContent = document.createElement("div");
      embedContent.className = "embed-content";

      let titleNode = document.createElement("span");
      titleNode.className = "embed-title";
      titleNode.innerHTML = msgEmbed.data.title || msgEmbed.data.author?.name || " ";
      embedContent.appendChild(titleNode);

      if(msgEmbed.data.fields) {
        if(!msgEmbed.data.description) msgEmbed.data.description = "";
        let descNode = document.createElement("span");
        descNode.className = "embed-description";
        descNode.innerHTML = replaceFormatting(channel.guild, msgEmbed.data.description) + "<br><br>" + fields.join("<br>");
        embedContent.appendChild(descNode);
      } else {
        if(!msgEmbed.data.description) msgEmbed.data.description = "";
        let descNode = document.createElement("span");
        descNode.className = "embed-description";
        descNode.innerHTML = replaceFormatting(channel.guild, msgEmbed.data.description);
        embedContent.appendChild(descNode);
      }
      embedNode.appendChild(embedContent);
      messageContainer.append(embedNode);
    }

    parentContainer.appendChild(messageContainer);
    if(save == true) {
      await fs.appendFileSync(`transcripts/ticket-${ticket}.html`, parentContainer.outerHTML, (err) => {
        if(err) console.log(err)
      });
    } else {
      htmlContainer += parentContainer.outerHTML;
    };
  };
  if(save == false) return htmlContainer;
}

const channelRoleCheck = (client, usedGuild, foundWarn) => {
  const config = client.config;
  if(client.config.category.separateRoles.enabled == true && client.categories.length > 0) {
    for (let i = 0; i < client.categories.length; i++) {
      if(!client.categories[i].roles) continue;
      if(client.categories[i].roles.length == 0) continue;
      let findRole = client.categories[i].roles.map((x) => client.utils.findRole(usedGuild, x));

      if(findRole.includes("undefined") || findRole.includes(undefined)) {
        client.utils.sendWarn(`One or more Category Roles (categories.${client.categories[i].id}.roles) provided are invalid or belongs to other Server.`);
        foundWarn.push("Invalid Category Role");
        break;
      }
    }
  }
  if(client.config.roles.support.length > 0) {
    for (let i = 0; i > client.config.roles.support.length; i++) {
      let findRole = client.utils.findRole(usedGuild, client.config.roles.support[i]);
      if(!findRole) {
        client.utils.sendWarn(`One or more Support Roles (roles.support - ${client.config.roles.support[i]}) provided are invalid or belongs to other Server.`);
        foundWarn.push("Invalid Support Role(s)");
        break;
      }
    }
  }
  if(client.config.roles.bypass.cooldown.length > 0) {
    for (let i = 0; i > client.config.roles.bypass.cooldown.length; i++) {
      let findRole = client.utils.findRole(usedGuild, client.config.roles.bypass.cooldown[i]);
      if(!findRole) {
        client.utils.sendWarn(`One or more Cooldown Bypass Roles (roles.bypass.cooldown - ${client.config.roles.bypass.cooldown[i]}) provided are invalid or belongs to other Server.`);
        foundWarn.push("Invalid Cooldown Bypass Role(s)");
        break;
      }
    }
  }
  if(client.config.roles.bypass.permission.length > 0) {
    for (let i = 0; i > client.config.roles.bypass.permission.length; i++) {
      let findRole = client.utils.findRole(usedGuild, client.config.roles.bypass.permission[i]);
      if(!findRole) {
        client.utils.sendWarn(`One or more Permission Bypass Roles (roles.bypass.permission - ${client.config.roles.bypass.permission[i]}) provided are invalid or belongs to other Server.`);
        foundWarn.push("Invalid Permission Bypass Role(s)");
        break;
      }
    }
  }
  if(client.config.sellix.separateProducts.enabled == true && client.config.sellix.products > 0) {
    for (let i = 0; i < client.config.sellix.products.length; i++) {
      if(client.config.sellix.products[i].roles.length == 0) continue;
      let findRole = client.config.sellix.products[i].roles.map((x) => client.utils.findRole(usedGuild, x));

      if(findRole.includes("undefined") || findRole.includes(undefined)) {
        client.utils.sendWarn(`One or more Sellix Product Verification Roles (sellix.products.PRODUCT.roles) provided are invalid or belongs to other Server.`);
        foundWarn.push("Invalid Sellix Verification Role(s)");
        break;
      }
    }
  }
  if(config.channels.transcripts != "") {
    let findChannel = client.utils.findChannel(usedGuild, config.channels.transcripts);
    if(!findChannel) {
      client.utils.sendWarn("Transcripts Channel Name/ID (transcripts) provided is invalid or belongs to other Server.");
      foundWarn.push("Invalid Transcripts Channel");
    }
  }
  if(config.channels.suggestions != "") {
    let findChannel = client.utils.findChannel(usedGuild, config.channels.suggestions);
    if(!findChannel) {
      client.utils.sendWarn("Suggestions Channel Name/ID (suggestions) provided is invalid or belongs to other Server.");
      foundWarn.push("Invalid Suggestions Channel");
    }
  }
  if(config.channels.sugg_logs != "" && config.general.sugg_decision == true) {
    let findChannel = client.utils.findChannel(usedGuild, config.channels.sugg_logs);
    if(!findChannel) {
      client.utils.sendWarn("Suggestion Logs Channel Name/ID (sugg_logs) provided is invalid or belongs to other Server.");
      foundWarn.push("Invalid Suggestions Logs Channel");
    }
  }
  if(config.channels.sugg_decision != "" && config.general.sugg_decision == true) {
    let findChannel = client.utils.findChannel(usedGuild, config.channels.sugg_logs);
    if(!findChannel) {
      client.utils.sendWarn("Suggestion Decision Channel Name/ID (sugg_decision) provided is invalid or belongs to other Server.");
      foundWarn.push("Invalid Suggestions Decision Channel");
    }
  }
  if(config.channels.announce != "") {
    let findChannel = client.utils.findChannel(usedGuild, config.channels.announce);
    if(!findChannel) {
      client.utils.sendWarn("Auto Announcements Channel Name/ID (announce) provided is invalid or belongs to other Server.");
      foundWarn.push("Invalid Auto Announcements Channel");
    }
  }
  if(config.channels.reviews != "") {
    let findChannel = client.utils.findChannel(usedGuild, config.channels.reviews);
    if(!findChannel) {
      client.utils.sendWarn("Reviews Channel Name/ID (reviews) provided is invalid or belongs to other Server.");
      foundWarn.push("Invalid Reviews Channel");
    }
  }
  if(!Array.isArray(client.config.roles.support)) {
    client.utils.sendWarn("Config field for Support Roles (roles.support) is not of proper type (Array).");
    foundWarn.push("Invalid Support Roles Config Field Type");
  }
  if(!Array.isArray(client.config.roles.blacklist)) {
    client.utils.sendWarn("Config field for Blacklisted Users (roles.blacklist) is not of proper type (Array).");
    foundWarn.push("Invalid Blacklisted Users Config Field Type");
  }
  if(!Array.isArray(client.config.roles.bypass.cooldown)) {
    client.utils.sendWarn("Config field for Cooldown Bypass (roles.bypass.cooldown) is not of proper type (Array).");
    foundWarn.push("Invalid Cooldown Bypass Config Field Type");
  }
  if(!Array.isArray(client.config.roles.bypass.permission)) {
    client.utils.sendWarn("Config field for Permission Bypass (roles.bypass.permission) is not of proper type (Array).");
    foundWarn.push("Invalid Permission Bypass Config Field Type");
  }
}

const ticketUsername = (user) => {
  const regex = /[^a-z0-9]+/g
  const format = user.username.toLowerCase().replace(regex, "");
  return format == "" ? `${user.id}` : format;
}

const ticketPlaceholders = (string, user, ticket) => {
  if(ticket < 10) ticket = "000" + ticket;
  else if(ticket >= 10 && ticket < 100) ticket = "00" + ticket
  else if(ticket >= 100 && ticket < 1000) ticket = "0" + ticket
  else if(ticket >= 1000) ticket = ticket;

  return string.toLowerCase().replace("<username>", ticketUsername(user)).replace("<ticket>", ticket);
}

const downloadProduct = async (client, message, product) => {
  let productList = yaml.parse(fs.readFileSync('./configs/products.yml', 'utf8'));
  if(productList.products[product].type == "FILE") {
    const formData = new FormData();
		formData.append("maxDownloads", parseInt(client.config.products.limit_download));
		formData.append("autoDelete", "true");
		formData.append(
			"file",
			fs.createReadStream(`products/${productList.products[product].product}`),
		);
	
		await fetch(`https://file.io/?expires=${client.config.products.delete_download}`, {
			method: "POST",
			body: formData,
			headers: {
				Accept: "application/json",
			},
		}).then(async(res) => {
      const data = await res.json();

      const row = new Discord.ActionRowBuilder()
        .addComponents(
          new Discord.ButtonBuilder()
          .setStyle(Discord.ButtonStyle.Primary)
          .setLabel(client.language.buttons.download)
          .setEmoji(client.config.emojis.file || {})
          .setCustomId('downloadFiles'),
        );

      if(message.type == Discord.InteractionType.ApplicationCommand) {
        m = await message.reply({ embeds: [client.embedBuilder(client, message.member.user, client.embeds.title, client.language.products.download_get.replace("<file>", `${productList.products[product].name}`), client.embeds.success_color)], components: [row], ephemeral: client.cmdConfig.getproduct.ephemeral });
      } else {
        m = await message.channel.send({ embeds: [client.embedBuilder(client, message.member.user, client.embeds.title, client.language.products.download_get.replace("<file>", `${productList.products[product].name}`), client.embeds.success_color)], components: [row], ephemeral: client.cmdConfig.getproduct.ephemeral });
      }
      const filter = (interaction) => interaction.customId == 'downloadFiles' && interaction.user.id == message.member.user.id;
      await message.channel.awaitMessageComponent({ filter, componentType: Discord.ComponentType.Button, max: 1 }).then(async (i) => {
        await i.deferUpdate({ ephemeral: true });
        const downloadFile = new Discord.ActionRowBuilder()
          .addComponents(
            new Discord.ButtonBuilder()
            .setStyle(Discord.ButtonStyle.Link)
            .setLabel(client.language.buttons.download)
            .setEmoji(client.config.emojis.file || {})
            .setURL(data.link)
          );
        await i.followUp({ embeds: [client.embedBuilder(client, message.member.user, client.embeds.title, client.language.products.download.replace("<file>", `${productList.products[product].name}`), client.embeds.success_color)], components: [downloadFile], ephemeral: true })
      });
    }).catch((err) => {
      client.utils.sendError(err);
      if(message.type == Discord.InteractionType.ApplicationCommand) {
        message.reply({ embeds: [client.embedBuilder(client, message.member.user, client.embeds.title, client.language.products.error, client.embeds.error_color)], ephemeral: true })
      } else {
        message.channel.send({ embeds: [client.embedBuilder(client, message.author, client.embeds.title, client.language.products.error, client.embeds.error_color)] })
      }
    });
  } else if(productList.products[product].type == "LINK") {
    const row = new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.ButtonBuilder()
        .setStyle(Discord.ButtonStyle.Primary)
        .setLabel(client.language.buttons.link)
        .setEmoji(client.config.emojis.link || {})
        .setCustomId('getLink'),
      );

    if(message.type == Discord.InteractionType.ApplicationCommand) {
      message.reply({ embeds: [client.embedBuilder(client, message.member.user, client.embeds.title, client.language.products.link_get.replace("<link>", `${productList.products[product].name}`), client.embeds.success_color)], components: [row] });
    } else {
      message.channel.send({ embeds: [client.embedBuilder(client, message.member.user, client.embeds.title, client.language.products.link_get.replace("<link>", `${productList.products[product].name}`), client.embeds.success_color)], components: [row] });
    }
    const filter = (interaction) => interaction.customId == 'getLink' && interaction.user.id == message.member.user.id;
    await message.channel.awaitMessageComponent({ filter, componentType: Discord.ComponentType.Button, max: 1 }).then(async (i) => {
      await i.deferUpdate({ ephemeral: true });
      const visitLink = new Discord.ActionRowBuilder()
        .addComponents(
          new Discord.ButtonBuilder()
          .setStyle(Discord.ButtonStyle.Link)
          .setLabel(client.language.buttons.link)
          .setEmoji(client.config.emojis.link || {})
          .setURL(`${productList.products[product].product}`)
        );
      await i.followUp({ embeds: [client.embedBuilder(client, message.member.user, client.embeds.title, client.language.products.link.replace("<link>", `${productList.products[product].name}`), client.embeds.success_color)], components: [visitLink], ephemeral: true })
    });
  }
}

const isTicket = async(client, channel) => {
  const ticketData = await db.get(`ticketData_${channel.id}`);
  return ticketData != null ? true : false;
}

const updateSuggestionEmbed = async (client, interaction) => {
  let suggData = await db.get(`suggestion_${interaction.guild.id}_${interaction.message.id}`);
  let suggChannel = client.utils.findChannel(interaction.guild, client.config.channels.suggestions);
  let decisionChannel = client.utils.findChannel(interaction.guild, client.config.channels.sugg_decision);

  let suggMenu = new Discord.EmbedBuilder()
    .setColor(client.embeds.suggestion.color);

  if(client.embeds.suggestion.title) suggMenu.setTitle(client.embeds.suggestion.title);
  let field = client.embeds.suggestion.fields;
  for (let i = 0; i < client.embeds.suggestion.fields.length; i++) {
    suggMenu.addFields([{ name: field[i].title, value: field[i].description.replace("<author>", `<@!${suggData.author.id}>`)
      .replace("<suggestion>", suggData.text)
      .replace("<yes_vote>", suggData.yes)
      .replace("<no_vote>", suggData.no)
      .replace("<date>", suggData.date) }])
  }

  if(client.embeds.suggestion.footer == true) suggMenu.setFooter({ text: suggData.author.username, iconURL: suggData.author.displayAvatarURL }).setTimestamp();
  if(client.embeds.suggestion.thumbnail == true) suggMenu.setThumbnail(interaction.guild.iconURL());

  if(client.embeds.suggestion.description) suggMenu.setDescription(client.embeds.suggestion.description.replace("<author>", `<@!${suggData.author.id}>`)
    .replace("<suggestion>", suggData.text)
    .replace("<yes_vote>", suggData.yes)
    .replace("<no_vote>", suggData.no)
    .replace("<date>", suggData.date));

  let suggRow = new Discord.ActionRowBuilder().addComponents(
    new Discord.ButtonBuilder()
      .setLabel(client.language.buttons.yes_vote.replace("<count>", suggData.yes))
      .setEmoji(client.config.emojis.yes_emoji || {})
      .setCustomId("vote_yes")
      .setStyle(Discord.ButtonStyle.Primary),
    new Discord.ButtonBuilder()
      .setLabel(client.language.buttons.no_vote.replace("<count>", suggData.no))
      .setEmoji(client.config.emojis.no_emoji || {})
      .setCustomId("vote_no")
      .setStyle(Discord.ButtonStyle.Danger),
    new Discord.ButtonBuilder()
      .setLabel(client.language.buttons.remove_vote)
      .setEmoji(client.config.emojis.remove_vote || {})
      .setCustomId("vote_reset")
      .setStyle(Discord.ButtonStyle.Secondary)
  );

  let decisionRow = new Discord.ActionRowBuilder().addComponents(
    new Discord.StringSelectMenuBuilder()
    .setCustomId("decision_menu")
    .setPlaceholder(client.language.general.suggestions.placeholder)
    .addOptions([{
      label: client.language.general.suggestions.decision.accept,
      value: "decision_accept",
      emoji: client.config.emojis.yes_emoji
      }, {
      label: client.language.general.suggestions.decision.deny,
      value: "decision_deny",
      emoji: client.config.emojis.no_emoji
      }, {
      label: client.language.general.suggestions.decision.delete,
      value: "decision_delete",
      emoji: client.config.emojis.remove_vote
      }])
  );

  let suggMessage = await suggChannel.messages.fetch({ message: interaction.message.id });
  await suggMessage.edit({ embeds: [suggMenu], components: [suggRow] });
  if(client.config.channels.sugg_decision && client.config.general.sugg_decision) {
    let decisionMessage = await decisionChannel.messages.fetch({ message: suggData.decision });
    if(decisionMessage) await decisionMessage.edit({ embeds: [suggMenu], components: [decisionRow] });
  }
}

const deleteUnusedData = async(client) => {
  sendInfo("Deleting unused data from Database");

  let removeChoosing = (await db.all())
    .filter((i) => i.id.startsWith("choosingCategory_")) || [];
  removeChoosing.forEach(async(x) => await db.delete(x.id));

  let ticketList = (await db.all())
    .filter((i) => i.id.startsWith("tickets_")) || [];
  if(ticketList.length > 0) {
    ticketList.forEach((x) => {
      if(x?.value !== "[]") {
        if(typeof x.value == "string") x.value = JSON.parse(x.value);
        x.value.forEach(async(j) => {
          if(!client.channels.cache.get(j.channel)) {
            x.value = x.value.filter((d) => d.channel != j.channel)
            await db.set(x.id, x.value);
          }
        })
      }
    });
  }

  let ticketData = (await db.all())
    .filter((i) => i.id.startsWith("ticketOwner_"));
  let ticketCount = (await db.all())
    .filter((i) => i.id.startsWith("ticket_"));

  sendInfo("Doing some changes to database, this is usual and will take few seconds, don't worry.");

  (await db.all()).forEach(async(x) => {
    if(typeof x.value == "string") {
      if(x?.value?.startsWith("{") || x?.value?.startsWith("[") || x?.value?.startsWith("\"")) {
        try {
          const parseOld = JSON.parse(x.value);
          await db.set(x.id, parseOld)
        } catch(err) { }
      }
    }
  });
    
  ticketCount.forEach(async(x) => {
    let idGuild = x.id.split("_")[1];

    await db.set(`ticketCount_${idGuild}`, parseInt(x.value))
    await db.delete(x.id);
  });

  ticketData.forEach(async(x) => {
    const channelId = x.id.split("_")[1];
    let ticketInfo = await db.get(`ticketData_${channelId}`) || {};
    if(!ticketInfo.owner) ticketInfo.owner = JSON.parse(x.value);
    let openedAt = await db.get(`openedAt_${channelId}`);
    let openedTimestamp = await db.get(`openedTimestamp_${channelId}`);
    if(!ticketInfo.openedAt) ticketInfo.openedAt = openedAt;
    if(!ticketInfo.openedTimestamp) ticketInfo.openedTimestamp = openedTimestamp;
    if(!ticketInfo.id) ticketInfo.id = Math.floor(Math.random() * 19571);

    await db.set(`ticketData_${channelId}`, ticketInfo);
    await db.delete(`openedTimestamp_${channelId}`);
    await db.delete(`openedAt_${channelId}`);
    await db.delete(x.id)
  });

  const openTickets = (await db.all()).filter((i) => i.id.startsWith("ticketData_") || i.id.startsWith("commission_"));
  openTickets.forEach(async(x) => {
    const channelId = x.id.split("_")[1];
    if(!client.channels.cache.get(channelId))
      await db.delete(x.id);
  });
}

const canEditName = async(guild, channel) => {
  let canEdit = true;
  await guild.fetchAuditLogs({ type: Discord.AuditLogEvent.ChannelUpdate }).then((audit) => {
    let aLogs = audit.entries.filter((x) => x.target?.id == channel.id)
      .map((x) => x?.changes.find((c) => c?.key == "name") ? x?.createdTimestamp : undefined).filter(Boolean);
    if(aLogs.length > 0) {
      let passedTen = new Date() - new Date(aLogs[0]);
      if(passedTen > 660_000) canEdit = true;
      else canEdit = false;
    }
  });

  return canEdit;
}

const commissionAccess = (client, channel, guild) => {
  const channelAccess = channel.permissionOverwrites.cache.map((o) => o)
    .filter((r) => r.id != guild.id);

  channelAccess.forEach((a) => {
    if(a.type == OverwriteType.Role) {
      if(!client.config.roles.commission_access.some((r) => findRole(guild, r)?.id == a.id)) {
        channel.permissionOverwrites.delete(a.id);
      }
    }
  });

  client.config.roles.commission_access.forEach((cr) => {
    const findCommAccess = findRole(guild, cr);
    channel.permissionOverwrites.create(findCommAccess, {
      SendMessages: true,
      ViewChannel: true
    });
  });
}

const priceWithTax = (client, basePrice) => {
  if(!client.config.paypal.taxes || client.config.paypal.taxes?.length == 0) return basePrice;
  let appliedTaxes = 0;
  client.config.paypal.taxes.forEach((t) => {
    if(t.type == "NUMBER") {
      appliedTaxes += Number(Number(t.amount).toFixed(2));
    } else if(t.type == "PERCENT") {
      appliedTaxes += Number(((Number(basePrice) * Number(t.amount)) / 100).toFixed(2));
    }
  });

  return basePrice += Number(appliedTaxes.toFixed(2));
}

const getImage = async(url) => {
  return await fetch(url).then(async(res) => {
    const buffer = await res.arrayBuffer();
    const stringifiedBuffer = Buffer.from(buffer).toString("base64");
    const contentType = res.headers.get("content-type");
    return `data:image/${contentType};base64,${stringifiedBuffer}`;
  }).catch(console.log);
}

const replaceFormatting = (guild, text) => {
  return text.replaceAll(/\*\*(.+)\*\*/g, '<b>$1</b>')
    .replaceAll(/\*\*\*(.+)\*\*\*/g, "<i><b>$1</b></i>")
    .replaceAll(/\*(.\n+)\*/g, "<i>$1</i>")
    .replaceAll(/```(.+?)```/gs, (code) => `<div class="codeblock" style="white-space: pre-wrap; font-size: 11px; margin-top: 3px">${code.slice(3, -3)}</div>`)
    .replaceAll(/\n/g, "<br>")
    .replaceAll(/<@[!]?\d{18}>/g, (user) => guild.members.cache.get(user.match(/\d+/) ? user.match(/\d+/)[0] : '')?.user.tag || 'invalid-user')
    .replaceAll(/<@&\d{18}>/g, (role) => guild.roles.cache.get(role.match(/\d+/) ? role.match(/\d+/)[0] : '')?.name || 'deleted-role')
    .replaceAll(/<#\d{18}>/g, (channel) => guild.channels.cache.get(channel.match(/\d+/) ? channel.match(/\d+/)[0] : '')?.name || 'deleted-channel')
    .replaceAll(/<:(.+):(\d+)>/g, (a, b, c) => `<img src="https://cdn.discordapp.com/emojis/${c}.webp?size=96&quality=lossless" width="${(/^<:(.+):(\d+)>$/).test(text) ? "48px" : "22px"}" height="${(/^<:(.+):(\d+)>$/).test(text) ? "48px" : "22px"}">`)
    .replaceAll(/<a:(.+):(\d+)>/g, (a, b, c) => `<img src="https://cdn.discordapp.com/emojis/${c}.gif?size=96&quality=lossless" width="${(/^<a:(.+):(\d+)>$/).test(text) ? "48px" : "22px"}" height="${(/^<a:(.+):(\d+)>$/).test(text) ? "48px" : "22px"}">`);
}

const dashboardFormat = (text) => {
  if(!text) text = "";
  return text.replaceAll(/\*{2}(.*?)\*{2}/g, '<span class="fw-bold">$1</span>');
}

const isUnavailable = async(client) => {
  const timezone = client.config.general.timezone;
  const availability = client.config.general.availability;
  const fetchTimezone = await fetch(`https://timeapi.io/api/Time/current/zone?timeZone=${timezone}`).then((async(res) => await res.json())).catch((err) => console.log(err));
  const early = fetchTimezone.time < availability.split("-")[0];
  const late = fetchTimezone.time > availability.split("-")[1];

  return {
    unavailable: early || late,
    start: availability.split("-")[0],
    end: availability.split("-")[1] 
  }
}

const serverLogs = async(object) => {
  let serverLogs = await db.get(`serverLogs_${config.general.guild}`) || [];
  if(serverLogs.length >= 120) {
    serverLogs = serverLogs.slice(0, 120);
    await db.set(`serverLogs_${config.general.guild}`, serverLogs);
  }

  if(config.server.dashboard.save_logs == true)
    await db.push(`serverLogs_${config.general.guild}`, object);
}

const dashboardLogs = async(object) => {
  let dashboardLogs = await db.get(`dashboardLogs_${config.general.guild}`) || [];
  if(dashboardLogs.length >= 120) {
    dashboardLogs = dashboardLogs.slice(0, 120);
    await db.set(`dashboardLogs_${config.general.guild}`, dashboardLogs);
  }

  if(config.server.dashboard.save_logs == true)
    await db.push(`dashboardLogs_${config.general.guild}`, object);
}

module.exports = {
  formatTime,
  capitalizeFirstLetter,
  commandsList,
  pushReview,
  generateId,
  updateStats,
  sendError,
  findChannel,
  usage,
  findRole,
  channelRoleCheck,
  hasRole,
  ticketUsername,
  sendWarn,
  filesCheck,
  downloadProduct,
  isTicket,
  hasPermissions,
  updateSuggestionEmbed,
  generateTranscript,
  ticketPlaceholders,
  canEditName,
  deleteUnusedData,
  commissionAccess,
  priceWithTax,
  isUnavailable,
  dashboardFormat,
  serverLogs,
  dashboardLogs
}
