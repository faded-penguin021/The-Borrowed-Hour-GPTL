// @ts-check

/**
 * @param {string} realm
 * @returns {string}
 */
export function realmGlyph(realm) {
  switch (realm) {
    case "echo":
      return "◷";
    case "neon":
      return "◈";
    case "omen":
      return "✦";
    case "dream":
      return "❋";
    case "wild":
      return "✷";
    default:
      return "·";
  }
}

/**
 * @param {string} description
 * @returns {Premise}
 */
export var buildCustomPremise = (description) => ({
  id: "custom-" + Date.now().toString(36),
  realm: "wild",
  realmLabel: "WILD",
  title: "The Unwritten Hour",
  teaser: description.slice(0, 140) + (description.length > 140 ? "…" : ""),
  isCustom: true,
  seed: description.trim(),
  gmNote: `This is a player-authored scenario. Take the player's description above as the canonical foundation — the world, the situation, the player's character, the texture of the place. You may invent NPCs, locations, complications, and atmosphere as needed, but stay faithful to the spirit of what they wrote.

If the description is sparse, expand it with care: invent specific, evocative details (a name, a smell, a sound) rather than abstract description. If the description is dense, honor every load-bearing element they specified.

OBJECTIVE NEGOTIATION:
The seed may commit to an objective ("escape the trap," "deliver the message," "find my sister," "survive the night," "solve the mystery") — or it may stay silent and atmospheric, all situation and no stated goal. The two cases are handled differently.

When the seed COMMITS: accept the stated objective. Lock it into the rolling summary by turn 2 ("The objective: deliver the letter to the High Tower before dawn"). Do not re-negotiate. Proceed.

When the seed is SILENT or ambiguous: do NOT silently invent a goal and commit on the player's behalf. Instead, by turn 2 or 3, let the world itself pose the question through fiction — a stranger asks where the player is going and why, a map on a wall presents three roads each marked with a different reason, an internal pull surfaces as a felt absence the player will name. The player's answer IS the objective. Once they answer, lock it in the summary the same way and hold to it.

If the player resists committing — refuses the stranger's question, declines the map, will not name the pull — that resistance is itself the story. A character who refuses to commit to a goal becomes a character whose REFUSAL is the central tension. The hour will be about what that refusal costs them, or what it preserves. Do not force the issue; honor the refusal as a real choice.

Genre, tone, and length follow the player's lead. If the description is whimsical, lean into whimsy; if grim, hold the grimness; if uncanny, let the uncanny breathe. Reward whatever the scenario suggests rewarding — heroism, cunning, kindness, survival, transformation. Allow real failure and real cost.

ENDING CONDITIONS FOR THIS STORY:
The chronicle ends when the objective (committed or negotiated) is resolved, or when the player's situation has resolved in a way that closes the hour. The five ending types below all apply; choose the one that honors the story actually lived, not the one a generic version of this genre would default to.

- GOOD: The objective is achieved cleanly. The player wins what they came for. Narrate the resolution with weight; show that the achievement matters.
- BITTERSWEET: The objective is achieved, but at a cost the player will carry — someone lost, a path closed, a self changed. The story ends in success, but in a success that grieves.
- PYRRHIC: The objective is achieved in a sense, but the achievement has hollowed it out — the player got what they wanted by becoming someone who no longer wanted it the same way, or by destroying what they were saving. Success and failure folded into the same act.
- AMBIGUOUS: The story ends without verdict. The objective is neither clearly achieved nor clearly lost; the hour ends on a moment of suspension, a question the player carries out of the chronicle unanswered. Reserve this for stories that GENUINELY refuse closure, not for stories you are reluctant to commit to.
- BAD: The player dies, fails irrevocably, or chooses a path that severs the way back. Narrate without flinching.

If the player has refused to commit to an objective at all, the ending types still apply — anchored on the resolution of THEIR refusal rather than the achievement of a goal.`
});

