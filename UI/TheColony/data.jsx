// TheColony — seed data for the live view
// 96×96 logical grid; we anchor a ~30×30 downtown around (0,0)
// Building footprints are in tile coordinates. Agents have tile positions.

const TILE_W = 56;   // iso tile width
const TILE_H = 28;   // iso tile height (2:1)

// ── BUILDINGS ────────────────────────────────────────────────────────────────
// kinds: factory | bank | town_hall | court | jail | bar | apartment | house
//        shop | power_plant | cafe | park | water_works | office | temple
//
// roofColor / wallColor are the dominant sprite tones.
// owner_id references an agent id. employees[] references agent ids that work there.

const BUILDINGS = [
  // ── industrial east ──
  { id:'B01', name:'Riverside Foods',  kind:'factory',     x: 4, y:-7, w:5, h:4,
    roof:'#b9722a', wall:'#7a4a25', accent:'#f0a347', owner:'A01', employees:['A02','A03','A04','A05'],
    desc:'Cannery and dry-goods plant. Smells like brine and old fryer oil.' },
  { id:'B02', name:'Tidewater Power',  kind:'power_plant', x: 9, y:-2, w:4, h:4,
    roof:'#5e5868', wall:'#3a3445', accent:'#4ec5b8', owner:'CITY', employees:['A06','A07'],
    desc:'Coal-and-tide hybrid. Hums at night, sometimes sparks.' },
  { id:'B03', name:'Hollow Mill',      kind:'factory',     x: 9, y: 3, w:4, h:3,
    roof:'#8e2738', wall:'#5a2230', accent:'#e2536e', owner:'A08', employees:['A09','A10'],
    desc:'Textile mill, mostly rough cloth and tool handles.' },

  // ── civic center ──
  { id:'B04', name:'Town Hall',        kind:'town_hall',   x:-2, y: 0, w:4, h:4,
    roof:'#4f7a3d', wall:'#c9c0a8', accent:'#f0a347', owner:'CITY', employees:['A11'],
    desc:'Bronze dome, brass bell. Council chambers and the mayor\u2019s office.' },
  { id:'B05', name:'Vance Courthouse', kind:'court',       x:-2, y: 5, w:4, h:3,
    roof:'#2c2630', wall:'#a8a08e', accent:'#9b7fd1', owner:'CITY', employees:['A12'],
    desc:'Where accusations land. Daily docket at noon.' },
  { id:'B06', name:'The Hollow',       kind:'jail',        x: 3, y: 6, w:3, h:3,
    roof:'#3a304a', wall:'#5e5868', accent:'#e2536e', owner:'CITY', employees:['A13'],
    desc:'Six cells. Currently two occupants.' },

  // ── financial north ──
  { id:'B07', name:'Eastside Bank',    kind:'bank',        x:-2, y:-6, w:4, h:3,
    roof:'#1f5660', wall:'#cdb98a', accent:'#f0a347', owner:'A14', employees:['A15','A16'],
    desc:'Vault rated for two armed men and a bookkeeper.' },
  { id:'B08', name:'Goff & Co.',       kind:'office',      x: 3, y:-3, w:3, h:3,
    roof:'#7a4a25', wall:'#b8a87a', accent:'#f0a347', owner:'A17', employees:['A18'],
    desc:'Accounting, contracts, the occasional forgery.' },

  // ── residential west ──
  { id:'B09', name:'Marrow & Oak',     kind:'apartment',   x:-9, y:-5, w:3, h:5,
    roof:'#4f7a3d', wall:'#a08a6a', accent:'#f0a347', owner:'A14', employees:[],
    desc:'18 units, leaky pipes, an excellent stairwell.' },
  { id:'B10', name:'Pier Apartments',  kind:'apartment',   x:-9, y: 2, w:3, h:5,
    roof:'#8e2738', wall:'#9a8a72', accent:'#e2536e', owner:'A17', employees:[],
    desc:'Cheaper. Riverwall side. Damp in winter.' },
  { id:'B11', name:'Vance Manor',      kind:'house_big',   x:-6, y: 8, w:3, h:3,
    roof:'#1f7c75', wall:'#ece6d3', accent:'#b9722a', owner:'A14', employees:[],
    desc:'White stone, iron gate. The only address with its own well.' },
  { id:'B12', name:'Dust House',       kind:'house',       x:-4, y:-9, w:2, h:2,
    roof:'#b9722a', wall:'#8a7a5e', accent:'#f0a347', owner:'A19', employees:[],
    desc:'Two rooms, one stove. Cy and three followers sleep on the floor.' },
  { id:'B13', name:'Hex House',        kind:'house',       x:-1, y:-9, w:2, h:2,
    roof:'#4f7a3d', wall:'#9a8a6a', accent:'#95b876', owner:'A20', employees:[],
    desc:'Greenhouse out back. Isa grows winter tomatoes.' },

  // ── commercial / nightlife ──
  { id:'B14', name:'The Lantern',      kind:'bar',         x: 0, y:-3, w:2, h:2,
    roof:'#b9722a', wall:'#4a3320', accent:'#ffc26b', owner:'A21', employees:['A22'],
    desc:'Whiskey, gossip, and a piano nobody tunes.' },
  { id:'B15', name:'Goff General',     kind:'shop',        x: 3, y: 1, w:2, h:2,
    roof:'#4f7a3d', wall:'#c0a878', accent:'#f0a347', owner:'A17', employees:['A23'],
    desc:'Salt, soap, twine, and stale newspapers.' },
  { id:'B16', name:'Cup & Saucer',     kind:'cafe',        x:-4, y: 2, w:2, h:2,
    roof:'#9b7fd1', wall:'#d9c8a4', accent:'#4ec5b8', owner:'A24', employees:[],
    desc:'Three tables. The good coffee comes in on Thursdays.' },

  // ── water + park ──
  { id:'B17', name:'Wellspring Works', kind:'water_works', x: 6, y: 8, w:3, h:3,
    roof:'#1f7c75', wall:'#3a8a8a', accent:'#4ec5b8', owner:'CITY', employees:['A25'],
    desc:'Pulls from the river, settles it, sells it back.' },
  { id:'B18', name:'Bell Park',        kind:'park',        x:-7, y:-1, w:3, h:2,
    roof:'#5b7a45', wall:'#5b7a45', accent:'#95b876', owner:'CITY', employees:[],
    desc:'Two benches, one bell tower, a crow named by no one.' },
];

