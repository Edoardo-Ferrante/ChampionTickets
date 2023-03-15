const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const FormData = require("form-data");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const yaml = require("yaml");
const { authMiddleware } = require("../middlewares/auth.js");
const { Collection } = require("discord.js");

const standardResponse = (err, html, res) => {
  if (err) {
    console.log(err);
    return res.status(500).render(`dashboard.ejs`, { page : '500', error: err }, (err, html) => standardResponse(null, html, res));
  } else {
    return res.status(200).send(html);
  }
}

const listOfTranscripts = () => {
  const transcripts = fs.readdirSync(`./transcripts`).filter((file) => file.endsWith('.html'))
    .map((file) => file.split("-")[1].replace(".html", "")).sort((a, b) => a - b);

  return transcripts;
}

router.get("/", async (req, res) => {
	const tokenCookie = req.cookies["token"];
  const decoded = await jwt.decode(tokenCookie);

  const user = req.client.users.cache.get(decoded);

	if(user) return res.redirect("/dashboard");
	await res.render("index", {
		bot: req.client,
		guild: req.client,
	})
});

router.get("/403", async(req, res) => {
	await res.render("403", {
		bot: req.client,
		guild: req.client
	})
});

router.get("/404", async(req, res) => {
	await res.render("404", {
		bot: req.client,
		guild: req.client
	})
});

router.get("/dashboard", authMiddleware, async(req, res) => {
	await res.render("dashboard", {
		bot: req.client,
		user: req.user,
		guild: req.guild,
	}, (err, html) => standardResponse(err, html, res));
});

router.get("/ticketing", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.ticketing == false)
		return res.redirect("/dashboard");
	
	await res.render("ticketing", {
		bot: req.client,
		user: req.user,
		guild: req.guild,
		transcripts: listOfTranscripts()
	}, (err, html) => standardResponse(err, html, res));
});

router.get("/ticketing/:id", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.ticketing == false)
		return res.redirect("/dashboard");
	
	const client = req.client;
	const { id } = req.params;
	const channel = client.channels.cache.get(id);

	let messageCollection = new Collection();
  let channelMessages = await channel.messages.fetch({ limit: 100 });

	messageCollection = messageCollection.concat(channelMessages);

  while(channelMessages.size === 100) {
    let lastMessageId = channelMessages.lastKey();
    channelMessages = await channel.messages.fetch({ limit: 100, before: lastMessageId });
    if(channelMessages) messageCollection = messageCollection.concat(channelMessages);
  }

  let msgs = [...messageCollection.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp)

	let ticketView = await client.utils.generateTranscript(channel, msgs, "-1", false);

	ticketView += `
		<head>
			<title>Champion Tickets - View Ticket</title>
		</head>
	`;

	res.send(ticketView);
});

router.post("/ticketing/:id/close", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.ticketing == false)
		return res.redirect("/dashboard");
	
	const client = req.client;
	const { id } = req.params;
	const ticketData = await client.db.get(`ticketData_${id}`);

	const channel = client.channels.cache.get(id);

	let messageCollection = new Collection();
  let channelMessages = await channel.messages.fetch({ limit: 100 });

	messageCollection = messageCollection.concat(channelMessages);

  while(channelMessages.size === 100) {
    let lastMessageId = channelMessages.lastKey();
    channelMessages = await channel.messages.fetch({ limit: 100, before: lastMessageId });
    if(channelMessages) messageCollection = messageCollection.concat(channelMessages);
  }
  
  let msgs = [...messageCollection.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp)

	if(client.config.general.transcripts == true && client.config.general.transcript_type == "HTML") {
		await client.utils.generateTranscript(channel, msgs, ticketData.id).then(async() => {
			await channel.delete();
		});
	} else {
		await channel.delete();
	}

	if (client.config.server.selfhost.enabled == true) {
		let transcriptCode = (Math.random() * 466567).toString(36).slice(-7).replace(".", "");
		let randomIdCase = Math.floor(Math.random() * 1000);
		await client.db.set(`transcript_${ticketData?.id || randomIdCase}`, transcriptCode);
	}

	await client.utils.dashboardLogs({
		date: new Date().toLocaleString("en-GB"),
		author: `${req.user.username}#${req.user.discriminator}`,
		user: null,
		channel_id: `${channel.id}`,
		channel_name: `${channel.name}`,
		ticketId: ticketData.id,
		message: `dash_ticket_del`
	});

	res.status(200).redirect("/ticketing");
});

