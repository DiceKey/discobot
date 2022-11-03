const PREFIX = 'cb!';
const DATADIR = './data/';

module.exports = {
	MAXLIST: 10,
	PREFIX: PREFIX,
	DELIM: ',',
	HELPST: "```"
	  + `${PREFIX}add ALIAS  USERNAME              add a new user\n`
//	  + `${PREFIX}get ALIAS                        show one user's link\n`
	  + `${PREFIX}users                            show all users' links\n`
	  + `${PREFIX}rec [ALIAS]  [TAGS ...]          get recommendations\n`
	  +       `    > ALIAS                         filter for a specific user\n`
	  +       `    > TAGS ...                      filter for a certain tag/tags\n`
	  + `${PREFIX}tags                             get tags that can be used for !rec\n`
	  + `${PREFIX}help                             print this dialogue`
	  + "```",

	DATADIR: DATADIR,
	LISTDIR: `${DATADIR}lists/`,
	userMapFileName: `${DATADIR}userList.txt`,
	tagMapFileName: `${DATADIR}tagMap.json`,
	tokenFileName: `${DATADIR}token.json`,

	/* userMap: {
	 *        ALIAS: {
	 *          username: username,
 	 *          list: [ {name: name, score: score, altscore: altscore, tags: "tag1, tag2, ..."}, ... ],
 	 *          avg: avg,
 	 *          altAvg: altAvg
	 *        },
	 *        ...
	 *      }
	 */
	userMap: {},
	/* tagMap: {
	 *     TAG: [anime1, anime2, ...]
	 * }
	 */
	tagMap: {},
	// JSON object
	malToken: {},
};