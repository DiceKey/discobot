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

    getRecs: function( userAlias, tagList ) {
      // compObj { title: {user1: score, ...} }
      const compMap  = {};
      const compList = [];

      if ( tagList.length > 0 ) {

        // find intersection of all tags
        let intersectList = [];
        for ( const tagName of tagList ) {
          const tagMediaArr = globals.tagMap[tagName];
          if ( tagMediaArr === undefined ) {
            console.log(`Tag unknown: ${tagName}`);
          } else {
            if ( intersectList.length == 0 ) {
              intersectList = tagMediaArr;
            } else {
              const tempList = intersectList.filter( x => tagMediaArr.includes(x) );
              intersectList = tempList;
            }
          }
        }

        // fill scores
        for ( const mediaName of intersectList ) {
          const finalObj = {name: mediaName, compScore: 0};

          let numUsers = 0;
          for (const alias in globals.userMap) {
            let isFound = false;
            for ( const mediaObj of globals.userMap[alias].list ) {
              if ( mediaObj.name == mediaName ) {
                finalObj.tags = mediaObj.tags;
                finalObj[alias] = mediaObj.score;
                finalObj.compScore += mediaObj.altscore;
                numUsers ++;
                isFound = true;
                break;
              }
            }
            if ( !isFound ) {
              finalObj[alias] = 0;
              finalObj.compScore += globals.userMap[alias].altAvg;
            }
          }

          finalObj.compScore = finalObj.compScore / Object.keys(globals.userMap).length;
          compList.push(finalObj);
        }

      } else {
        // combine user lists
        Object.entries(globals.userMap).forEach( userEntry => {
          const [alias, userObj] = userEntry;

          for (const mediaObj of userObj.list) {
            if ( compMap[mediaObj.name] === undefined ) {
              compMap[mediaObj.name] = {name: mediaObj.name, compScore: 0, tags: mediaObj.tags};
            }
            compMap[mediaObj.name][alias] = mediaObj.score;
            compMap[mediaObj.name].compScore += mediaObj.altscore;
          }
        });

        // fill empty scores with dummy scores
        // find average score
        Object.entries(compMap).forEach( compEntry => {
          const [title, compObj] = compEntry;

          let numUsers = 0;
          for (const alias in globals.userMap) {
            if ( compObj[alias] === undefined ) {
              compObj[alias] = 0;
              compObj.compScore += globals.userMap[alias].altAvg;
            } else {
              numUsers++;
            }
          }
          if ( userAlias || numUsers > 1 ) {
            compObj.compScore = compObj.compScore / Object.keys(globals.userMap).length;
            compList.push(compObj);
          }
        });
      }

      // sort
      if ( userAlias )
        compList.sort(function(a,b){ return ((b[userAlias] == a[userAlias]) ? (b.compScore - a.compScore) : (b[userAlias] - a[userAlias])) });
      else
        compList.sort(function(a,b){ return b.compScore - a.compScore });

      const mediaList = compList.slice(0, globals.MAXLIST);
      //console.log(mediaList);
      return mediaList;
    },

    queryUserList: async function(alias, username) {
        if (!fs.existsSync(globals.DATADIR)) fs.mkdirSync(globals.DATADIR);
        if (!fs.existsSync(globals.LISTDIR)) fs.mkdirSync(globals.LISTDIR);

        let min = 10;
        let max = 1;
        let avg = 0;
        let count = 0;

        const malGetURL = new URL(`https://api.myanimelist.net/v2/users/${username}/animelist`);
        malGetURL.searchParams.append('status', 'completed');
        malGetURL.searchParams.append('limit', 1000);
        malGetURL.searchParams.append('fields', 'list_status,num_episodes,genres');

        //const malGetURL = new URL(`https://api.myanimelist.net/v2/users/@me`);

        axios.get(malGetURL.href, {headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `${globals.malToken.token_type} ${globals.malToken.access_token}`
        }})
          .then(res => {
            const json = res.data;

            //TODO json.paging

            for (const datum of json.data) {
              //console.log(datum);
              //console.log(datum.node.num_episodes);
              //console.log(datum.node.genres[0].name);

              const name = datum.node.title;
              const score = datum.list_status.score;
              if ( score === 0 )
                continue;

              const newEntry = {name: name, score: score, altscore: score, tags: ""};

              for ( const genre of datum.node.genres ) {
                const genreName = genre.name.toLowerCase().replace(/ /g, "");
                if ( ! globals.tagMap[genreName] ) {
                  globals.tagMap[genreName] = [name];
                } else {
                  globals.tagMap[genreName].push(name);
                  // check for uniqueness
                  globals.tagMap[genreName] = globals.tagMap[genreName].filter( function(value, index, self) { return self.indexOf(value) === index } );
                }

                if ( newEntry.tags !== "" ) {
                  newEntry.tags += ", ";
                }
                newEntry.tags += genreName;
              }

              globals.userMap[alias].list.push(newEntry);
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

            // write tags to file
            fs.writeFileSync(globals.tagMapFileName, JSON.stringify(globals.tagMap));
            console.log(`Tag list written to ${globals.tagMapFileName}`);
        })
          .catch(err => {
            console.error(err.message);
            console.error(err);
        });
    },

    readUserList: async function(alias) {
      if (!fs.existsSync(globals.DATADIR)) fs.mkdirSync(globals.DATADIR);
      if (!fs.existsSync(globals.LISTDIR)) fs.mkdirSync(globals.LISTDIR);
      const listFileName = `${globals.LISTDIR}${alias}.json`;

      if (!fs.existsSync(listFileName)) {
        await module.exports.queryUserList(alias, globals.userMap[alias].username);
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
            await module.exports.readUserList(alias);
          }
        }

        console.log(`User File: Completed with ${goodCount} entries`);
      }
    },

    readTagFile: async function() {
      console.log(`Tag File: ${globals.tagMapFileName}`);
      if (!fs.existsSync(globals.tagMapFileName)) {
        console.warn(`Tag File: Not found`);
      } else {

        try {
          const data = await fs.promises.readFile(globals.tagMapFileName, { encoding: 'utf8' });
          globals.tagMap = JSON.parse(data);
          console.log(`List File: Successfully read ${globals.tagMapFileName}`);
        } catch (err) {
          console.error(err);
        }
      }

      console.log(`Tag File: Completed with ${Object.keys(globals.tagMap).length} tags`);
    },

    getTblFmtStr: function( rawStr, colLen, align ) {
      if ( align === 'l' ) {
        return " " + rawStr + " ".repeat(1 + colLen - rawStr.length) + "|";
      } else if ( align === 'r' ) {
        return " ".repeat(1 + colLen - rawStr.length) + rawStr + " |";
      } else {
        return " ".repeat(1 + colLen - Math.floor(rawStr.length/2)) + rawStr + " ".repeat(1 + colLen - Math.ceil(rawStr.length/2)) + "|";
      }
    },

    getTblFmtBrk: function( colLen ) {
      return "-".repeat(2 + colLen) + "+";
    },
};