router.get("/settings", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.settings.enabled == false)
		return res.redirect("/dashboard");

	const { categoryId, isNew } = req.query;
	const noSubFilter = req.client.categories.filter((c) => c.type != "SUBCATEGORY_PARENT");
	let category = noSubFilter[categoryId || 0];
	let categoryRoles;

	if(!category) 
		category = noSubFilter[0];

	let duplicate;
	if(isNew == 1) {
		duplicate = JSON.parse(JSON.stringify(category));
		duplicate["id"] = `copy_${duplicate["id"]}`;
		duplicate["name"] = `Copy of ${duplicate["name"]}`;
	}

	if(category) categoryRoles = category.roles.map((r) => req.client.utils.findRole(req.guild, r)?.id).filter(Boolean);

	const commandList = Object.keys(req.client.cmdConfig);
	await res.render("settings", {
		bot: req.client,
		user: req.user,
		guild: req.guild,
		commands: commandList.sort(),
		category: isNew == 1 ? duplicate : category,
		categoryRoles,
		inCloned: isNew == 1 ? true : false
	}, (err, html) => standardResponse(err, html, res));
});

router.patch("/settings/config/:option", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.settings.enabled == false)
		return res.redirect("/dashboard");

	const { option } = req.params;
	const { value, section, boolean } = JSON.parse(req.body.configData);
	const client = req.client;

	const path = `${section}.${option}`

	await client.utils.dashboardLogs({
    date: new Date().toLocaleString("en-GB"),
    author_id: req.user.id,
    author: req.user.tag,
    user_id: null,
    user: null,
    channel_id: null,
    channel_name: null,
    option: `${path}`,
		value: null,
    message: `dash_edit_cfg`
  });

	if(typeof path.split(".").reduce((o, key) => o && o[key] ? o[key] : null, client.config) == "number")
		value = Number(value);

	let doc = await yaml.parseDocument(fs.readFileSync('./configs/config.yml', 'utf8'));
	if(value) {
		if(path.split(".").reduce((o, key) => o && o[key] ? o[key] : null, client.config) == value)
			return res.status(200).json({ code: 444 });

		await doc.setIn(`${path}`.split("."), value);
	} else if(!value && boolean == true) {
		await doc.setIn(`${path}`.split("."), !path.split(".").reduce((o, key) => o && o[key] ? o[key] : null, client.config));
	} else {
		if(path.split(".").reduce((o, key) => o && o[key] ? o[key] : null, client.config) == "")
			return res.status(200).json({ code: 444 });

		await doc.setIn(`${path}`.split("."), "");
	}

	const file = fs.createWriteStream('./configs/config.yml');
	file.write(doc.toString({ lineWidth: 100000, doubleQuotedAsJSON: true })
		.replaceAll(/(\[ )/gm, "[")
		.replaceAll(/( ])$/gm, "]"));
	req.client.config = doc.toJSON();

	res.status(200).json({ code: 200 });
});

