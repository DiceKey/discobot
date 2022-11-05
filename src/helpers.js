const fs = require('fs');
const readline = require('readline');
const open = require('open');
const axios = require('axios');

const globals = require('./globals');
const config  = require('../config.json');

const malAuthBase = 'https://myanimelist.net/v1/oauth2/authorize';
const malTokenURL = 'https://myanimelist.net/v1/oauth2/token';

// MAL API
// https://myanimelist.net/apiconfig/references/api/v2

function generateCodeChallenge() {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

  var text = '';
  for (var i = 0; i < 128; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
}

function calcGlobalComposite() {
  globals.compMap = {};

  // combine user lists
  Object.entries(globals.userMap).forEach( userEntry => {
    const [alias, userObj] = userEntry;

    for (const compObj of userObj.list) {
      if ( globals.compMap[compObj.name] === undefined ) {
        globals.compMap[compObj.name] = {name: compObj.name, compScore: 0, numUsers: 0, id: compObj.id, tags: compObj.tags};
      }
      globals.compMap[compObj.name][alias] = compObj.score;
      globals.compMap[compObj.name].compScore += compObj.altscore;
      globals.compMap[compObj.name].numUsers += 1;
    }
  });

  // fill empty scores with dummy scores
  // find average score
  Object.entries(globals.compMap).forEach( compEntry => {
    const [title, compObj] = compEntry;

    if ( compObj.numUsers != Object.keys(globals.userMap).length ) {
      for (const alias in globals.userMap) {
        if ( compObj[alias] === undefined ) {
          compObj[alias] = 0;
          compObj.compScore += globals.userMap[alias].altAvg;
        }
      }
    }

    compObj.compScore = compObj.compScore / Object.keys(globals.userMap).length;
  });

  console.log(`calcGlobalComposite: ${Object.keys(globals.compMap).length} rows`);
}

function getListIntersect( tagList ) {
  let intersectList = [];
  for ( const tagName of tagList ) {
    const tagMediaArr = globals.tagMap[tagName];
    if ( tagMediaArr === undefined ) {
      console.log(`Tag unknown: ${tagName}`);
    } else {
      if ( intersectList.length == 0 ) {
        intersectList = tagMediaArr;
      } else {
        intersectList = intersectList.filter( x => tagMediaArr.includes(x) );
      }
    }
  }
  return intersectList;
}

module.exports = {
  // TODO add refresh token function

  // https://gitlab.com/-/snippets/2039434
  generateMALtoken: async function() {
    const codeChallenge = generateCodeChallenge();

    const malAuthURL = new URL(malAuthBase);
    malAuthURL.searchParams.append('response_type', 'code');
    malAuthURL.searchParams.append('client_id', config.MAL_CLIENT_ID);
    malAuthURL.searchParams.append('code_challenge', codeChallenge);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    await open(malAuthURL.href);
    rl.question('Copy/paste the authorization code here: ', function (authCode) {

      axios.post(malTokenURL, {
        client_id: config.MAL_CLIENT_ID,
        client_secret: config.MAL_CLIENT_SECRET,
        code: authCode.trim(),
        code_verifier: codeChallenge,
        grant_type: 'authorization_code',
      }, {headers: {'Content-Type': 'application/x-www-form-urlencoded'}})
        .then(res => {
          globals.malToken = res.data;

          // write to disk
          if (!fs.existsSync(globals.DATADIR)) fs.mkdirSync(globals.DATADIR);
          const msgContents = JSON.stringify(globals.malToken);
          fs.writeFileSync(globals.tokenFileName, msgContents);
          console.log(`Token written to ${globals.tokenFileName}`);
      })
        .catch(err => {
          console.error(err.message);
      });
    });
  },

  readMALtokenFromFile: async function() {
    console.log(`Token File: ${globals.tokenFileName}`);
    if (!fs.existsSync(globals.DATADIR)) fs.mkdirSync(globals.DATADIR);

    if (!fs.existsSync(globals.tokenFileName)) {
      await module.exports.generateMALtoken();
    } else {
      try {
        const data = await fs.promises.readFile(globals.tokenFileName, { encoding: 'utf8' });
        globals.malToken = JSON.parse(data);
        console.log(`Token File: Successfully read`);
      } catch (err) {
        console.error(err);
      }
    }
  },

  getRecs: function( userAlias, tagList, minUsers, offset=0 ) {
    const compList = [];

    if ( tagList.length > 0 ) {
      // find intersection of all tags
      const intersectList = getListIntersect( tagList );

      // fill scores
      for ( const mediaName of intersectList ) {
        compList.push(structuredClone(globals.compMap[mediaName]));
      }

    } else {
      for ( const compObj of Object.values(globals.compMap) ) {
        // prefer entries that more than 1 user has reviewed
        if ( userAlias || compObj.numUsers >= minUsers ) {
          compList.push(structuredClone(compObj));
        }
      };
    }

    // sort
    if ( userAlias )
      compList.sort(function(a,b){ return ((b[userAlias] == a[userAlias]) ? (b.compScore - a.compScore) : (b[userAlias] - a[userAlias])) });
    else
      compList.sort(function(a,b){ return b.compScore - a.compScore });

    const start = offset * globals.MAXLIST;
    const end   = start + globals.MAXLIST;
    const mediaList = compList.slice(start, end);
    //console.log(mediaList);
    return mediaList;
  },

  getRand: function ( userAlias, tagList, minUsers ) {
    let tempKeys;
    let finalKeys = [];

    if ( tagList.length > 0 ) {
      tempKeys = getListIntersect( tagList );
    } else {
      tempKeys = Object.keys(globals.compMap);
    }

    if ( userAlias || (minUsers>1) ) {
      for ( const key of tempKeys ) {
        const compObj = globals.compMap[key];
        if ( ((!userAlias) || (compObj[userAlias] > 0))
          && (compObj.numUsers >= minUsers) )
        {
          finalKeys.push(key);
        }
      }
    } else {
      finalKeys = tempKeys;
    }

    const randKey = finalKeys [ Math.floor(Math.random() * finalKeys.length) ];
    return globals.compMap[randKey];
  },

  queryAnimeDetails: async function(animeID) {
    const malGetURL = new URL(`https://api.myanimelist.net/v2/anime/${animeID}`);
    malGetURL.searchParams.append('fields', 'synopsis, num_episodes, start_date'); // media_type, end_date, start_season

    try {
      const res = await axios.get(malGetURL.href, {headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `${globals.malToken.token_type} ${globals.malToken.access_token}`
      }});

      const json = res.data;
      return json;

    } catch (err) {
      console.error(err.message);
      console.error(err);
      return undefined;
    }
  },

  tblFmtEmbed: async function(msg, compObj) {
    const MAXSYN = 4096;

    const newMsg = {messageReference: {messageID: msg.id}};

    const mediaObj = globals.mediaMap[compObj.name.toLowerCase()];
    const animeID = mediaObj.id;

    const json = await module.exports.queryAnimeDetails(animeID);
    if ( json === undefined ) {
      newMsg.content = `**<E>** Unable to query MAL for info on "${compObj.name}"`;
    } else {
      const link = `https://myanimelist.net/anime/${animeID}`;
      const year = json.start_date.slice(0, 4);
      const title = `${compObj.name} (${year}` + (json.num_episodes > 1 ? ` - ${json.num_episodes} ep` : "") + ")";

      newMsg['embed'] = {
        url: link,
        title: title,
        // timestamp: json.start_date,
        thumbnail: {url: json.main_picture.medium},
        // image: {url: json.main_picture.medium},
        fields: [],
        //footer: { text: `Tags: ${mediaObj.tags}` }
      };

      let syn = json.synopsis;
      syn = syn.replace(/\s*\[Written by MAL Rewrite\]/, "").replace(/\s*\(Source:.*/, "");
      if (syn.length > MAXSYN) {
        syn = syn.slice(0, MAXSYN - 3) + "...";
      }
      newMsg.embed['description'] = syn;

      // newMsg.embed.fields.push({ name: "Synopsis", value: syn, inline: false });
      // newMsg.embed['footer'] = { text: syn };
      // newMsg.content = syn;

      newMsg.embed.fields.push({
        name: "Tags",
        value: mediaObj.tags,
        inline: false
      });

      for (const alias in globals.userMap) {
        if ( compObj[alias] !== 0 ) {
          newMsg.embed.fields.push({
            name: alias.charAt(0).toUpperCase() + alias.slice(1),
            value: compObj[alias].toFixed(2),
            inline: true
          });
        }
      }

      // if ( compObj.numUsers > 1 ) newMsg.embed.fields.push({ name: "Comp", value: compObj.compScore.toFixed(2), inline: true });
    }

    return newMsg;
  },

  queryUserList: async function(alias, recalc=false) {
    if (!fs.existsSync(globals.DATADIR)) fs.mkdirSync(globals.DATADIR);
    if (!fs.existsSync(globals.LISTDIR)) fs.mkdirSync(globals.LISTDIR);

    let min = 10;
    let max = 1;
    let avg = 0;
    let count = 0;

    const username = globals.userMap[alias].username;

    const malGetURL = new URL(`https://api.myanimelist.net/v2/users/${username}/animelist`);
    malGetURL.searchParams.append('status', 'completed');
    malGetURL.searchParams.append('limit', 1000);
    malGetURL.searchParams.append('fields', 'list_status,num_episodes,genres');

    try {
      const res = await axios.get(malGetURL.href, {headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `${globals.malToken.token_type} ${globals.malToken.access_token}`
      }});
      const json = res.data;

      //TODO json.paging

      globals.userMap[alias].list = [];

      for (const datum of json.data) {
        //console.log(datum);
        //console.log(datum.node.num_episodes);
        //console.log(datum.node.genres[0].name);

        const title = datum.node.title;
        const score = datum.list_status.score;
        if ( score === 0 )
          continue;

        const mediaEntry = {title: title, id: datum.node.id, tags: ""};
        for ( const genre of datum.node.genres ) {
          const genreName = genre.name.toLowerCase().replace(/ /g, "");
          if ( ! globals.tagMap[genreName] ) {
            globals.tagMap[genreName] = [title];
          } else {
            if ( !globals.tagMap[genreName].includes(title) )
              globals.tagMap[genreName].push(title);
          }

          if ( mediaEntry.tags !== "" ) {
            mediaEntry.tags += ", ";
          }
          mediaEntry.tags += genreName;
        }
        globals.mediaMap[title.toLowerCase()] = mediaEntry;

        const userEntry = {name: title, score: score, altscore: score};
        globals.userMap[alias].list.push(userEntry);
        min = Math.min(min, score);
        max = Math.max(max, score);
        avg += score;
        count++;
      }

      if ( count > 0 )
        avg = avg/count;
      globals.userMap[alias].avg = avg;
      globals.userMap[alias].list.sort(function(a,b){return b.score - a.score});

      // scale to 1-10
      let scaledAvg = 0;
      if ( min > 1 || max < 10 ) {
        for (let i = 0; i < count; i++) {
          const scaled = 1 + 9 * (globals.userMap[alias].list[i].score - min) / (max - min);
          globals.userMap[alias].list[i].altscore = scaled;
          scaledAvg += scaled;
        }
        if ( count > 0 )
          scaledAvg = scaledAvg/count;
      } else {
        scaledAvg = avg;
      }

      // center the scores around 5.5 instead of the scaled average
      // clip at [1,10]
      let altAvg = 0;
      for (let i = 0; i < count; i++) {
        globals.userMap[alias].list[i].altscore = Math.max(1, Math.min(10, globals.userMap[alias].list[i].altscore - scaledAvg + 5.5));
        altAvg += globals.userMap[alias].list[i].altscore;
      }
      if (count > 0 )
        altAvg = altAvg/count;
      globals.userMap[alias].altAvg = altAvg;

      // write objects to file
      if (!fs.existsSync(globals.DATADIR)) fs.mkdirSync(globals.DATADIR);
      if (!fs.existsSync(globals.LISTDIR)) fs.mkdirSync(globals.LISTDIR);
      const listFileName = `${globals.LISTDIR}${alias}.json`;
      const msgContents = JSON.stringify(globals.userMap[alias]);
      fs.writeFileSync(listFileName, msgContents);
      console.log(`List written to ${listFileName}`);

      if ( recalc ) {
        calcGlobalComposite();
        module.exports.writeTagFile();
      }
    } catch (err) {
        console.error(err.message);
        console.error(err);

    }
  },

  readUserList: async function(alias) {
    if (!fs.existsSync(globals.DATADIR)) fs.mkdirSync(globals.DATADIR);
    if (!fs.existsSync(globals.LISTDIR)) fs.mkdirSync(globals.LISTDIR);
    const listFileName = `${globals.LISTDIR}${alias}.json`;

    if (!fs.existsSync(listFileName)) {
      await module.exports.queryUserList(alias, false);
    } else {
      try {
        const data = await fs.promises.readFile(listFileName, { encoding: 'utf8' });
        globals.userMap[alias] = JSON.parse(data);
        console.log(`List File: Successfully read ${alias}.json`);
      } catch (err) {
        console.error(err);
      }
    }
  },

  writeUserFile: function() {
    let msgContents = '';
    Object.entries(globals.userMap).forEach( entry => {
      const [key, value] = entry;
      if (msgContents !== '') {
          msgContents += "\n";
      }
      msgContents += `${key}${globals.DELIM}${value.username}`;
    });

    if (!fs.existsSync(globals.DATADIR)) fs.mkdirSync(globals.DATADIR);
    fs.writeFile(globals.userMapFileName, msgContents, err => {
        if (err) {
            console.error(err);
        } else {
            console.log(`Write successful: ${globals.userMapFileName}`);
        }
    });
  },

  readUserFile: async function() {
    console.log(`User File: ${globals.userMapFileName}`);
    if (!fs.existsSync(globals.userMapFileName)) {
      console.warn(`User File: Not found`);
    } else {
      const fileStream = fs.createReadStream(globals.userMapFileName);

      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });
      // Note: we use the crlfDelay option to recognize all instances of CR LF
      // ('\r\n') in input.txt as a single line break.

      let lineCount = 0;
      let goodCount = 0;
      for await (const line of rl) {
        lineCount++;
        const [alias,username] = line.split(globals.DELIM, 2).map(s => s.trim()).filter(s => s);
        if ( username === undefined ) {
          console.log(`User File: line ${lineCount} invalid`);
        } else {
          goodCount++;
          globals.userMap[alias] = {username: username, list: []};
        }
      }

      await Promise.all(Object.keys(globals.userMap).map(module.exports.readUserList));
      calcGlobalComposite();
      console.log(`User File: Completed with ${goodCount} entries`);
    }
  },

  readTagFile: async function() {
    console.log(`Tag File: ${globals.tagMapFileName}`);
    if (!fs.existsSync(globals.tagMapFileName)) {
      console.warn(`Tag File: Not found. Requery all user lists.`);

      await Promise.all(Object.keys(globals.userMap).map( (key) => { return module.exports.queryUserList(key, false) } ));      
      calcGlobalComposite();
      module.exports.writeTagFile();

    } else {
      try {
        const data = await fs.promises.readFile(globals.tagMapFileName, { encoding: 'utf8' });
        const json = JSON.parse(data);
        globals.tagMap = json.tagMap;
        globals.mediaMap = json.mediaMap;
        console.log(`Tag File: Successfully read ${globals.tagMapFileName}`, `${Object.keys(globals.tagMap).length} tags`);
      } catch (err) {
        console.error(err);
      }
    }
  },

  writeTagFile: function() {
    // write tags to file
    if (!fs.existsSync(globals.DATADIR)) fs.mkdirSync(globals.DATADIR);
    fs.writeFileSync(globals.tagMapFileName, JSON.stringify({tagMap: globals.tagMap, mediaMap: globals.mediaMap}));
    console.log(`Tag list written to ${globals.tagMapFileName}`);
  },

  getTblFmtStr: function ( rawStr, colLen, align ) {
    if ( align === 'l' ) {
      return " " + rawStr + " ".repeat(1 + colLen - rawStr.length) + "|";
    } else if ( align === 'r' ) {
      return " ".repeat(1 + colLen - rawStr.length) + rawStr + " |";
    } else {
      return " ".repeat(1 + colLen - Math.floor(rawStr.length/2)) + rawStr + " ".repeat(1 + colLen - Math.ceil(rawStr.length/2)) + "|";
    }
  },

  getTblFmtBrk: function ( colLen ) {
    return "-".repeat(2 + colLen) + "+";
  },

};