const PREFIX = 'cb!';
const DATADIR = './data/';

module.exports = {
	MAXLIST: 10,
	PREFIX: PREFIX,
	DELIM: ',',
	HELPST: "```"
	  + `${PREFIX}add ALIAS  USERNAME              add a new user\n`
	  +       `    > ALIAS                         human-readable alias (eg. Charlie)\n`
	  +       `    > USERNAME                      MAL username (eg. notatrueroute)\n`
	  + `${PREFIX}users                            show all known users\n`
	  + `${PREFIX}rec [ALIAS] [TAGS] [-u X] [--c]  get recommendations\n`
	  +       `    > ALIAS                         filter for a specific alias (eg. Charlie)\n`
	  +       `    > TAGS                          filter for a space-separated list of tags (eg. Action)\n`
	  +       `    > -u X                          filter for entries that at least X people have reviewed (default=2)\n`
	  +       `    > --c                           show composite scores (min -> 1, max -> 10, avg -> 5.5)\n`
	  + `${PREFIX}rand [ALIAS] [TAGS] [-u X]       get info about a random anime\n`
	  + `${PREFIX}info ANIMENAME                   get info about a specific anime\n`
	  + `${PREFIX}tags                             get tags that can be used for !rec and !rand\n`
	  + `${PREFIX}help                             print this dialogue`
	  + "```",

	DATADIR: DATADIR,
	LISTDIR: `${DATADIR}lists/`,
	userMapFileName: `${DATADIR}userList.txt`,
	tagMapFileName: `${DATADIR}tagMap.json`,
	tokenFileName: `${DATADIR}token.json`,

	/* mediaMap: {
	 *   icTitle: {
	 *     capitalizedTitle: title,
	 *     id: id,
	 *     tags: "tag1, ...",
	 *   }
	 * }
	 */
	mediaMap: {},

	/* userMap: {
	 *   ALIAS: {
	 *     username: username,
 	 *     list: [ {name: name, score: score, altscore: altscore}, ... ],
 	 *     avg: avg,
 	 *     altAvg: altAvg
	 *   }
	 * }
	 */
	userMap: {},

	/* compMap: {
	 *   title: {
	 *     name: title,
	 *     compScore: compScore,
	 *     tags: tags,
	 *     user1: score, ...
	 *   }
	 * }
	 */
	compMap: {},

	/* tagMap: {
	 *   TAG: [anime1, anime2, ...]
	 * }
	 */
	tagMap: {},

	// JSON object
	malToken: {},
};