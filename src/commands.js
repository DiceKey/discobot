const globals = require('./globals');
const helpers = require('./helpers');

module.exports = {

  /* HELP */
  help: (msg, args) => {
    const newMsg = {
      content: globals.HELPST,
      messageReference: {messageID: msg.id}
    };

    return msg.channel.createMessage(newMsg);
  },
  UNDEFINED: (msg, args) => {
    const newMsg = {
      content: `**<E>** Invalid command name\n${globals.HELPST}`,
      messageReference: {messageID: msg.id}
    };

    return msg.channel.createMessage(newMsg);
  },

  /* ADD USER-LIST */
  add: async (msg, args) => {
    let alias = args[0];
    let username = args[1];

    let msgContents;
    if ( alias === undefined ) {
      msgContents = `**<E>** arg ALIAS undefined`;
    } else if ( username === undefined ) {
      msgContents = `**<E>** arg USERNAME undefined`;
    } else {
      alias = alias.toLowerCase();
      globals.userMap[alias] = {username: username, list: []};
      helpers.queryUserList(alias, username, true);
      helpers.writeUserFile();
      msgContents = `added user { ${alias}: <https://myanimelist.net/profile/${username}> }`;
    }

    const newMsg = {
      content: msgContents,
      messageReference: {messageID: msg.id}
    };

    return msg.channel.createMessage(newMsg);
  },

  /* SHOW ALL USER-LISTS */
  users: (msg, args) => {
    let msgContents = "";
    Object.entries(globals.userMap).forEach( userEntry => {
      let [alias, userObj] = userEntry;
      if (msgContents !== "") {
        msgContents += "\n";
      }
      alias = alias.charAt(0).toUpperCase() + alias.slice(1);
      const avg = Math.round(userObj.avg*100)/100;
      msgContents += `${alias} (avg ${avg}): <https://myanimelist.net/profile/${userObj.username}>`;
    });
    if ( msgContents === "" ) {
      msgContents = "**<I>** User list is empty";
    }

    const newMsg = {
      content: msgContents,
      messageReference: {messageID: msg.id}
    };

    return msg.channel.createMessage(newMsg);
  },

  /* GET ONE USER-LIST */
  get: (msg, args) => {
    let alias = args[0];
    let msgContents;

    if ( alias === undefined ) {
      msgContents = `**<E>** arg ALIAS undefined`;
    } else {
      alias = alias.toLowerCase();
      const userObj = globals.userMap[alias];
      if ( userObj )
        msgContents = `<https://myanimelist.net/profile/${userObj.username}>`;
      else
        msgContents = `user ${alias} not found`;
    }

    const newMsg = {
      content: msgContents,
      messageReference: {messageID: msg.id}
    };

    return msg.channel.createMessage(newMsg);
  },

  /* GET TAGS */
  tags: (msg, args) => {
    const NUMOFCOLS = 4;
    const tagList = [];
    let msgContents = "";
    Object.entries(globals.tagMap).forEach( tagEntry => {
      let [tagName, tagArr] = tagEntry;
      tagList.push( `${tagName}: ${tagArr.length}` );
      //tagList.push({name: tagName, size: tagArr.length});
    });

    if (tagList.length == 0) {
      msgContents = "**<I>** Tag list is empty";
    } else {
      const columns = [];
      const columnSizes = [];
      for ( let i = 0; i < NUMOFCOLS; i++ ) {
        columns.push([]);
        columnSizes.push(0);
      }

      tagList.sort( function(a,b){ return a.localeCompare(b) } );
      //tagList.sort( function(a,b){ return a.name.localeCompare(b.name) } );
      //tagList.sort( function(a,b){ return b.size - a.size } );
      for ( let i = 0; i < tagList.length; i++ ) {
        const colNum = i%NUMOFCOLS;
        const thisTag = tagList[i]
        columns[colNum].push(thisTag);
        columnSizes[colNum] = Math.max(columnSizes[colNum], thisTag.length);
      }
      //console.log(columns);

      msgContents = "```\n";

      /*
      // linebreak
      msgContents += "+";
      for ( let i = 0; i < columnSizes.length; i++ ) {
        msgContents += helpers.getTblFmtBrk( columnSizes[i] );
      }
      */

      for ( let j = 0; j < columns[0].length; j++ ) {
        msgContents += "\n|";
        for ( let i = 0; i < NUMOFCOLS; i++ ) {
          if ( j >= columns[i].length ) {
            msgContents += helpers.getTblFmtStr( '', columnSizes[i], 'l' );
          } else {
            msgContents += helpers.getTblFmtStr( columns[i][j], columnSizes[i], 'l' );
          }
        }
      }

      msgContents += "```";
    }

    const newMsg = {
      content: msgContents,
      messageReference: {messageID: msg.id}
    };

    return msg.channel.createMessage(newMsg);
  },

  /* GET RECS */
  rec: (msg, args) => {
    let showComp = false;
    let msgContents = "";

    let userAlias = undefined;
    const tagList = [];
    for ( const arg of args ) {
      if ( arg === "--c" ) {
        showComp = true;
      } else {
        const temp = arg.toLowerCase();
        if ( userAlias === undefined && tagList.length == 0 && globals.userMap[temp] ) {
          userAlias = temp;
        } else if ( globals.tagMap[temp] ) {
          tagList.push(temp);
        } else {
          msgContents += `**<E>** User/Tag unrecognized: ${temp}\n`
        }
      }
    }

    const mediaList = helpers.getRecs(userAlias, tagList);

    const aliasList = [];
    if ( userAlias !== undefined )
      aliasList.push(userAlias);
    for (const alias in globals.userMap) {
      if ( alias !== userAlias )
        aliasList.push(alias);
    }

    const columnSizes = [0]; // Title
    for (let i = 0; i < aliasList.length; i++) {
      columnSizes.push(0);
    }
    if ( showComp ) columnSizes.push(0);

    for ( const compObj of mediaList ) {
      columnSizes[0] = Math.max(columnSizes[0], compObj.name.length);

      let i = 1;
      for (const alias of aliasList) {
        if ( compObj[alias] == 0 )
          compObj[alias] = '--';
        else
          compObj[alias] = compObj[alias].toFixed(2);
        columnSizes[i] = Math.max(columnSizes[i], alias.length, compObj[alias].length);
        i++;
      }

      if ( showComp ) {
        compObj.compScore = (Math.round(compObj.compScore*100)/100).toFixed(2);
        columnSizes[i] = Math.max(columnSizes[i], compObj.compScore.length);
      }
    }

    msgContents += "```";

    // headers
    msgContents += "\n|" + helpers.getTblFmtStr( "Title", columnSizes[0], 'l' );
    let i = 1;
    for (const alias of aliasList) {
      msgContents += helpers.getTblFmtStr( alias.charAt(0).toUpperCase() + alias.slice(1), columnSizes[i], 'r' );
      i++;
    }
    if ( showComp )
      msgContents += helpers.getTblFmtStr( "Comp", columnSizes[i], 'r' );
    msgContents += " Tags";

    // linebreak
    msgContents += "\n+";
    for ( let i = 0; i < columnSizes.length; i++ ) {
      msgContents += helpers.getTblFmtBrk( columnSizes[i] );
    }
    msgContents += "------";

    for ( const compObj of mediaList ) {
      // title
      msgContents += "\n|" + helpers.getTblFmtStr( compObj.name, columnSizes[0], 'l' );

      let i = 1;
      // individual scores
      for (const alias of aliasList) {
        msgContents += helpers.getTblFmtStr( compObj[alias], columnSizes[i], 'r' );
        i++;
      }

      // composite score
      if ( showComp )
        msgContents += helpers.getTblFmtStr( compObj.compScore, columnSizes[i], 'r' );

      // tags
      msgContents += " " + globals.mediaMap[compObj.name.toLowerCase()].tags;
    }
    msgContents += "```";


    const newMsg = {
      content: msgContents,
      messageReference: {messageID: msg.id}
    };

    return msg.channel.createMessage(newMsg);
  },

  /* GET RAND */
  rand: async (msg, args) => {
    const tagList = [];
    let errStr = "";
    for ( const arg of args ) {
      const temp = arg.toLowerCase();
      if ( globals.tagMap[temp] ) {
        tagList.push(temp);
      } else {
        errStr += `**<E>** Tag unrecognized: ${temp}\n`
      }
    }

    let newMsg;
    if ( errStr ) {
      newMsg = {
        content: errStr,
        messageReference: {messageID: msg.id}
      };

    } else {
      const compObj = helpers.getRand(tagList);
      newMsg = await helpers.tblFmtEmbed( msg, structuredClone(compObj) );
    }
    
    return msg.channel.createMessage(newMsg);
  },

  /* GET INFO */
  info: async (msg, args) => {
    let errMsg = "";
    let imgURL = undefined;
    let newMsg;
    if ( args.length > 0 ) {
      const titleOrig = args.join(" ");
      const titleLower = titleOrig.toLowerCase();
      const titleObj = globals.mediaMap[titleLower];
      if ( !titleObj ) {
        errMsg = `**<E>** Title ${titleOrig} not found.`;
      } else {
        const compObj = globals.compMap[titleObj.title];
        if ( !compObj ) {
          errMsg = `**<E>** Title ${titleObj.title} not found.`;
        } else {
          newMsg = await helpers.tblFmtEmbed( msg, structuredClone(compObj) );
        }
      }
    } else {
      errMsg = "**<E>** No argument provided.";
    }

    if ( errMsg ) {
      newMsg = {
        content: errMsg,
        messageReference: {messageID: msg.id}
      };
    }

    return msg.channel.createMessage(newMsg);
  },

  checkYourGMs: async (msg) => {
    const gmThresh = 5;
    const tmThresh = msg.timestamp - 10 * 60 * 60 * 1000; // 8 hours
    const gmArr = [msg.author.id];

    let msgContents = `<@${msg.author.id}>`;
    const msgArr = await msg.channel.getMessages({before: msg.id});
    for ( const tempMsg of msgArr ) {
      console.log("time", (tempMsg.timestamp > tmThresh), "isgm", (tempMsg.content.indexOf("gm") === 0), "!bot", !tempMsg.author.bot, "uniq", !gmArr.includes(tempMsg.author.id));
      if ( tempMsg.timestamp < tmThresh )
        return;

      if ( (tempMsg.content.indexOf("gm") === 0)
        && (!tempMsg.author.bot)
        && (!gmArr.includes(tempMsg.author.id))
        )
      {
        msgContents = `<@${tempMsg.author.id}> ` + msgContents;
        gmArr.push(tempMsg.author.id);
      } else {
        continue;
      }

      if ( gmArr.length === gmThresh ) {
        msgContents = "gm " + msgContents;
        console.log("SUCCESS!", msgContents);
        return msg.channel.createMessage(msgContents);
      }
    }

    console.log("FAILURE!", msgContents);
  },
};