router.patch("/settings/config/:category/category", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.settings.enabled == false)
		return res.redirect("/dashboard");
		
	const { category } = req.params;
	const data = req.body;
	const client = req.client;

	let doc = yaml.parseDocument(fs.readFileSync('./configs/categories.yml', 'utf8'));

	const categoryData = JSON.parse(data.categoryData);
	const keys = Object.keys(categoryData);

	const currentCategory = client.categories.find((x) => x.id == category);
	const currentIndex = client.categories.indexOf(currentCategory);
 	if(currentIndex == -1) {
		for(const key of keys) {
			const keyValue = categoryData[key];
			doc.setIn(`${client.categories.length}.${key}`.split("."), keyValue);
		}
	} else {
		 for(const key of keys) {
			const keyValue = categoryData[key];
			doc.setIn(`${currentIndex}.${key}`.split("."), keyValue);
		}
	}

	const file = fs.createWriteStream('./configs/categories.yml');
	file.write(doc.toString({ lineWidth: 100000, doubleQuotedAsJSON: true, singleQuote: false, defaultStringType: "QUOTE_DOUBLE", defaultKeyType: "PLAIN" })
		.replaceAll(/(\[ )/gm, "[")
		.replaceAll(/( ])$/gm, "]"));
	req.client.categories = doc.toJSON();

	res.status(200).json({ code: 200 });
});

router.delete("/settings/config/:category/category", async(req, res) => {
	if(req.client.config.server.dashboard.modules.settings.enabled == false)
		return res.redirect("/dashboard");
	
	const { category } = req.params;
	const client = req.client;

	const doc = yaml.parseDocument(fs.readFileSync('./configs/categories.yml', 'utf8'));
	const catIndex = client.categories.findIndex((i) => i.id == category);

	doc.deleteIn(`${catIndex}`.split("."));

	const file = fs.createWriteStream('./configs/categories.yml');
	file.write(doc.toString({ lineWidth: 100000, doubleQuotedAsJSON: true, singleQuote: false, defaultStringType: "QUOTE_DOUBLE", defaultKeyType: "PLAIN" })
		.replaceAll(/(\[ )/gm, "[")
		.replaceAll(/( ])$/gm, "]"));
	req.client.categories = doc.toJSON();

	res.status(200).json({ code: 200 });
})

router.patch("/settings/commands/:name", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.settings.enabled == false)
		return res.redirect("/dashboard");

	const { name } = req.params;
	const client = req.client;

	await client.utils.dashboardLogs({
		date: new Date().toLocaleString("en-GB"),
		author_id: req.user.id,
		author: `${req.user.username}#${req.user.discriminator}`,
		user_id: req.user.id,
		user: req.user.tag,
		channel_id: null,
		channel_name: null,
		ticketId: null,
    option: `${name}`,
    value: client.cmdConfig[name].enabled ? "off" : "on",
		message: `dash_toggle_cmd`
	});

	let doc = yaml.parseDocument(fs.readFileSync('./configs/commands.yml', 'utf8'));
	doc.setIn(`${name}.enabled`.split("."), !client.cmdConfig[name].enabled);

	const file = fs.createWriteStream('./configs/commands.yml');
	file.write(doc.toString({ lineWidth: 100000, doubleQuotedAsJSON: true })
		.replaceAll(/(\[ )/gm, "[")
		.replaceAll(/( ])$/gm, "]"));
	req.client.cmdConfig = doc.toJSON();

	res.status(200).json({ code: 200 });
});

router.post("/settings/balance/reset", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.settings.enabled == false)
		return res.redirect("/dashboard");

	const data = req.body;
	const client = req.client;

	const balance = await client.db.get(`balance_${data.user}`);
	if(balance)
		await client.db.delete(`balance_${data.user}`);
	
	res.status(200).json({ code: 200 });
});

router.post("/settings/balance", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.settings.enabled == false)
		return res.redirect("/dashboard");

	const data = req.body;
	const client = req.client;

	const user = client.users.cache.get(Object.keys(data)[0]);

	await client.db.set(`balance_${Object.keys(data)[0]}`, Number(Object.values(data)[0]));

	await client.utils.dashboardLogs({
		date: new Date().toLocaleString("en-GB"),
		author_id: req.user.id,
		author: `${req.user.username}#${req.user.discriminator}`,
		user_id: user.id,
		user: user.tag,
		channel_id: null,
		channel_name: null,
		ticketId: null,
		amount: Number(Object.values(data)[0]),
		message: `dash_balance_change`
	});

	res.status(200).redirect("/settings")
});

