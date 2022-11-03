// https://discord.com/developers/applications/780524769430077440/bot
// https://abal.moe/Eris/
const eris = require('eris');

const globals = require('./globals');
const helpers = require('./helpers');
const commands = require('./commands');

// Create a Client instance with our bot token.
const { BOT_TOKEN } = require('../config.json');
const bot = new eris.Client(BOT_TOKEN);

// When the bot is connected and ready, log to console.
bot.on('ready', async () => {
  await helpers.readMALtokenFromFile();
  await Promise.all([helpers.readUserFile(), helpers.readTagFile()]);

  console.log('\nReady!');
});

// Every time a message is sent anywhere the bot is present,
// this event will fire and we will check if the bot was mentioned.
// If it was, the bot will attempt to respond with "Present".
bot.on('messageCreate', async (msg) => {
  try {
    // Ignore any message from a bot
    if (msg.author.bot) return;

    // Ignore any message that doesn't start with the correct prefix.
    if (!msg.content.startsWith(globals.PREFIX)) return;

    // Extract the parts of the command and the command name
    const parts = msg.content.split(' ').map(s => s.trim()).filter(s => s);
    const commandName = parts[0].substr(globals.PREFIX.length);

    // Get the appropriate handler for the command, if there is one.
    let commandHandler = commands[commandName];
    if (!commandHandler) {
        commandHandler = commands.UNDEFINED;
    }

    // Separate the command arguments from the command prefix and command name.
    const args = parts.slice(1);

    // Execute the command.
    await commandHandler(msg, args);
  } catch (err) {
      console.warn('Error handling command');
      console.warn(err);
  }
});

bot.on('error', err => {
  console.warn(err);
});

bot.connect();