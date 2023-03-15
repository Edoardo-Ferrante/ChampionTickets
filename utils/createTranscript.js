const Discord = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();
const fs = require("fs");
const { generateTranscript } = require("./utils.js");

const htmlTranscript = async (client, channel, member, reason) => {
  let config = client.config;
  let ticketData = await db.get(`ticketData_${channel.id}`);
  let messageCollection = new Discord.Collection();
  let channelMessages = await channel.messages.fetch({ limit: 100 });

  let randomIdCase = Math.floor(Math.random() * 1000);

  messageCollection = messageCollection.concat(channelMessages);

  while(channelMessages.size === 100) {
    let lastMessageId = channelMessages.lastKey();
    channelMessages = await channel.messages.fetch({ limit: 100, before: lastMessageId });
    if(channelMessages) messageCollection = messageCollection.concat(channelMessages);
  }
  
  let msgs = [...messageCollection.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp)
  let data = await fs.readFileSync('./data/template.html', {
    encoding: 'utf-8'
  });
  if(data) {
    await generateTranscript(channel, msgs, ticketData?.id || randomIdCase)
    let path = `./transcripts/ticket-${ticketData?.id || randomIdCase}.html`;
    
    if (config.server.selfhost.enabled == true) {
      let transcriptCode = (Math.random() * 466567).toString(36).slice(-7).replace(".", "");
      await db.set(`transcript_${ticketData?.id || randomIdCase}`, transcriptCode);
    }
    let transcriptAccess = await db.get(`transcript_${ticketData?.id || randomIdCase}`) || "N/A";
    
    const ticketCategory = client.categories.find((x) => x.id == ticketData?.category)?.name || "N/A";

    let logEmbed = new Discord.EmbedBuilder()
      .setColor(client.embeds.transcriptLog.color);

    if (client.embeds.transcriptLog.title) logEmbed.setTitle(client.embeds.transcriptLog.title);
    let field = client.embeds.transcriptLog.fields;
    for (let i = 0; i < client.embeds.transcriptLog.fields.length; i++) {
      logEmbed.addFields([{ name: field[i].title, value: field[i].description.replace("<closedBy>", member.user)
        .replace("<ticketId>", `${ticketData?.id || randomIdCase}`)
        .replace("<author>", `<@${ticketData?.owner}>`)
        .replace("<channelId>", channel.id)
        .replace("<reason>", reason)
        .replace("<category>", ticketCategory)
        .replace("<channelName>", channel.name)
        .replace("<transcriptCode>", transcriptAccess)
        .replace("<openedAt>", `<t:${Math.round(ticketData?.openedTimestamp/1000)}:F>`)
        .replace("<closedAt>", `<t:${Math.round(new Date().getTime()/1000)}:F>`) }])
    }

    if (client.embeds.transcriptLog.footer == true) logEmbed.setFooter({ text: member.user.username, iconURL: member.user.displayAvatarURL() }).setTimestamp();
    if (client.embeds.transcriptLog.thumbnail == true) logEmbed.setThumbnail(member.user.displayAvatarURL());

    if (client.embeds.transcriptLog.description) logEmbed.setDescription(client.embeds.transcriptLog.description.replace("<closedBy>", member.user)
      .replace("<ticketId>", `${ticketData?.id || randomIdCase}`)
      .replace("<author>", `<@${ticketData?.owner}>`)
      .replace("<reason>", reason)
      .replace("<category>", ticketCategory)
      .replace("<channelId>", channel.id)
      .replace("<channelName>", channel.name)
      .replace("<transcriptCode>", transcriptAccess)
      .replace("<openedAt>", `<t:${Math.round(ticketData?.openedTimestamp/1000)}:F>`)
      .replace("<closedAt>", `<t:${Math.round(new Date().getTime()/1000)}:F>`));
    
    let serverUrl = client.config.server.url || "http://localhost";
    let bttnRow = new Discord.ActionRowBuilder();
    
    let dwnButton = new Discord.ButtonBuilder()
      .setURL(serverUrl + `/transcripts/${ticketData?.id || randomIdCase}/download`)
      .setLabel(client.language.buttons.transcripts.download)
      .setStyle(Discord.ButtonStyle.Link)
      .setEmoji(client.config.emojis.transcripts.download || {});
    let viewButton = new Discord.ButtonBuilder()
      .setURL(serverUrl + `/transcripts/${ticketData?.id || randomIdCase}`)
      .setLabel(client.language.buttons.transcripts.view)
      .setStyle(Discord.ButtonStyle.Link)
      .setEmoji(client.config.emojis.transcripts.view || {});
    
    if(client.config.server.selfhost.download == true && client.config.server.enabled == true) bttnRow.addComponents(dwnButton);
    if(client.config.server.selfhost.view == true && client.config.server.enabled == true) bttnRow.addComponents(viewButton);

    let sendObject = {
      embeds: [logEmbed],
      files: client.config.server.selfhost.download == false ? [path] : [],
      components: bttnRow.components.length > 0 ? [bttnRow] : []
    }

    let aChannel = client.utils.findChannel(member.guild, config.channels.transcripts);
    if(aChannel) aChannel.send(sendObject).then(() => {
      setTimeout(async() => {
        if(channel) await channel.delete();
      }, client.config.general.delete_after * 1000);
    }); 

    if(config.general.dm_transcript == true) {
      let dmEmbed = new Discord.EmbedBuilder()
        .setColor(client.embeds.dmTranscript.color);

      if(client.embeds.dmTranscript.title) dmEmbed.setTitle(client.embeds.dmTranscript.title);
      let field = client.embeds.dmTranscript.fields;
      for(let i = 0; i < client.embeds.dmTranscript.fields.length; i++) {
        dmEmbed.addFields([{ name: field[i].title, value: field[i].description.replace("<closedBy>", member.user)
          .replace("<ticketId>", `${ticketData?.id || randomIdCase}`)
          .replace("<author>", `<@${ticketData?.owner}>`)
          .replace("<reason>", reason)
          .replace("<category>", ticketCategory)
          .replace("<channelId>", channel.id)
          .replace("<channelName>", channel.name)
          .replace("<transcriptCode>", transcriptAccess)
          .replace("<openedAt>", `<t:${Math.round(ticketData?.openedTimestamp/1000)}:F>`)
          .replace("<closedAt>", `<t:${Math.round(new Date().getTime()/1000)}:F>`) }])
      }
      
      if(client.embeds.dmTranscript.footer == true) dmEmbed.setFooter({ text: member.user.username, iconURL: member.user.displayAvatarURL() }).setTimestamp();
      if(client.embeds.dmTranscript.thumbnail == true) dmEmbed.setThumbnail(member.user.displayAvatarURL());

      if(client.embeds.dmTranscript.description) dmEmbed.setDescription(client.embeds.dmTranscript.description.replace("<closedBy>", member.user)
        .replace("<ticketId>", `${ticketData?.id || randomIdCase}`)
        .replace("<author>", `<@${ticketData?.owner}>`)
        .replace("<reason>", reason)
        .replace("<category>", ticketCategory)
        .replace("<channelId>", channel.id)
        .replace("<channelName>", channel.name)
        .replace("<transcriptCode>", transcriptAccess)
        .replace("<openedAt>", `<t:${Math.round(ticketData?.openedTimestamp/1000)}:F>`)
        .replace("<closedAt>", `<t:${Math.round(new Date().getTime()/1000)}:F>`));

      let supportDM = await db.get(`ticketClaimed_${channel.id}`);
      let authorDM = client.users.cache.get(ticketData?.owner);
      supportDM = client.users.cache.get(supportDM);

      sendObject.embeds = [dmEmbed];
      if(authorDM != undefined) {
        authorDM.send(sendObject).catch((err) => {
          console.error("Author's DM Closed");
        });
      }
      if(supportDM != undefined && supportDM != authorDM) {
        supportDM.send(sendObject).catch((err) => {
          console.error("Support's DM Closed");
        });
      }
    };
  }
}