router.post("/settings/users/:option", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.settings.enabled == false)
		return res.redirect("/dashboard");

	const data = req.body;
	const { option } = req.params;
	const userId = Object.values(data)[0];
	const client = req.client;
	const user = client.users.cache.get(userId);

	if(!user)
		return res.status(404).redirect("/settings");

	let doc = await yaml.parseDocument(fs.readFileSync('./configs/config.yml', 'utf8'));
	if(client.config.server.dashboard.users[option].includes(userId)) {
		await doc.setIn(`server.dashboard.users.${option}`.split("."), client.config.server.dashboard.users[option].filter((v) => v != userId));
		await client.utils.dashboardLogs({
      date: new Date().toLocaleString("en-GB"),
			author_id: req.user.id,
      author: `${req.user.username}#${req.user.discriminator}`,
			user_id: user.id,
      user: user.tag,
      channel_id: null,
      channel_name: null,
      ticketId: null,
      message: `dash_removed`
    });
	} else {
		await doc.addIn(`server.dashboard.users.${option}`.split("."), userId);
		await client.utils.dashboardLogs({
      date: new Date().toLocaleString("en-GB"),
			author_id: req.user.id,
      author: `${req.user.username}#${req.user.discriminator}`,
			user_id: user.id,
      user: user.tag,
      channel_id: null,
      channel_name: null,
      ticketId: null,
      message: `dash_added`
    });
	}

	const file = fs.createWriteStream('./configs/config.yml');
	file.write(doc.toString({ lineWidth: 100000, doubleQuotedAsJSON: true })
		.replaceAll(/(\[ )/gm, "[")
		.replaceAll(/( ])$/gm, "]"));
	req.client.config = doc.toJSON();

	res.status(200).redirect("/settings");
});

router.get("/logs", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.logs == false)
		return res.redirect("/dashboard");

	await res.render("logs", {
		bot: req.client,
		user: req.user,
		guild: req.guild,
	}, (err, html) => standardResponse(err, html, res));
});

router.get("/profile", authMiddleware, async(req, res) => {
	await res.render("profile", {
		bot: req.client,
		user: req.user,
		guild: req.guild,
	}, (err, html) => standardResponse(err, html, res));
});

router.get("/invoicing", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.invoicing == false)
		return res.redirect("/dashboard");
	if(!req.client.config.paypal.secret || !req.client.config.paypal.client_id)
		return res.redirect("/dashboard");
	
	const filter = req.query.filter;
	const searchQuery = {
    page: 0,
    page_size: 100,
    total_count_required: true,
		status: ["UNPAID","PAID","MARKED_AS_PAID","CANCELLED","REFUNDED"]
	};

	const invoices = new Promise((res, rej) => {
		req.client.paypal.invoice.search(searchQuery, (err, data) => {
			if(err) {
				console.log(err)
				rej([])
			};
			res(data?.invoices || []);
		})
	});

	let filterData = await invoices;

	if(filter == "1")
		filterData = filterData.filter((x) => x.status == "PAID");
	else if(filter == "2")
		filterData = filterData.filter((x) => x.status == "UNPAID");
	else if(filter == "3")
		filterData = filterData.filter((x) => x.status == "MARKED_AS_PAID");
	else if(filter == "4")
		filterData = filterData.filter((x) => x.status == "CANCELLED");

	await res.render("invoicing", {
		bot: req.client,
		user: req.user,
		guild: req.guild,
		invoices: filterData
	})
});

router.post("/invoicing/:id/cancel", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.invoicing == false)
		return res.redirect("/dashboard");

	const { id } = req.params;
	const client = req.client;

	const options = {
		subject: `Cancelled from Dashboard by ${req.user.tag}`,
		send_to_merchant: false,
		send_to_payer: false
	}

	client.paypal.invoice.cancel(id, options, async(error, data) => {
		res.status(200).json({ code: 200 });
	});
})

