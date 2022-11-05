const globals = require('./globals');
const helpers = require('./helpers');

function sendReply( msg, body ) {
  const newMsg = {
    content: body,
    messageReference: {messageID: msg.id}
  };

  return msg.channel.createMessage(newMsg);
}

module.exports = {

  /* HELP */
  help: (msg, args) => {
    return sendReply( msg, globals.HELPST );
  },
  UNDEFINED: (msg, args) => {
    return sendReply( msg, `**<E>** Invalid command name\n${globals.HELPST}` );
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

    return sendReply(msg, msgContents);
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

    return sendReply( msg, msgContents );
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

    return sendReply( msg, msgContents );
  },

  /* GET RECS */
  rec: (msg, args) => {
    let showComp = false;
    let msgContents = "";

    let userAlias = undefined;
    const tagList = [];
    let flag = "";
    let minUsers = 2;
    let pageNum = 1;
    for ( const arg of args ) {
      if ( arg === "--c" ) {
        showComp = true;
      } else if ( arg === "-u" ) {
        flag = "u";
      } else if ( arg === "-p" ) {
        flag = "p";
      } else {
        if ( flag == "u" ) {
          flag = "";
          minUsers = parseInt(arg);
          if (minUsers === NaN) {
            msgContents += `**<E>** Ignoring invalid flag: -u ${arg}`
            minUsers = 2;
          }
          continue;
        } else if ( flag == "p" ) {
          flag = "";
          pageNum = parseInt(arg);
          if (pageNum === NaN) {
            msgContents += `**<E>** Ignoring invalid flag: -p ${arg}`
            pageNum = 0;
          }
          continue;
        }

        const temp = arg.toLowerCase();
        if ( userAlias === undefined && tagList.length == 0 && globals.userMap[temp] ) {
          userAlias = temp;
        } else if ( globals.tagMap[temp] ) {
          tagList.push(temp);
        } else {
          msgContents += `**<E>** Ignoring unknown user/tag: ${temp}\n`
        }
      }
    }

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
    if ( showComp ) columnSizes.push(0); // Comp

    const compList = helpers.getRecs(userAlias, tagList, minUsers, pageNum - 1);
    if (compList.length == 0) {
      return sendReply( msg, "**<W>** Query returned 0 results." );
    }
    for ( const compObj of compList ) {
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

    for ( const compObj of compList ) {
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

    return sendReply( msg, msgContents );
  },

  /* GET RAND */
  rand: async (msg, args) => {
    let errStr = "";
    let userAlias = undefined;
    const tagList = [];
    let uFlag = false;
    let minUsers = 1;
    for ( const arg of args ) {
      if ( arg === "-u" ) {
        uFlag = true;
      } else {
        if ( uFlag ) {
          minUsers = parseInt(arg);
          if (minUsers !== NaN) {
            uFlag = false;
            continue;
          } else {
            minUsers = 2;
          }
        }

        const temp = arg.toLowerCase();
        if ( userAlias === undefined && tagList.length == 0 && globals.userMap[temp] ) {
          userAlias = temp;
        } else if ( globals.tagMap[temp] ) {
          tagList.push(temp);
        } else {
          errStr += `**<E>** User/Tag unrecognized: ${temp}\n`
        }
      }
    }

    let compObj;
    if ( !errStr ) {
      compObj = helpers.getRand(userAlias, tagList, minUsers);
      if (!compObj) {
        errStr = `**<W>** Query return 0 results`;
      }
    }

    let newMsg;
    if ( errStr ) {
      newMsg = {
        content: errStr,
        messageReference: {messageID: msg.id}
      };

    } else {
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