// ── AGENTS ───────────────────────────────────────────────────────────────────
// trait scales 0..1. needs 0..100. balance in cents.
// hair/skin/clothes are simple SVG sprite palettes.
//
// home_id: where they sleep. work_id: where they earn wages.
// pos initialized at home; the sim loop reassigns targets.

function trait(g,r,e,a,s) { return { greed:g, risk:r, empathy:e, ambition:a, sociability:s }; }

const AGENTS = [
  { id:'A01', name:'Mara Vex',         age:46, occ:'Foreman, Riverside Foods', home:'B11', work:'B01',
    balance: 187_400_00, status:'alive', mood:-14,
    traits: trait(0.81,0.62,0.18,0.78,0.55),
    ideology:'Order. Markets. Loyalty bought is loyalty earned.',
    hair:'#1c1925', skin:'#d8b594', shirt:'#8e2738', pants:'#1c1925',
    bio:'Ran the cannery before her father died, still runs it. Fires fast, pays late, remembers everything.',
    flags:['fired_4_today'],
  },
  { id:'A02', name:'Lin Okafor',       age:31, occ:'Line worker (fired)',      home:'B10', work:null,
    balance: 142_00, status:'alive', mood:-38,
    traits: trait(0.42,0.41,0.71,0.5,0.6),
    ideology:'People before profit. Always.',
    hair:'#2a1f30', skin:'#7a4e34', shirt:'#4ec5b8', pants:'#2c2630',
    bio:'Eight years on the cannery line. Two kids in Pier Apartments. Owed Mara nothing and got fired anyway.',
  },
  { id:'A03', name:'Theo Vance',       age:58, occ:'Bank president',           home:'B11', work:'B07',
    balance: 942_800_00, status:'alive', mood: 6,
    traits: trait(0.74,0.31,0.34,0.72,0.45),
    ideology:'Capital is patient. People are not.',
    hair:'#a8a08e', skin:'#e0c4a4', shirt:'#1f5660', pants:'#332a3f',
    bio:'Owns the bank, the manor, and most of the residential west side. Brother of the old judge.',
  },
  { id:'A04', name:'Cy Brennan',       age:34, occ:'Preacher (unlicensed)',    home:'B12', work:null,
    balance: 8_40, status:'alive', mood: 22,
    traits: trait(0.18,0.78,0.45,0.91,0.85),
    ideology:'The Dust returns to dust. So do banks.',
    hair:'#b9722a', skin:'#c8a784', shirt:'#332a3f', pants:'#7a4a25',
    bio:'Founded Children of the Dust last spring. Speaks every dusk by the bell. Eleven followers and counting.',
  },
  { id:'A05', name:'Juno Park',        age:29, occ:'Bartender, The Lantern',   home:'B10', work:'B14',
    balance: 2_140_00, status:'alive', mood: 11,
    traits: trait(0.35,0.55,0.62,0.45,0.88),
    ideology:'Listen first. Pour second. Believe nothing.',
    hair:'#1c1925', skin:'#d2a87a', shirt:'#b9722a', pants:'#2c2630',
    bio:'Knows what every drunk in the city owes every other drunk. Trades information like coin.',
  },
  { id:'A06', name:'Wren Aoki',        age:22, occ:'Homeless',                 home:null, work:null,
    balance: 0, status:'alive', mood:-25,
    traits: trait(0.68,0.82,0.41,0.4,0.32),
    ideology:'Whatever feeds me tonight.',
    hair:'#332a3f', skin:'#c8a78a', shirt:'#5e5868', pants:'#3a304a',
    bio:'Three warrants. Sleeps under the bell tower most nights. Picked Theo\u2019s pocket last week and got away with it.',
    flags:['wanted'],
  },
  { id:'A07', name:'Nico Reyes',       age:51, occ:'Mayor',                    home:'B11', work:'B04',
    balance: 28_400_00, status:'alive', mood: 4,
    traits: trait(0.4,0.35,0.62,0.7,0.78),
    ideology:'The city is what we agree it is, again, every morning.',
    hair:'#5e5868', skin:'#b9956a', shirt:'#4f7a3d', pants:'#332a3f',
    bio:'Second term. Inherited a budget shortfall. Quietly negotiating with Theo for a loan against the courthouse.',
  },
  { id:'A08', name:'Isa Doroshenko',   age:38, occ:'Florist',                  home:'B13', work:null,
    balance: 4_120_00, status:'alive', mood: 14,
    traits: trait(0.22,0.28,0.84,0.42,0.66),
    ideology:'Tend something or you\u2019ll harden.',
    hair:'#b9722a', skin:'#e2c4a0', shirt:'#95b876', pants:'#4a3320',
    bio:'Sells from a cart by the bell park. Cy sometimes preaches under her awning; she lets him.',
  },
  { id:'A09', name:'Pen Goff',         age:14, occ:'Shop runner',              home:'B10', work:'B15',
    balance: 18_40, status:'alive', mood: 2,
    traits: trait(0.5,0.7,0.55,0.6,0.62),
    ideology:'I\u2019m fourteen. I have opinions.',
    hair:'#1c1925', skin:'#c8a78a', shirt:'#f0a347', pants:'#332a3f',
    bio:'Otto Goff\u2019s kid. Runs the counter when her father is drunk, which is most days.',
  },
  { id:'A10', name:'Otto Brunn',       age:62, occ:'Poet (debtor)',            home:'B10', work:null,
    balance: -8_400_00, status:'bankrupt', mood:-44,
    traits: trait(0.3,0.6,0.5,0.25,0.7),
    ideology:'I keep my promises in iambic. Pentameter, sometimes.',
    hair:'#a8a08e', skin:'#cdb098', shirt:'#2c2630', pants:'#332a3f',
    bio:'Owes Theo\u2019s bank seventy weeks of rent. Recites at the Lantern for drinks. Has a child somewhere west.',
    flags:['debt_critical'],
  },
  { id:'A11', name:'Halle Tide',       age:27, occ:'Engineer, Tidewater',      home:'B09', work:'B02',
    balance: 6_840_00, status:'alive', mood: 9,
    traits: trait(0.4,0.45,0.6,0.65,0.55),
    ideology:'Systems first. Politics second. Both real.',
    hair:'#4ec5b8', skin:'#d8b594', shirt:'#1f5660', pants:'#1c1925',
    bio:'Keeps the lights on. Quietly in love with Juno. Has not said so.',
  },
  { id:'A12', name:'Bram Halloran',    age:71, occ:'Judge',                    home:'B11', work:'B05',
    balance: 38_400_00, status:'alive', mood:-2,
    traits: trait(0.45,0.2,0.55,0.6,0.4),
    ideology:'The law must be slow, or it isn\u2019t the law.',
    hair:'#ece6d3', skin:'#e8c8a4', shirt:'#332a3f', pants:'#1c1925',
    bio:'Forty-two years on the bench. Sentenced Wren\u2019s mother once. Doesn\u2019t remember her name.',
  },
  { id:'A13', name:'Sasha Quill',      age:33, occ:'Jailer',                   home:'B10', work:'B06',
    balance: 1_640_00, status:'alive', mood:-8,
    traits: trait(0.55,0.4,0.3,0.45,0.35),
    ideology:'I just lock the doors.',
    hair:'#332a3f', skin:'#c8a78a', shirt:'#5e5868', pants:'#3a304a',
    bio:'Cousin to Mara. Owes her a favor and knows it.',
  },
  { id:'A14', name:'Rook Madsen',      age:41, occ:'Stevedore',                home:'B09', work:'B01',
    balance: 920_00, status:'alive', mood:-18,
    traits: trait(0.4,0.55,0.55,0.4,0.5),
    ideology:'Union or rope. There is no third option.',
    hair:'#1c1925', skin:'#8a5a3a', shirt:'#4f7a3d', pants:'#2c2630',
    bio:'Talking quietly about a strike. Got fired this morning anyway.',
    flags:['fired_today','rising_anger'],
  },
  { id:'A15', name:'Min Sato',         age:24, occ:'Mill worker',              home:'B10', work:'B03',
    balance: 412_00, status:'alive', mood: 3,
    traits: trait(0.35,0.35,0.6,0.5,0.7),
    ideology:'Save. Save. Save.',
    hair:'#2c2630', skin:'#d8b594', shirt:'#9b7fd1', pants:'#332a3f',
    bio:'Sends money home to a sister in the southern outlands. Has not seen her in six years.',
  },
];