router.post("/profile/edit", authMiddleware, async(req, res) => {
	const client = req.client;
	const user = req.user;
	const body = req.body;

	let hours = await client.db.get(`availableHours_${user.id}`);
	let paypal = await client.db.get(`paypal_${user.id}`);
	let bio = await client.db.get(`bio_${client.config.general.guild}_${user.id}`);
	let portfolio = await client.db.get(`portfolio_${user.id}`);

	if(body.hours != hours) {
		if(body.hours == "" || !body.hours) await client.db.delete(`availableHours_${user.id}`);
		else await client.db.set(`availableHours_${user.id}`, body.hours);
	} 
	if(body.paypal != paypal) {
		if(body.paypal == "" || !body.paypal) await client.db.delete(`paypal_${user.id}`);
		else await client.db.set(`paypal_${user.id}`, body.paypal);
	} 
	if(body.bio != bio) {
		if(body.bio == "" || !body.bio) await client.db.delete(`bio_${client.config.general.guild}_${user.id}`);
		else await client.db.set(`bio_${client.config.general.guild}_${user.id}`, body.bio);
	} 
	if(body.portfolio != portfolio) {
		if(body.portfolio == "" || !body.portfolio) await client.db.delete(`portfolio_${user.id}`);
		else {
			if(/(https?:\/\/)?([^\s]+)?[^\s]+\.[^\s]+/.test(body.portfolio) == true) {
				await client.db.set(`portfolio_${user.id}`, body.portfolio);
			}
		}
	}

	res.status(200).json({ code: 200 });
})

router.get("/logout", authMiddleware, async(req, res) => {
	const client = req.client;
	await client.utils.dashboardLogs({
		date: new Date().toLocaleString("en-GB"),
		author_id: req.user.id,
		author: `${req.user.username}#${req.user.discriminator}`,
		user_id: null,
		user: null,
		channel_id: null,
		channel_name: null,
		ticketId: null,
		message: `dash_logout`
	});
	
  res.clearCookie("token");
  res.redirect("/");
});

router.get("/callback", async(req, res) => {
  if (req.user) return res.redirect("/dashboard");
  
  const accessCode = req.query.code;
  if (!accessCode) return res.redirect("/");

  const client = req.client;

  const data = new FormData();
  data.append("client_id", client.config.server.dashboard.client_id);
  data.append("client_secret", client.config.server.dashboard.client_secret);
  data.append("grant_type", "authorization_code");
  data.append("redirect_uri", client.config.server.url + "/callback");
  data.append("scope", "identify guilds");
  data.append("code", accessCode);
  
  let response = await fetch("https://discordapp.com/api/oauth2/token", {
    method: "POST",
    body: data
  })

  const bearerTokens = await response.json();

  response = await fetch("https://discordapp.com/api/users/@me", {
    method: "GET",
    headers: { Authorization: `Bearer ${bearerTokens.access_token}` }
  });

  let json = await response.json();
	
  const member = req.guild.members.cache.get(json.id);
	if(!member)
		return res.redirect("/403");
	
	const dashboardAccess = client.config.server.dashboard.users.access || [];
  if(member.id != req.guild.ownerId && !client.config.roles.dashboard.access.some((r) => member.roles.cache.has(r)) && !dashboardAccess.includes(json.id))
    return res.redirect("/403");

  const token = await jwt.sign(`${json.id}`, client.config.server.dashboard.jwt);

  res.cookie("token", token, {
    expires: new Date(Date.now()+2.592e+8)
  });

  req.user = client.users.cache.get(json.id);

  await client.utils.dashboardLogs({
		date: new Date().toLocaleString("en-GB"),
		author_id: json.id,
		author: `${json.username}#${json.discriminator}`,
		user_id: null,
		user: null,
		channel_id: null,
		channel_name: null,
		ticketId: null,
		message: `dash_login`
	});

  res.redirect("/dashboard");
});

module.exports = router;