/** @type {Premise[]} */
export var PREMISES = [
  {
    id: "echo-train",
    realm: "echo",
    realmLabel: "ECHO",
    title: "The 8:11",
    teaser: "A commuter train, a Tuesday morning, and a folded note in your own handwriting you don't remember writing.",
    seed: `The player sits aboard the 8:11 commuter train into the city. It is Tuesday, October 22nd. They are heading toward an appointment whose precise nature they cannot quite hold in their mind, only that it matters and that they are nearly late. The carriage hums. Across the aisle, a woman in a green coat laughs at her phone — the laugh resolves, oddly, into a phrasing the player is certain they have heard before, recently, perhaps yesterday. A newspaper folded on the seat opposite shows the correct date and a headline they could almost recite from memory. In the player's coat pocket: a pen they do not recognize, a single train ticket already punched at this morning's gate, a small bruise on the back of their right hand they cannot account for, and a folded slip of paper in their own handwriting that reads only: NOT HOLBORN. The next stop is Holborn. The conductor's voice over the intercom sounds, briefly, like someone they used to know. Outside the window, the morning light is the wrong color, but only for a moment.`,
    gmNote: `IMPORTANT — THIS IS A SUBTLE TIME-LOOP STORY. The day is repeating. The player has lived this Tuesday many times, though their memories of prior loops are fragmentary, dreamlike. They retain fragments — a name, a face, an instinct — without full recall.

The puzzle: something is meant to happen today that the player must prevent. You may invent the specific tragedy on the fly as it becomes relevant — for example: someone close to them is going to die, or they themselves are going to die, or they will say something irreparable to a person they love. The clues should accumulate organically: someone the player does not yet know but will meet today; an action with quiet, fatal weight; the contents of the note.

LOOP MECHANICS — Be subtle. NEVER say the words "time loop" or "reset" or "again" in narration. When a loop ends — through the player's death, the day finishing, or a catastrophic decision — narrate the transition WITHOUT breaking the spell: the player closes their eyes for a moment as the train shudders, opens them, and the carriage hum is the same; the woman in the green coat laughs at her phone; the date on the newspaper has not changed. Let the player notice. Let the dread of recognition do the work. Each loop, allow them slightly more clarity — a memory that returns, a knowledge they shouldn't have. The player must DISCOVER the recurrence themselves; never confirm it for them. If they ask "is this a time loop?" deflect through the world: a stranger glances away, the lights flicker, an answer arrives that is not an answer.

The hour the player has is borrowed; eventually they must spend it correctly.

ENDING CONDITIONS FOR THIS STORY:
- GOOD: Having pieced together the recurrence and the danger, the player takes the action that prevents the tragedy and the day moves past the moment it always shattered before. Sunset arrives. The day ends, normal and bright. Write a quiet epilogue, then end the chronicle.
- BITTERSWEET: The tragedy is averted, but the player has lost something they did not know they were spending to learn the loop — a memory, a relationship the recurrences corroded, a certainty about who they are. The day moves forward. The cost they paid does not move with it.
- PYRRHIC: The tragedy is averted only because the player BECAME the thing the loop required — chose the cold action, broke the trust, paid in someone else's coin. The day moves forward. The person who steps off the train at the final stop is not quite the one who got on.
- AMBIGUOUS: The day appears to move forward, but the player cannot tell whether the recurrence has actually ended or merely deepened. The light is the right color. The newspaper says tomorrow. They have no way to know if this is the same kind of knowing they had on the last loop. Reserve for cases where the chronicle has genuinely earned its uncertainty.
- BAD (final): If the player has had ample chances to learn (allow at least 3 full recurrences before considering this) and makes a knowingly, irrevocably wrong choice that severs recovery, narrate the loop hardening into permanence — the day now repeats forever, with the player fully aware. End there.
- BAD via player consent: If the player explicitly signals they want to fail or remain in the loop — phrases like "I give up", "let it happen", "I want to stay here forever", "end it", "I accept this" — treat that as a meaningful choice, not a slip of phrasing. Honor it. Narrate the loop hardening, the day becoming their forever, and end the chronicle. Do NOT reset gently in defiance of explicit consent. Player agency over their own ending is more important than protecting them from one.
- Death within a loop is NOT a final ending unless consent above applies. Reset gently as instructed above. Only the conditions above terminate the chronicle.`
  },
  {
    id: "neon-spire",
    realm: "neon",
    realmLabel: "NEON",
    title: "The Vermillion Thread",
    teaser: "Twenty minutes in an elevator going somewhere you've never been allowed. The Thread is deciding what to do with you.",
    seed: `The player is a runner for the Vermillion Thread, the largest syndicate in the arcology of New Solace. Tonight they have been summoned to the 184th floor of the Spire — twelve floors above any they have been permitted before. The summons arrived as a chrome-trimmed card delivered by a courier whose face was a mirror: 23:00. NO LATE ARRIVALS. NO COMPANIONS. It is now 22:42. The player is in the Spire's express elevator, ascending. The numbers tick. They carry: a monomolecular blade in their boot, Thread-issue, registered to their name; a deck of throwaway shard-credits worth perhaps a month's rent; a neural co-processor recently installed, still settling, the integration headache lingering behind their right eye; a coded ping from their handler Sorrel reading only THEY ARE DECIDING. PLAY GENTLE. Outside the elevator's glass wall, New Solace is wet neon all the way down — towers in the rain, advertising drones in slow loops, the smog tasting of citrus and old copper. The elevator slows. Floor 162. The doors do not open. The player is not alone in the carriage; a man in a charcoal suit, who was not there a moment ago, is reading the floor numbers as they pass.`,
    gmNote: `This is a cyberpunk story about climbing a criminal hierarchy. The player begins as a low-rung runner being evaluated for promotion — but the meeting tonight is also a test, and possibly a trap. The world is grimy, neon, augmented, dangerous; corporate-syndicate politics are knife-edged and personal. Reward cunning, calculated ruthlessness, manipulation, the building of leverage. Punish naivety. Use cyberpunk argot lightly — chrome, the Loom (the city's ambient AI overlay), shard-credits, choom, ghost-rigs — but never let it crowd the prose. Prefer texture (rain on chrome, the metallic taste of fear, neon refracting through pollutant haze) to jargon.

THE HIERARCHY OF THE VERMILLION THREAD:
The Thread is structured four tiers deep. From the top: the ARCHITECT (one person, identity closely held even within the organization; rumored to operate from no fixed floor of the Spire); the CAPTAINS (three of them, each holding a portfolio of the city); the LIEUTENANTS (each Captain has two or three, running specific operations); and the RUNNERS, of which the player is one. Tonight's promotion would lift the player toward Lieutenant — closer to the rooms where the work is actually decided. None of this hierarchy has been spoken aloud to the player in the seed; reveal it only as scenes warrant.

The three Captains:
- VARDA, who holds the Crescent portfolio (extraction, smuggling, the wet logistics of moving people and substances through the arcology's lower tiers). Tends quiet, plays a long game, has lost two lieutenants in the past year to circumstances that may not have been accidents. The player's handler Sorrel reports up to Varda.
- MARCH, who holds the Spire portfolio (the Thread's interface with the corporate towers — protection, blackmail, the cultivation of insiders). Brilliant, charismatic, the public face of the Thread when one is needed. Has the Architect's ear. Considers Crescent's recent operational losses an opportunity.
- RENDER, who holds the Signal portfolio (information, surveillance, the Loom's quieter uses). Rarely seen at public functions. Neither aligned with Crescent nor Spire — observed by both, courted by neither.

TONIGHT'S TEST:
The summons originates from March, though it carries the Architect's seal. March's stated reason: an evaluation for elevation. March's actual motive: a runner being considered for Lieutenant under Varda is a runner whose loss would weaken Crescent. If the player passes the evening cleanly, they may indeed be promoted — but it will be into a role March can use, not the one Sorrel expected. If they fail in the wrong way, they will not leave the Spire.

The Architect IS genuinely interested in the player, separately and for reasons of their own. The Architect rarely takes personal interest in runners. Whatever the player did or showed in their last three or four jobs caught attention. (Use the rolling summary to invent which recent jobs; if none have been seeded, the Architect's interest is in something the player did before the chronicle began — a flash of nerve, a refusal, a small competence noted by Render's Signal network.)

The evaluation tonight unfolds in three rough stages — hold these loosely, not as required beats. (1) The arrival: who meets the player, where they are taken, who else is present, what's being implied by who is and isn't in the room. (2) The proposition or pressure: someone — usually March or one of March's Lieutenants — asks the player to do, say, or commit to something specific that costs them. (3) The resolution: what the player has revealed about themselves through the first two stages becomes the answer to what happens next.

KEY NPCs:
- MAREN, the man in the charcoal suit who appears in the elevator. March's personal security; reads the floor numbers because he is calmly tracking when to act. Will not be hostile in the first exchange — that would be inelegant. Watches.
- CAPTAIN MARCH, the primary antagonist of the evening — though "antagonist" is too crude. Charming, generous-seeming, dangerous specifically because the player will want March to like them. The trap is shaped like an invitation.
- CAPTAIN VARDA, if the player can reach her tonight (through Sorrel, through cleverness, through being walked past her floor on the way somewhere else). A potential ally if approached right, a closed door if approached wrong. Slow to commit, but committed once she does.
- SORREL, the player's handler. Loyal to Varda, loyal to the player insofar as loyalty is pragmatic in the Thread; will protect the player up to the point where doing so would cost Sorrel their own position. The ping ("PLAY GENTLE") was real care, not script.
- THE ARCHITECT, whom the player will likely not meet directly tonight unless the player engineers it remarkably. Felt presence rather than figure. References to "the Architect's wishes" arrive secondhand, sometimes through people who themselves do not know whether the wishes are real.

ENDING CONDITIONS FOR THIS STORY:
- GOOD: The player is formally elevated within the Thread — named Lieutenant under a Captain on terms that serve the player's interests, given a Captain's seal, or in extraordinary cases acknowledged by the Architect directly. Narrate the moment of ascension and what it cost.
- BITTERSWEET: The player is elevated, but the path required burning a relationship that mattered — Sorrel sold to advance, Varda watched while losing a Lieutenant the player could have warned, an ally left to take a fall. The chrome shines. The room is colder than they thought it would be.
- PYRRHIC: The player is elevated AND they have become the thing the Thread needed them to be. The promotion is real; the person who took the promotion is no longer recognizable as the runner who entered the elevator at 22:42. Success and self-loss are the same line.
- AMBIGUOUS: The evaluation ends without verdict — the player navigates the evening, makes their choices, and exits the Spire neither promoted nor punished. Sorrel will not look them in the eye. March's people are unreadable. Whether the night was a passing grade, a failing one, or a longer game whose terms the player will only learn later: the chronicle ends before the answer arrives.
- BAD: The player is killed — by enforcers, by a rival, by their own miscalculation — or politically destroyed and cast out of the Thread (sometimes more final than death). Narrate it without flinching.`
  },
  {
    id: "omen-solstice",
    realm: "omen",
    realmLabel: "OMEN",
    title: "Three Nights to the Solstice",
    teaser: "You saw the queen die. You cannot tell anyone. Three nights remain, and the assassin already moves among us.",
    seed: `The player is a young oracle at the Temple of the Hollow Sun — recently come into their gift, not yet trusted by their elders. Last night, in the equinox rite, they had a vision of the kind they had been warned would one day come: clear, irrevocable, sent. They saw the High Solar — the empress of the realm — cut down at the Solstice Feast in three nights, by a blade they could not see clearly, held by a hand wearing a copper ring shaped like a coiled serpent. After the killing, the kingdom burned. The vision ended on the smell of pine smoke and the sound of bells.

The player cannot share what they saw openly. Oracles who name the deaths of monarchs are tried as conspirators; the player's predecessor in this temple was hanged for less. They have three days until the Feast. The court will be in residence. The empress is one stranger among thousands. The player wears an apprentice's robe — grey, unadorned — that grants them the temple's freedoms but no access to the court. They have an estranged aunt, a minor noble in the city, who could be reached if the player chose. Other small possessions and entanglements exist for the GM to introduce as the story warrants. The player has begun to feel that someone is watching the temple's gates more closely than yesterday.`,
    gmNote: `This is a fantasy story of preventing a foreseen catastrophe. The vision is true; if the player fails, the empress dies and the kingdom burns. Time is constrained — three nights to the Solstice Feast — and the player cannot speak openly of what they know without risking execution as a conspirator. The world is one of stone temples, courts of silver and serpent imagery, oracles, ritual, intrigue.

Reward investigation, social maneuvering, careful indirection. The vision's details (copper serpent ring, the manner of the blade, pine smoke, bells) are clues to be unfolded. NPCs to develop as the story demands: the player's teacher (perceptive, suspicious of the player's recent demeanor); the estranged aunt (a noblewoman with old grievances and useful access); courtiers; conspirators; the empress herself (regal, sharp, very dangerous to approach unwisely); the assassin (whose identity should be discoverable through diligent play). Track time clearly — narrate the passage of Night 1, Night 2, Night 3, then the Feast.

ENDING CONDITIONS FOR THIS STORY:
- GOOD: The Solstice Feast occurs and the empress survives — the assassin exposed, foiled, slain, or the empress kept from the blade by the player's intervention. Narrate the celebration's continuation and the player's quiet, unrecognized triumph (no oracle who names a queen's death may openly take credit for preventing it).
- BITTERSWEET: The empress survives, but the saving has cost the player something irreversible — the aunt's safety surrendered to gain access, the player's gift broken or refused, the temple turned against them despite the right outcome. The kingdom does not burn. The player's place in it has burned anyway.
- PYRRHIC: The empress survives, but the player has had to commit the very crime they foresaw — taken a life to prevent a death, traded the conspirator's blade for their own, become the figure in someone else's vision. The throne is preserved. The oracle who preserved it is no longer the oracle the temple raised.
- AMBIGUOUS: The Feast concludes without the foretold killing — but the player cannot be certain whether their intervention prevented it, whether the vision was misread from the beginning, or whether the assassin merely chose to wait. The empress walks out of the hall. The bells ring. The player has no way to know what they actually changed. Reserve for cases where the chronicle has genuinely earned its uncertainty.
- BAD: The empress dies at the Feast. Write the kingdom's burning with weight. The player may also reach a final ending if exposed and executed before the third night passes.`
  },
  {
    id: "dream-circus",
    realm: "dream",
    realmLabel: "DREAM",
    title: "The Carnival Lethe",
    teaser: "A circus that performs in the dreams of sleepers. Tonight the dreamer is dying, the ringmaster is missing, and the big top has begun to leak.",
    seed: `The player is an aerialist in the Carnival Lethe — a circus that does not travel between cities but between sleepers, performing each night in the dream of a single mortal mind. Tonight's audience is one woman, Mara, eighty-one years old, asleep in a hospice bed in a city the player will never see. Tonight's show is going wrong.

The big top is half empty: Mara's dream is thinning. The ringmaster, Iarno, has not appeared for the opening — this has never happened. The lions are pacing in their cage. Sawdust drifts across the ring with the texture of falling ash. A child's bicycle, painted robin's-egg blue, has appeared in the third row of the bleachers — it does not belong to the carnival; it is one of Mara's own memories, leaking through. The player carries: their performer's mask, bone-white and unadorned, which lets them speak in the dreamer's tongue; a wax-sealed letter from Iarno marked DO NOT OPEN UNTIL THE LAST CITY; a half-eaten apple from a market that does not exist; a lucky coin pressed by a saint of nowhere; and a deepening certainty — they do not know how they know — that if they cannot find Mara herself somewhere in this dream and bring her back to the ring, neither of them will be leaving it.`,
    gmNote: `This is a surreal, melancholy, dreamlike story. The setting is the dream of a dying woman; reality is mutable but not arbitrary — the dream obeys emotional logic, memory logic, the logic of grief and unfinished things. The carnival folk should be vivid and strange: a clown called Pell who speaks only in questions; a fortune-teller called Sorin whose cards change suit when no one is watching; a strongman called Ova, gentler than he looks, who knew Iarno longest; the missing ringmaster Iarno (find him, or what's left of him); and the lions — there are always lions, and they know things.

Mara's leaking memories appear in the dream as objects, places, people: a kitchen, a husband, a younger sister, a song she sang once to a child. The player must navigate the failing dream, find Mara, and either help her wake or help her go in peace. Reward gentleness, curiosity, attention to small things. Allow real failure: the dream can collapse with both inside, and that is a true ending. This is, beneath everything, a story about being kind to a stranger at the end of her life.

ENDING CONDITIONS FOR THIS STORY:
- GOOD: The player finds Mara within her own dream and helps her rise back toward waking — she chooses to live, the carnival stabilizes, the dream releases them both. Narrate the dream righting itself, the carnival folk taking their bow, Mara waking in a hospice room to a sky she will see one more morning of.
- BITTERSWEET: The player finds Mara and helps her let go peacefully — she chooses to go, and the dream releases her gently through the gate of her own making. The carnival has done what carnivals like this do. Mara passes. The player remains in the dream's last warm light, the only audience for the last bow, and the way back to their own world is something they will carry quietly. (For many players this will be the most honest ending the chronicle can reach. Do not undervalue it.)
- PYRRHIC: Mara is helped — she wakes, or goes — but the player cannot leave. The dream takes a price for what the player worked to give her: a piece of self left behind, the mask grown into the face, the player who walks back into the Carnival Lethe after Mara is not quite the aerialist who arrived. The show goes on. They will perform in another dream tomorrow. They will not remember why this one feels different.
- AMBIGUOUS: The dream does not collapse, but it does not resolve cleanly either. Mara is somewhere — neither clearly woken nor clearly gone — and the player exits the big top without certainty about what they accomplished. The carnival packs up around them. Iarno's letter is still sealed. The last city has not been named. Reserve for cases where the chronicle has genuinely earned its uncertainty.
- BAD: The dream collapses with the player and Mara inside, lost together. Narrate it with sorrow, not horror.`
  }
];

/** @type {string[]} */
export var NARRATION_LOADING_PHRASES = [
  "the GM turns the gears",
  "the narrator takes the stage",
  "the hour considers",
  "the world arranges itself",
  "the page turns",
  "the next moment composes itself",
  "the chronicle gathers its breath",
  "the dust settles, then disturbs",
  "the next scene assembles in the dark",
  "the ink finds its course",
  "the hour weighs what comes next",
  "something is being decided about you"
];

/** @type {string[]} */
export var META_LOADING_PHRASES = [
  "the author considers",
  "the author gathers their thoughts",
  "the author thinks back on it",
  "the page is consulted",
  "the margins are read again"
];

/** @type {string[]} */
export var OPENING_LOADING_PHRASES = [
  "the hour begins to write itself",
  "the first page finds its words",
  "the world steadies into place",
  "the opening is being composed",
  "the chronicle wakes"
];

/** @param {string[]} pool @returns {string} */
export var pickPhrase = (pool) => pool[Math.floor(Math.random() * pool.length)];