// quick id -> agent map
const AGENT_BY_ID = Object.fromEntries(AGENTS.map(a => [a.id, a]));
const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map(b => [b.id, b]));

// ── RELATIONSHIPS (for drawer) ───────────────────────────────────────────────
const RELATIONSHIPS = {
  A01: [ // Mara
    { other:'A03', affinity: 32, trust: 18, tags:['ally','creditor'] },
    { other:'A02', affinity:-44, trust:-30, tags:['fired'] },
    { other:'A14', affinity:-58, trust:-20, tags:['fired','threat'] },
    { other:'A13', affinity: 12, trust: 35, tags:['family','owed_favor'] },
  ],
  A02: [ // Lin
    { other:'A01', affinity:-72, trust:-80, tags:['ex_boss','grudge'] },
    { other:'A14', affinity: 38, trust: 44, tags:['fellow_fired'] },
    { other:'A05', affinity: 22, trust: 28, tags:['friend'] },
    { other:'A09', affinity: 18, trust: 25, tags:['kindness'] },
  ],
  A04: [ // Cy
    { other:'A08', affinity: 41, trust: 30, tags:['protector'] },
    { other:'A06', affinity: 28, trust: 12, tags:['recruit?'] },
    { other:'A03', affinity:-62, trust:-40, tags:['enemy_of_doctrine'] },
  ],
};

