const jwt = require("jsonwebtoken");

const authMiddleware = async(req, res, next) => {
  const tokenCookie = req.cookies["token"];
  const decoded = await jwt.decode(tokenCookie);

  const user = req.client.users.cache.get(decoded);
  const client = req.client;
  
  if(user) {
    req.user = user;
    const member = req.guild.members.cache.get(user.id);
    if(!member)
      return res.redirect("/403");
    
    const dashboardAccess = client.config.server.dashboard.users.access || [];
    if(!member.permissions.has("Administrator") && !client.config.roles.dashboard.access.some((r) => member.roles.cache.has(r)) && !dashboardAccess.includes(user.id))
      return res.redirect("/403");

    next();
  } else {
    return res.redirect("/");
  }
}

module.exports = {
  authMiddleware
}