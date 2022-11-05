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
	  + `${PREFIX}rec [ALIAS]  [TAG ...]  [--c]    get recommendations\n`
	  +       `    > ALIAS                         filter for a specific alias (eg. Charlie)\n`
	  +       `    > TAG ...                       filter for a certain tag/tags (eg. Action)\n`
	  +       `    > --c                           show composite scores (scaled -> 1-10, avg translated -> 5.5, Bayesian priors)\n`
	  + `${PREFIX}rand [TAG ...]                   get info about a random anime\n`
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