const textTranscript = async (client, channel, member, reason) => {
  let config = client.config;
  let ticketData = await db.get(`ticketData_${channel.id}`);

  let randomIdCase = Math.floor(Math.random() * 1000);

  let write = fs.createWriteStream(`transcripts/ticket-${ticketData?.id || randomIdCase}.txt`);
  channel.messages.fetch({ limit: 100 }).then(async(messages) => {
    let messages2 = messages;
    let me = messages2.sort((b, a) => b.createdTimestamp - a.createdTimestamp);

    me.forEach((msg) => {
      const time = msg.createdAt.toLocaleString("en-GB");
      write.write(`[${time}] ${msg.author.tag}: ${msg.content}\n`);
    });
    write.end();
    
    if (config.server.selfhost.enabled == true) {
      let transcriptCode = (Math.random() * 466567).toString(36).slice(-7).replace(".", "");
      await db.set(`transcript_${ticketData?.id || randomIdCase}`, transcriptCode);
    }
    let transcriptAccess = await db.get(`transcript_${ticketData?.id || randomIdCase}`) || 'N/A';
    
    let logEmbed = new Discord.EmbedBuilder()
      .setColor(client.embeds.transcriptLog.color);

    if (client.embeds.transcriptLog.title) logEmbed.setTitle(client.embeds.transcriptLog.title);
    let field = client.embeds.transcriptLog.fields;
    for (let i = 0; i < client.embeds.transcriptLog.fields.length; i++) {
      logEmbed.addFields([{ name: field[i].title, value: field[i].description.replace("<closedBy>", member.user)
        .replace("<ticketId>", `${ticketData?.id || randomIdCase}`)
        .replace("<author>", `<@${ticketData?.owner}>`)
        .replace("<reason>", reason)
        .replace("<channelId>", channel.id)
        .replace("<channelName>", channel.name)
        .replace("<transcriptCode>", transcriptAccess)
        .replace("<openedAt>", `<t:${Math.round(ticketData?.openedTimestamp/1000)}:F>`)
        .replace("<closedAt>", `<t:${Math.round(new Date().getTime()/1000)}:F>`) }])
    }

    if (client.embeds.transcriptLog.footer == true) logEmbed.setFooter({ text: member.user.username, iconURL: member.user.displayAvatarURL() }).setTimestamp();
    if (client.embeds.transcriptLog.thumbnail == true) logEmbed.setThumbnail(member.user.displayAvatarURL());

    if (client.embeds.transcriptLog.description) logEmbed.setDescription(client.embeds.transcriptLog.description.replace("<closedBy>", member.user)
      .replace("<ticketId>", `${ticketData?.id || randomIdCase}`)
      .replace("<author>", `<@${ticketData?.owner}>`)
      .replace("<reason>", reason)
      .replace("<channelId>", channel.id)
      .replace("<channelName>", channel.name)
      .replace("<transcriptCode>", transcriptAccess)
      .replace("<openedAt>", `<t:${Math.round(ticketData?.openedTimestamp/1000)}:F>`)
      .replace("<closedAt>", `<t:${Math.round(new Date().getTime()/1000)}:F>`));
    
    let aChannel = client.utils.findChannel(channel.guild, config.channels.transcripts);
    if(aChannel) aChannel.send({ embeds: [logEmbed], files: [`transcripts/ticket-${ticketData?.id || randomIdCase}.txt`] }).then(() => {
      setTimeout(async() => {
        if(channel) await channel.delete();
      }, client.config.general.delete_after * 1000);
    }); 

    if(config.general.dm_transcript == true) {
      let dmEmbed = new Discord.EmbedBuilder()
        .setColor(client.embeds.dmTranscript.color);

      if(client.embeds.dmTranscript.title) dmEmbed.setTitle(client.embeds.dmTranscript.title);
      let field = client.embeds.dmTranscript.fields;
      for(let i = 0; i < client.embeds.dmTranscript.fields.length; i++) {
        dmEmbed.addFields([{ name: field[i].title, value: field[i].description.replace("<closedBy>", member.user)
          .replace("<ticketId>", `${ticketData?.id || randomIdCase}`)
          .replace("<author>", `<@${ticketData?.owner}>`)
          .replace("<reason>", reason)
          .replace("<channelId>", channel.id)
          .replace("<channelName>", channel.name)
          .replace("<transcriptCode>", transcriptAccess)
          .replace("<openedAt>", `<t:${Math.round(ticketData?.openedTimestamp/1000)}:F>`)
          .replace("<closedAt>", `<t:${Math.round(new Date().getTime()/1000)}:F>`) }])
      }
      
      if(client.embeds.dmTranscript.footer == true) dmEmbed.setFooter({ text: member.user.username, iconURL: member.user.displayAvatarURL() }).setTimestamp();
      if(client.embeds.dmTranscript.thumbnail == true) dmEmbed.setThumbnail(member.user.displayAvatarURL());

      if(client.embeds.dmTranscript.description) dmEmbed.setDescription(client.embeds.dmTranscript.description.replace("<closedBy>", member.user)
        .replace("<ticketId>", `${ticketData?.id || randomIdCase}`)
        .replace("<author>", `<@${ticketData?.owner}>`)
        .replace("<reason>", reason)
        .replace("<channelId>", channel.id)
        .replace("<channelName>", channel.name)
        .replace("<transcriptCode>", transcriptAccess)
        .replace("<openedAt>", `<t:${Math.round(ticketData?.openedTimestamp/1000)}:F>`)
        .replace("<closedAt>", `<t:${Math.round(new Date().getTime()/1000)}:F>`));

      let supportDM = await db.get(`ticketClaimed_${channel.id}`);
      let authorDM = client.users.cache.get(ticketData?.owner);
      supportDM = client.users.cache.get(supportDM);
      if(authorDM != undefined) {
        authorDM.send({ embeds: [dmEmbed], files: [`transcripts/ticket-${ticketData?.id || randomIdCase}.txt`] }).catch((err) => {
          console.error("Author's DM Closed");
        });
      }
      if(supportDM != undefined && supportDM != authorDM) {
        supportDM.send({ embeds: [dmEmbed], files: [`transcripts/ticket-${ticketData?.id || randomIdCase}.txt`] }).catch((err) => {
          console.error("Support's DM Closed");
        });
      }
    };
    
    let transcriptCode = (Math.random() * 466567).toString(36).slice(-7).replace(".", "");
    await db.set(`transcript_${ticketData?.id || randomIdCase}`, transcriptCode);
  });
}

module.exports = {
  htmlTranscript,
  textTranscript,
}
