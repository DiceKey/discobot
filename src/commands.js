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
      helpers.queryUserList(alias, username);
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
      const numOfCols = 3;
      const columns = [];
      const columnSizes = [];
      for ( let i = 0; i < numOfCols; i++ ) {
        columns.push([]);
        columnSizes.push(0);
      }

      tagList.sort( function(a,b){ return a.localeCompare(b) } );
      //tagList.sort( function(a,b){ return a.name.localeCompare(b.name) } );
      //tagList.sort( function(a,b){ return b.size - a.size } );
      for ( let i = 0; i < tagList.length; i++ ) {
        const colNum = i%numOfCols;
        const thisTag = tagList[i]
        columns[colNum].push(thisTag);
        columnSizes[colNum] = Math.max(columnSizes[colNum], thisTag.length);
      }
      //console.log(columns);

      msgContents = "```\n";

      msgContents += "+";
      for ( let i = 0; i < columnSizes.length; i++ ) {
        msgContents += helpers.getTblFmtBrk( columnSizes[i] );
      }

      for ( let j = 0; j < columns[0].length; j++ ) {
        msgContents += "\n|";
        for ( let i = 0; i < numOfCols; i++ ) {
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
    let userAlias = undefined;
    let msgContents = "";
    let tagList = [];
    if (args.length > 0) {
      const checkAlias = args[0].toLowerCase();
      if ( globals.userMap[checkAlias] ) {
        userAlias = checkAlias;
        tagList = args.slice(1)
      } else {
        tagList = args;
      }
    }

    const finalTagList = [];
    for (let tagName of tagList) {
      tagName = tagName.toLowerCase();
      if ( globals.tagMap[tagName] !== undefined ) {
        finalTagList.push(tagName);
      } else {
        msgContents += `**<E>** Tag unrecognized: ${tagName}\n`;
      }
    }

    mediaList = helpers.getRecs(userAlias, finalTagList);

    const aliasList = [];
    if ( userAlias !== undefined )
      aliasList.push(userAlias);
    for (const alias in globals.userMap) {
      if ( alias !== userAlias )
        aliasList.push(alias);
    }

    const columnSizes = [];
    for (let i = 0; i < 1 + aliasList.length + 1; i++) {
      columnSizes.push(0);
    }
    for ( const mediaObj of mediaList ) {
      columnSizes[0] = Math.max(columnSizes[0], mediaObj.name.length);

      let i = 1;
      for (const alias of aliasList) {
        if ( mediaObj[alias] == 0 )
          mediaObj[alias] = '--';
        else
          mediaObj[alias] = mediaObj[alias].toFixed(2);
        columnSizes[i] = Math.max(columnSizes[i], alias.length, mediaObj[alias].length);
        i++;
      }

      mediaObj.compScore = (Math.round(mediaObj.compScore*100)/100).toFixed(2);
      columnSizes[i] = Math.max(columnSizes[i], mediaObj.compScore.length);
    }

    msgContents += "```";

    // headers
    msgContents += "\n|" + helpers.getTblFmtStr( "Title", columnSizes[0], 'l' );
    let i = 1;
    for (const alias of aliasList) {
      msgContents += helpers.getTblFmtStr( alias.charAt(0).toUpperCase() + alias.slice(1), columnSizes[i], 'r' );
      i++;
    }
    msgContents += helpers.getTblFmtStr( "Comp", columnSizes[i], 'r' );
    msgContents += " Tags";

    // linebreak
    msgContents += "\n+";
    for ( let i = 0; i < columnSizes.length; i++ ) {
      msgContents += helpers.getTblFmtBrk( columnSizes[i] );
    }
    msgContents += "------";

    for ( const mediaObj of mediaList ) {
      // title
      msgContents += "\n|" + helpers.getTblFmtStr( mediaObj.name, columnSizes[0], 'l' );

      let i = 1;
      // individual scores
      for (const alias of aliasList) {
        msgContents += helpers.getTblFmtStr( mediaObj[alias], columnSizes[i], 'r' );
        i++;
      }
      // composite score
      msgContents += helpers.getTblFmtStr( mediaObj.compScore, columnSizes[i], 'r' );

      // tags
      msgContents += " " + mediaObj.tags;
    }
    msgContents += "```";

    const newMsg = {
      content: msgContents,
      messageReference: {messageID: msg.id}
    };

    return msg.channel.createMessage(newMsg);
  },

  /* GET INFO */
  info: (msg, args) => {

  },
};