// ── EVENTS — seeded firehose ─────────────────────────────────────────────────
// importance 0..10; UI prominence scales with it.
// kind drives the dot color and routing.
const SEED_EVENTS = [
  { id:1,  t:'09:14', kind:'fire',     importance:9,
    body:[{a:'A01'},' fired four workers at ',{b:'B01'},'. Production halted briefly.'] },
  { id:2,  t:'09:16', kind:'speak',    importance:6,
    body:[{a:'A14'},' (outside ',{b:'B01'},'): \u201cTalk to me about a strike. Tonight. The Lantern.\u201d'] },
  { id:3,  t:'09:22', kind:'trade',    importance:5,
    body:['Cloth lot of 80 cleared at $2.40 \u2014 ',{a:'A03'},' filled both sides.'] },
  { id:4,  t:'09:31', kind:'crime',    importance:7,
    body:[{a:'A06'},' lifted $14 from a cart outside ',{b:'B15'},'. Witness: ',{a:'A09'},'.'] },
  { id:5,  t:'09:34', kind:'reflect',  importance:3,
    body:[{a:'A04'},' began a sermon in ',{b:'B18'},'. Six listeners.'] },
  { id:6,  t:'09:40', kind:'meet',     importance:4,
    body:[{a:'A02'},' met ',{a:'A05'},' at ',{b:'B14'},'. They spoke for nine minutes.'] },
  { id:7,  t:'09:48', kind:'wage',     importance:3,
    body:['Daily wages disbursed at ',{b:'B02'},'. Treasury \u2212$420.'] },
  { id:8,  t:'09:55', kind:'death',    importance:10,
    body:[{a:'A10'},' collapsed near ',{b:'B16'},'. Cause: pending. Last words logged.'] },
  { id:9,  t:'10:02', kind:'court',    importance:6,
    body:[{a:'A12'},' adjourned the morning docket. ',{a:'A06'},'\u2019s third warrant filed.'] },
];

// expose to other scripts
Object.assign(window, {
  TILE_W, TILE_H,
  BUILDINGS, AGENTS, AGENT_BY_ID, BUILDING_BY_ID,
  RELATIONSHIPS, SEED_EVENTS,
});
