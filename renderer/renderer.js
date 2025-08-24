// renderer/renderer.js

const openFolderBtn = document.getElementById('openFolderBtn');
const loadRosterBtn = document.getElementById('loadRosterBtn');
const showInFolderBtn = document.getElementById('showInFolderBtn');
const openDirBtn = document.getElementById('openDirBtn');
const folderPathEl = document.getElementById('folderPath');
const fileCounterEl = document.getElementById('fileCounter');
const toggleListBtn = document.getElementById('toggleListBtn');
const listPanel = document.getElementById('listPanel');
const closeListBtn = document.getElementById('closeListBtn');
const listSearchInput = document.getElementById('listSearchInput');
const listSortSelect = document.getElementById('listSortSelect');
const listSortDir = document.getElementById('listSortDir');
const listSizeMin = document.getElementById('listSizeMin');
const listSizeMax = document.getElementById('listSizeMax');
const listHasTagsCheckbox = document.getElementById('listHasTagsCheckbox');
const listExtContainer = document.getElementById('listExtContainer');
const fileListContainer = document.getElementById('fileListContainer');
const listCountEl = document.getElementById('listCountEl');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');

const videoEl = document.getElementById('video');
const playPauseBtn = document.getElementById('playPauseBtn');
const muteBtn = document.getElementById('muteBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const deleteBtn = document.getElementById('deleteBtn');

const currentNameEl = document.getElementById('currentName');
const seekEl = document.getElementById('seek');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');

const renameOverlay = document.getElementById('renameOverlay');
const renameInput = document.getElementById('renameInput');
const tagOverlay = document.getElementById('tagOverlay');
const tagInput = document.getElementById('tagInput');
const tagSuggestions = document.getElementById('tagSuggestions');
const currentTagsEl = document.getElementById('currentTags');
const detailsOverlay = document.getElementById('detailsOverlay');
const detailsInput = document.getElementById('detailsInput');

const toastEl = document.getElementById('toast');
const splashOverlay = document.getElementById('splashOverlay');
const splashUseBamaBtn = document.getElementById('splashUseBamaBtn');
const splashImportRosterBtn = document.getElementById('splashImportRosterBtn');
const splashSkipRosterBtn = document.getElementById('splashSkipRosterBtn');
const splashFootageOpenBtn = document.getElementById('splashFootageOpenBtn');
const copyRosterTemplateBtn = document.getElementById('copyRosterTemplateBtn');
// New onboarding controls
const splashStartBtn = document.getElementById('splashStartBtn');
const splashShortcutsContinueBtn = document.getElementById('splashShortcutsContinueBtn');

let DIR = null;
let FILES = [];
let index = 0;
let FILES_META = new Map(); // path -> { sizeBytes, mtimeMs, ext }
let FILTERS = { q: '', sort: 'name', dir: 'asc', sizeMin: null, sizeMax: null, exts: new Set(), hasTags: false };

let isRenaming = false;
let seeking = false;
let wasPlayingBeforeSeek = false;
let _seekPointerId = null;
let _seekRect = null;
let isTagging = false;
let isEnteringDetails = false;
let ROSTER = null; // {team, season, players: []}
let currentTags = []; // array of player objects currently tagged for the active file (not persisted globally)
let fileTagCache = new Map(); // path -> array of player objects to allow revisiting

function updateSplashVisibility() {
  const haveFiles = FILES && FILES.length > 0;
  if (haveFiles) {
    splashOverlay?.classList.add('hidden');
    document.body.classList.remove('onboarding-active');
  } else {
    splashOverlay?.classList.remove('hidden');
    document.body.classList.add('onboarding-active');
  }
}

/* ===== Onboarding State ===== */
let ONBOARD_STEP = 0; // 0..3
function renderOnboardingStep() {
  const steps = document.querySelectorAll('.onboard-step');
  steps.forEach(s => {
    const n = Number(s.getAttribute('data-step'));
    if (n === ONBOARD_STEP) s.classList.remove('hidden');
    else s.classList.add('hidden');
  });
  const dots = document.querySelectorAll('.splash-progress .dot');
  dots.forEach(d => {
    const n = Number(d.getAttribute('data-step'));
    d.classList.toggle('active', n === ONBOARD_STEP);
    d.classList.toggle('done', n < ONBOARD_STEP);
  });
}
function setOnboardStep(n) {
  ONBOARD_STEP = Math.max(0, Math.min(3, n));
  renderOnboardingStep();
}
function finishOnboarding() {
  splashOverlay?.classList.add('hidden');
  document.body.classList.remove('onboarding-active');
}

// Built-in Alabama roster
const BAMA_ROSTER = {
  team: "Alabama Crimson Tide",
  season: 2025,
  players: [
    { "number": "0", "name": "AK Dear", "position": "RB", "height": "6' 1\"", "weight_lbs": "212", "class": "Fr.", "hometown": "Quitman, Miss. / Quitman" },
    { "number": "0", "name": "Deontae Lawson", "position": "LB", "height": "6' 2\"", "weight_lbs": "228", "class": "R-Sr.", "hometown": "Mobile, Ala. / Mobile Christian" },
    { "number": "1", "name": "Isaiah Horton", "position": "WR", "height": "6' 4\"", "weight_lbs": "208", "class": "R-Jr.", "hometown": "Nashville, Tenn. / Oakland", "previous_school": "Miami" },
    { "number": "1", "name": "Domani Jackson", "position": "DB", "height": "6' 1\"", "weight_lbs": "196", "class": "Sr.", "hometown": "San Diego, Calif. / Mater Dei", "previous_school": "USC" },
    { "number": "2", "name": "Zabien Brown", "position": "DB", "height": "6' 0\"", "weight_lbs": "192", "class": "So.", "hometown": "Santa Ana, Calif. / Mater Dei" },
    { "number": "2", "name": "Ryan Williams", "position": "WR", "height": "6' 0\"", "weight_lbs": "178", "class": "So.", "hometown": "Mobile, Ala. / Saraland" },
    { "number": "3", "name": "Jaylen Mbakwe", "position": "WR", "height": "5' 11\"", "weight_lbs": "190", "class": "So.", "hometown": "Clay, Ala. / Clay-Chalkville" },
    { "number": "3", "name": "Keon Sabb", "position": "DB", "height": "6' 1\"", "weight_lbs": "204", "class": "R-Jr.", "hometown": "Glassboro, N.J. / IMG Academy", "previous_school": "Michigan" },
    { "number": "4", "name": "Daniel Hill", "position": "RB", "height": "6' 1\"", "weight_lbs": "244", "class": "So.", "hometown": "Meridian, Miss. / Meridian" },
    { "number": "4", "name": "Qua Russaw", "position": "LB", "height": "6' 2\"", "weight_lbs": "243", "class": "R-So.", "hometown": "Montgomery, Ala. / Carver" },
    { "number": "5", "name": "Germie Bernard", "position": "WR", "height": "6' 1\"", "weight_lbs": "204", "class": "Sr.", "hometown": "Las Vegas, Nev. / Liberty", "previous_school": "Michigan State / Washington" },
    { "number": "5", "name": "Dijon Lee Jr.", "position": "DB", "height": "6' 4\"", "weight_lbs": "202", "class": "Fr.", "hometown": "Carson, Calif. / Mission Viejo" },
    { "number": "6", "name": "Aeryn Hampton", "position": "WR", "height": "5' 10\"", "weight_lbs": "195", "class": "R-Fr.", "hometown": "Daingerfield, Texas / Daingerfield" },
    { "number": "6", "name": "Kameron Howard", "position": "DB", "height": "5' 11\"", "weight_lbs": "195", "class": "R-So.", "hometown": "Clinton, Md. / Saint Frances Academy", "previous_school": "Charlotte" },
    { "number": "7", "name": "Cole Adams", "position": "WR", "height": "5' 10\"", "weight_lbs": "183", "class": "R-So.", "hometown": "Owasso, Okla. / Owasso" },
    { "number": "7", "name": "DaShawn Jones", "position": "DB", "height": "6' 0\"", "weight_lbs": "190", "class": "R-Sr.", "hometown": "Baltimore, Md. / Mount Saint Joseph", "previous_school": "Wake Forest" },
    { "number": "8", "name": "Jalen Hale", "position": "WR", "height": "6' 1\"", "weight_lbs": "197", "class": "R-So.", "hometown": "Longview, Texas / Longview" },
    { "number": "8", "name": "Justin Hill", "position": "LB", "height": "6' 3\"", "weight_lbs": "242", "class": "Fr.", "hometown": "Cincinnati, Ohio / Winton Woods" },
    { "number": "9", "name": "Cam Calhoun", "position": "DB", "height": "6' 0\"", "weight_lbs": "180", "class": "R-So.", "hometown": "Cincinnati, Ohio / Winton Woods", "previous_school": "Michigan / Utah" },
    { "number": "9", "name": "Richard Young", "position": "RB", "height": "5' 11\"", "weight_lbs": "212", "class": "R-So.", "hometown": "Lehigh Acres, Fla. / Lehigh Senior" },
    { "number": "10", "name": "Justin Jefferson", "position": "LB", "height": "6' 1\"", "weight_lbs": "227", "class": "R-Sr.", "hometown": "Memphis, Tenn. / Bartlett", "previous_school": "Pearl River C.C." },
    { "number": "10", "name": "Austin Mack", "position": "QB", "height": "6' 6\"", "weight_lbs": "235", "class": "R-So.", "hometown": "Loomis, Calif. / Folsom", "previous_school": "Washington" },
    { "number": "11", "name": "Jordan Renaud", "position": "DL", "height": "6' 4\"", "weight_lbs": "265", "class": "R-So.", "hometown": "Sarasota, Fla. / Tyler Legacy" },
    { "number": "11", "name": "Rico Scott", "position": "WR", "height": "6' 0\"", "weight_lbs": "196", "class": "R-Fr.", "hometown": "Harrisburg, Pa. / Bishop McDevitt" },
    { "number": "12", "name": "Zavier Mincey", "position": "DB", "height": "6' 3\"", "weight_lbs": "205", "class": "So.", "hometown": "Daytona Beach, Fla. / Mainland" },
    { "number": "12", "name": "Keelon Russell", "position": "QB", "height": "6' 3\"", "weight_lbs": "194", "class": "Fr.", "hometown": "Duncanville, Texas / Duncanville" },
    { "number": "13", "name": "John Gazzaniga", "position": "QB", "height": "6' 7\"", "weight_lbs": "252", "class": "Fr.", "hometown": "Rancho Santa Margarita, Calif. / Rancho Santa Margarita" },
    { "number": "13", "name": "Ivan Taylor", "position": "DB", "height": "6' 0\"", "weight_lbs": "194", "class": "Fr.", "hometown": "Winter Garden, Fla. / West Orange" },
    { "number": "14", "name": "Fatutoa Henry", "position": "DL", "height": "6' 4\"", "weight_lbs": "268", "class": "R-Jr.", "hometown": "Lawndale, Calif. / Leuzinger", "previous_school": "Oklahoma / Cerritos C.C." },
    { "number": "14", "name": "Marshall Pritchett", "position": "TE", "height": "6' 5\"", "weight_lbs": "248", "class": "Fr.", "hometown": "Charleston, S.C. / Rabun Gap-Nacoochee School" },
    { "number": "15", "name": "Duke Johnson II", "position": "LB", "height": "6' 1\"", "weight_lbs": "225", "class": "Fr.", "hometown": "Eastman, Ga. / Dodge County" },
    { "number": "15", "name": "Ty Simpson", "position": "QB", "height": "6' 2\"", "weight_lbs": "208", "class": "R-Jr.", "hometown": "Martin, Tenn. / Westview" },
    { "number": "16", "name": "Cade Carruth", "position": "QB", "height": "6' 1\"", "weight_lbs": "215", "class": "Sr.", "hometown": "Trussville, Ala. / Hewitt-Trussville" },
    { "number": "16", "name": "Red Morgan", "position": "DB", "height": "6' 0\"", "weight_lbs": "185", "class": "So.", "hometown": "Phenix City, Ala. / Central" },
    { "number": "17", "name": "Lotzeir Brooks", "position": "WR", "height": "5' 9\"", "weight_lbs": "191", "class": "Fr.", "hometown": "Millville, N.J. / Millville" },
    { "number": "17", "name": "Kelby Collins", "position": "DL", "height": "6' 4\"", "weight_lbs": "275", "class": "Jr.", "hometown": "Gardendale, Ala. / Gardendale", "previous_school": "Florida" },
    { "number": "18", "name": "Bray Hubbard", "position": "DB", "height": "6' 2\"", "weight_lbs": "213", "class": "Jr.", "hometown": "Ocean Springs, Miss. / Ocean Springs" },
    { "number": "19", "name": "John Cooper", "position": "QB", "height": "6' 2\"", "weight_lbs": "195", "class": "So.", "hometown": "Mountain Brook, Ala. / Mountain Brook" },
    { "number": "19", "name": "Chuck McDonald III", "position": "DB", "height": "6' 1\"", "weight_lbs": "194", "class": "Fr.", "hometown": "Santa Ana, Calif. / Mater Dei" },
    { "number": "20", "name": "Jah-Marien Latham", "position": "LB", "height": "6' 3\"", "weight_lbs": "262", "class": "Gr.", "hometown": "Reform, Ala. / Pickens County" },
    { "number": "20", "name": "Dre Washington", "position": "RB", "height": "5' 9\"", "weight_lbs": "216", "class": "R-Sr.", "hometown": "Hemphill, Texas / Hemphill", "previous_school": "Louisiana" },
    { "number": "21", "name": "Dre Kirkpatrick Jr.", "position": "DB", "height": "5' 11\"", "weight_lbs": "202", "class": "So.", "hometown": "Gadsden, Ala. / Gadsden City" },
    { "number": "22", "name": "LT Overton", "position": "DL", "height": "6' 5\"", "weight_lbs": "278", "class": "Sr.", "hometown": "Milton, Ga. / Milton", "previous_school": "Texas A&M" },
    { "number": "23", "name": "MJ Chirgwin", "position": "WR", "height": "6' 0\"", "weight_lbs": "190", "class": "R-Sr.", "hometown": "Huntington Beach, Calif. / Huntington Beach" },
    { "number": "23", "name": "James Smith", "position": "DL", "height": "6' 3\"", "weight_lbs": "297", "class": "Jr.", "hometown": "Montgomery, Ala. / Carver" },
    { "number": "24", "name": "Noah Carter", "position": "LB", "height": "6' 4\"", "weight_lbs": "243", "class": "R-Fr.", "hometown": "Peoria, Ariz. / Centennial" },
    { "number": "25", "name": "Steve Bolo Mboumoua", "position": "DL", "height": "6' 4\"", "weight_lbs": "302", "class": "So.", "hometown": "Saint Augustin de Desmaures, Quebec / Notre Dame de Foy", "previous_school": "Southwest Mississippi C.C." },
    { "number": "26", "name": "Luke Metz", "position": "LB", "height": "6' 3\"", "weight_lbs": "230", "class": "Fr.", "hometown": "Hoschton, Ga. / Mill Creek" },
    { "number": "26", "name": "Jam Miller", "position": "RB", "height": "5' 10\"", "weight_lbs": "221", "class": "Sr.", "hometown": "Tyler, Texas / Tyler Legacy" },
    { "number": "27", "name": "Michael Lorino III", "position": "RB", "height": "6' 0\"", "weight_lbs": "190", "class": "Sr.", "hometown": "Birmingham, Ala. / Mountain Brook" },
    { "number": "27", "name": "Walter Sansing III", "position": "DB", "height": "5' 10\"", "weight_lbs": "180", "class": "Jr.", "hometown": "Homewood, Ala. / Homewood" },
    { "number": "28", "name": "Kevin Riley", "position": "RB", "height": "5' 11\"", "weight_lbs": "191", "class": "R-Fr.", "hometown": "Northport, Ala. / Tuscaloosa County" },
    { "number": "28", "name": "Peyton Yates", "position": "DB", "height": "5' 10\"", "weight_lbs": "190", "class": "Sr.", "hometown": "Eads, Tenn. / Briarcrest Christian" },
    { "number": "29", "name": "Fredrick Moore", "position": "RB", "height": "5' 9\"", "weight_lbs": "175", "class": "So.", "hometown": "Cypress, Texas / Bridgeland" },
    { "number": "29", "name": "Kolby Peavy", "position": "DB", "height": "6' 1\"", "weight_lbs": "190", "class": "Jr.", "hometown": "Monroeville, Ala. / Excel" },
    { "number": "30", "name": "Cayden Jones", "position": "LB", "height": "6' 4\"", "weight_lbs": "228", "class": "So.", "hometown": "Asheville, N.C. / Christ School" },
    { "number": "30", "name": "Derek Meadows", "position": "WR", "height": "6' 5\"", "weight_lbs": "212", "class": "Fr.", "hometown": "Las Vegas, Nev. / Bishop Gorman" },
    { "number": "31", "name": "Keon Keeley", "position": "DL", "height": "6' 5\"", "weight_lbs": "282", "class": "R-So.", "hometown": "Tampa, Fla. / Berkeley Prep" },
    { "number": "31", "name": "Cooper Mollison", "position": "WR", "height": "5' 10\"", "weight_lbs": "185", "class": "So.", "hometown": "Vestavia Hills, Ala. / Vestavia Hills" },
    { "number": "31", "name": "Conor Talty", "position": "PK", "height": "6' 1\"", "weight_lbs": "195", "class": "R-So.", "hometown": "Chicago, Ill. / Saint Rita" },
    { "number": "32", "name": "Alex Asparuhov", "position": "P", "height": "6' 3\"", "weight_lbs": "200", "class": "Fr.", "hometown": "Fresno, Calif. / San Joaquin Memorial" },
    { "number": "32", "name": "Griffin Hanson", "position": "DB", "height": "5' 10\"", "weight_lbs": "175", "class": "So.", "hometown": "Florence, Ala. / Mars Hill Bible School" },
    { "number": "32", "name": "Jay Loper Jr.", "position": "WR", "height": "5' 11\"", "weight_lbs": "185", "class": "Sr.", "hometown": "Daphne, Ala. / Bayside Academy" },
    { "number": "33", "name": "Kyle Clayton", "position": "DB", "height": "6' 0\"", "weight_lbs": "190", "class": "Fr.", "hometown": "Chicago, Ill. / Saint Rita" },
    { "number": "34", "name": "London Hill", "position": "DB", "height": "5' 11\"", "weight_lbs": "176", "class": "Fr.", "hometown": "Mobile, Ala. / McGill-Toolen" },
    { "number": "34", "name": "Jessie Washington III", "position": "RB", "height": "5' 9\"", "weight_lbs": "205", "class": "Jr.", "hometown": "Milledgeville, Ga. / Georgia Military College High School" },
    { "number": "35", "name": "Abduall Sanders Jr.", "position": "LB", "height": "6' 2\"", "weight_lbs": "231", "class": "Fr.", "hometown": "Santa Ana, Calif. / Mater Dei" },
    { "number": "36", "name": "QB Reese", "position": "LB", "height": "6' 0\"", "weight_lbs": "224", "class": "R-Fr.", "hometown": "Birmingham, Ala. / Ramsay" },
    { "number": "37", "name": "Cole Davis", "position": "DB", "height": "6' 0\"", "weight_lbs": "195", "class": "So.", "hometown": "Walterboro, S.C. / Colleton Prep Academy" },
    { "number": "37", "name": "Peter Notaro", "position": "PK", "height": "5' 11\"", "weight_lbs": "188", "class": "Fr.", "hometown": "Wexford, Pa. / North Allegheny" },
    { "number": "38", "name": "Blake Doud", "position": "P", "height": "6' 5\"", "weight_lbs": "205", "class": "R-Sr.", "hometown": "Parker, Colo. / Legend", "previous_school": "Colorado School of Mines" },
    { "number": "38", "name": "Brody McCutcheon", "position": "DB", "height": "6' 1\"", "weight_lbs": "178", "class": "Fr.", "hometown": "Moody, Ala. / Moody" },
    { "number": "39", "name": "Jake Ivie", "position": "LB", "height": "6' 0\"", "weight_lbs": "200", "class": "Jr.", "hometown": "Alabaster, Ala. / Thompson" },
    { "number": "40", "name": "Grant Johnson", "position": "LB", "height": "6' 0\"", "weight_lbs": "220", "class": "Jr.", "hometown": "Casa Grande, Calif. / Casa Grande Union", "previous_school": "Arizona State" },
    { "number": "41", "name": "Nikhai Hill-Green", "position": "LB", "height": "6' 2\"", "weight_lbs": "235", "class": "Gr.", "hometown": "Pittsburgh, Pa. / Saint Frances Academy", "previous_school": "Michigan / Charlotte / Colorado" },
    { "number": "42", "name": "Ben Jackson", "position": "WR", "height": "6' 2\"", "weight_lbs": "170", "class": "Fr.", "hometown": "Mobile, Ala. / Murphy" },
    { "number": "42", "name": "Yhonzae Pierre", "position": "LB", "height": "6' 3\"", "weight_lbs": "248", "class": "R-So.", "hometown": "Eufaula, Ala. / Eufaula" },
    { "number": "45", "name": "David Bird", "position": "SN", "height": "6' 0\"", "weight_lbs": "205", "class": "Jr.", "hometown": "Phoenix, Ariz. / Sandra Day O’Connor", "previous_school": "Cal" },
    { "number": "46", "name": "Peyton Fox", "position": "TE", "height": "6' 4\"", "weight_lbs": "250", "class": "Sr.", "hometown": "Pelham, Ala. / Briarwood Christian" },
    { "number": "46", "name": "Jay Williams", "position": "SN", "height": "6' 0\"", "weight_lbs": "195", "class": "So.", "hometown": "Ringgold, Ga. / Heritage" },
    { "number": "48", "name": "Prince Butler", "position": "DB", "height": "6' 1\"", "weight_lbs": "205", "class": "R-Sr.", "hometown": "Alexandria, Va. / Hayfield" },
    { "number": "49", "name": "Conner Warhurst", "position": "DB", "height": "6' 2\"", "weight_lbs": "210", "class": "Jr.", "hometown": "Russellville, Ala. / Russellville" },
    { "number": "50", "name": "Casey Poe", "position": "OL", "height": "6' 4\"", "weight_lbs": "322", "class": "R-Fr.", "hometown": "Lindale, Texas / Lindale" },
    { "number": "52", "name": "Alex Rozier", "position": "SN", "height": "6' 4\"", "weight_lbs": "205", "class": "Sr.", "hometown": "Hattiesburg, Miss. / Oak Grove" },
    { "number": "52", "name": "Mal Waldrep Jr.", "position": "OL", "height": "6' 5\"", "weight_lbs": "324", "class": "Fr.", "hometown": "Seale, Ala. / Central" },
    { "number": "53", "name": "Vito Perri", "position": "LB", "height": "6' 0\"", "weight_lbs": "220", "class": "R-Jr.", "hometown": "Alpharetta, Ga. / Alpharetta" },
    { "number": "53", "name": "Mac Smith", "position": "OL", "height": "6' 3\"", "weight_lbs": "285", "class": "Jr.", "hometown": "Birmingham, Ala. / Mountain Brook" },
    { "number": "54", "name": "JD Martin", "position": "OL", "height": "6' 2\"", "weight_lbs": "260", "class": "So.", "hometown": "Pisgah, Ala. / Pisgah" },
    { "number": "55", "name": "Roq Montgomery", "position": "OL", "height": "6' 3\"", "weight_lbs": "330", "class": "R-So.", "hometown": "Anniston, Ala. / Anniston" },
    { "number": "56", "name": "JD Baird", "position": "LB", "height": "5' 8\"", "weight_lbs": "210", "class": "Sr.", "hometown": "Tuscaloosa, Ala. / American Christian Academy" },
    { "number": "56", "name": "Geno VanDeMark", "position": "OL", "height": "6' 5\"", "weight_lbs": "326", "class": "R-Sr.", "hometown": "Lodi, N.J. / Saint Joseph", "previous_school": "Michigan State" },
    { "number": "58", "name": "Jamison Travis", "position": "OL", "height": "6' 2\"", "weight_lbs": "305", "class": "Fr.", "hometown": "Hoover, Ala. / Hoover" },
    { "number": "61", "name": "Graham Roten", "position": "OL", "height": "6' 3\"", "weight_lbs": "295", "class": "R-Sr.", "hometown": "Nashville, Tenn. / Christ Presbyterian Academy" },
    { "number": "62", "name": "Davis Peterson", "position": "OL", "height": "6' 1\"", "weight_lbs": "285", "class": "Jr.", "hometown": "Birmingham, Ala. / Mountain Brook" },
    { "number": "64", "name": "Michael Carroll", "position": "OL", "height": "6' 6\"", "weight_lbs": "321", "class": "Fr.", "hometown": "Doylestown, Pa. / IMG Academy" },
    { "number": "65", "name": "Micah DeBose", "position": "OL", "height": "6' 5\"", "weight_lbs": "319", "class": "Fr.", "hometown": "Mobile, Ala. / Theodore" },
    { "number": "66", "name": "Baker Hickman", "position": "OL", "height": "6' 3\"", "weight_lbs": "340", "class": "Jr.", "hometown": "Tuscaloosa, Ala. / Northridge" },
    { "number": "67", "name": "Wade Estess", "position": "OL", "height": "6' 3\"", "weight_lbs": "315", "class": "So.", "hometown": "Madison, Miss. / Germantown" },
    { "number": "68", "name": "Billy Roby", "position": "OL", "height": "5' 11\"", "weight_lbs": "285", "class": "Jr.", "hometown": "Huntsville, Ala. / Huntsville" },
    { "number": "69", "name": "Joseph Ionata", "position": "OL", "height": "6' 5\"", "weight_lbs": "306", "class": "R-Fr.", "hometown": "Clearwater, Fla. / Cavalry Christian" },
    { "number": "70", "name": "William Sanders", "position": "OL", "height": "6' 3\"", "weight_lbs": "308", "class": "R-Fr.", "hometown": "Brookwood, Ala. / Brookwood" },
    { "number": "71", "name": "Kam Dewberry", "position": "OL", "height": "6' 4\"", "weight_lbs": "332", "class": "Sr.", "hometown": "Humble, Texas / Atascocita", "previous_school": "Texas A&M" },
    { "number": "72", "name": "Parker Brailsford", "position": "OL", "height": "6' 2\"", "weight_lbs": "290", "class": "R-Jr.", "hometown": "Mesa, Ariz. / Saguaro", "previous_school": "Washington" },
    { "number": "73", "name": "Olaus Alinen", "position": "OL", "height": "6' 6\"", "weight_lbs": "322", "class": "R-So.", "hometown": "Pori, Finland / The Loomis Chaffee School (Conn.)" },
    { "number": "74", "name": "Kadyn Proctor", "position": "OL", "height": "6' 7\"", "weight_lbs": "366", "class": "Jr.", "hometown": "Des Moines, Iowa / Southeast Polk" },
    { "number": "75", "name": "Wilkin Formby", "position": "OL", "height": "6' 7\"", "weight_lbs": "324", "class": "R-So.", "hometown": "Tuscaloosa, Ala. / Northridge" },
    { "number": "76", "name": "Arkel Anugwom", "position": "OL", "height": "6' 6\"", "weight_lbs": "328", "class": "R-So.", "hometown": "Antioch, Tenn. / Antioch", "previous_school": "Ball State" },
    { "number": "77", "name": "Jaeden Roberts", "position": "OL", "height": "6' 5\"", "weight_lbs": "327", "class": "R-Sr.", "hometown": "Houston, Texas / North Shore" },
    { "number": "78", "name": "Jackson Lloyd", "position": "OL", "height": "6' 7\"", "weight_lbs": "318", "class": "Fr.", "hometown": "Carmel, Calif. / Carmel" },
    { "number": "80", "name": "Josh Cuevas", "position": "TE", "height": "6' 3\"", "weight_lbs": "256", "class": "R-Sr.", "hometown": "Los Angeles, Calif. / Campbell Hall", "previous_school": "Cal Poly / Washington" },
    { "number": "81", "name": "Kaleb Edwards", "position": "TE", "height": "6' 6\"", "weight_lbs": "264", "class": "Fr.", "hometown": "El Dorado Hills, Calif. / Oak Ridge" },
    { "number": "82", "name": "Lane Whisenhunt", "position": "LB", "height": "6' 2\"", "weight_lbs": "225", "class": "Jr.", "hometown": "Vestavia Hills, Ala. / Vestavia Hills" },
    { "number": "85", "name": "Jack Sammarco", "position": "TE", "height": "6' 5\"", "weight_lbs": "252", "class": "So.", "hometown": "Cincinnati, Ohio / Anderson", "previous_school": "West Virginia" },
    { "number": "86", "name": "Peter Knudson", "position": "TE", "height": "6' 4\"", "weight_lbs": "246", "class": "R-Sr.", "hometown": "McCall, Idaho / McCall-Donnelly", "previous_school": "Weber State" },
    { "number": "87", "name": "Danny Lewis Jr.", "position": "TE", "height": "6' 5\"", "weight_lbs": "254", "class": "R-Jr.", "hometown": "New Iberia, La. / Westgate" },
    { "number": "88", "name": "Isaia Faga", "position": "DL", "height": "6' 2\"", "weight_lbs": "296", "class": "R-Fr.", "hometown": "Phenix City, Ala. / Central" },
    { "number": "88", "name": "Jay Lindsey", "position": "TE", "height": "6' 5\"", "weight_lbs": "255", "class": "R-Fr.", "hometown": "Butler, Ala. / Patrician Academy" },
    { "number": "89", "name": "Brody Dalton", "position": "TE", "height": "6' 5\"", "weight_lbs": "251", "class": "R-Sr.", "hometown": "Fyffe, Ala. / Fyffe", "previous_school": "UAB / Troy" },
    { "number": "90", "name": "London Simmons", "position": "DL", "height": "6' 3\"", "weight_lbs": "303", "class": "Fr.", "hometown": "Jackson, Miss. / Hartfield Academy" },
    { "number": "92", "name": "Jeremiah Beaman", "position": "DL", "height": "6' 4\"", "weight_lbs": "314", "class": "R-Fr.", "hometown": "Birmingham, Ala. / Parker" },
    { "number": "94", "name": "Edric Hill", "position": "DL", "height": "6' 3\"", "weight_lbs": "284", "class": "R-So.", "hometown": "Kansas City, Mo. / North Kansas City" },
    { "number": "95", "name": "Anderson Green", "position": "P", "height": "6' 0\"", "weight_lbs": "205", "class": "So.", "hometown": "Tuscaloosa, Ala. / Northridge" },
    { "number": "96", "name": "Tim Keenan III", "position": "DL", "height": "6' 2\"", "weight_lbs": "320", "class": "R-Sr.", "hometown": "Birmingham, Ala. / Ramsay" },
    { "number": "97", "name": "Reid Schuback", "position": "PK", "height": "6' 0\"", "weight_lbs": "215", "class": "R-Sr.", "hometown": "Poway, Calif. / Poway" },
    { "number": "98", "name": "Tucker Cornelius", "position": "PK", "height": "6' 3\"", "weight_lbs": "195", "class": "So.", "hometown": "Tuscaloosa, Ala. / Northridge" }
  ]
};

/* ===== Browser (non-Electron) API polyfill ===== */
// If preload (Electron) didn't inject window.api, we create a browser version
// using the File System Access API (Chromium). This allows running via a web server
// (e.g., Vite) with nearly identical functionality.
(function setupWebApiPolyfill() {
  if (window.api) return; // Electron path

  const isFSAvailable = typeof window.showDirectoryPicker === 'function';
  const WEB = {
    dirHandle: null,
    // Map key -> { handle, dirHandle, url }
    fileByKey: new Map(),
  };

  function extname(name) {
    const i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(i) : '';
  }

  function basenameNoExt(name) {
    const i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(0, i) : name;
  }

  function isVideoFileName(name) {
    return /\.(mp4|mov|m4v|mkv|avi|webm|mts|m2ts)$/i.test(name);
  }

  function fileToUrl(file) {
    try { return URL.createObjectURL(file); } catch { return ''; }
  }

  async function listTopLevelVideos(dirHandle) {
    const out = [];
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === 'file' && isVideoFileName(name)) {
  const file = await handle.getFile();
  out.push({ name, handle, file });
      }
    }
    // natural sort
    out.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    return out;
  }

  async function uniqueName(dirHandle, base, ext) {
    let candidate = base + ext;
    let i = 1;
    while (true) {
      try {
        // If it exists, getFileHandle will succeed
        await dirHandle.getFileHandle(candidate, { create: false });
        candidate = `${base}-${i}${ext}`;
        i++;
      } catch {
        // Not found => unique
        return candidate;
      }
    }
  }

  function validateRosterWeb(data) {
    if (!data || typeof data !== 'object') return false;
    if (!Array.isArray(data.players)) return false;
    // Optional top-level: team, season, source, notes
    for (const p of data.players) {
      if (!p || typeof p !== 'object') return false;
      if (typeof p.number !== 'string' || typeof p.name !== 'string') return false;
      // Optional fields are allowed: position, class, height, weight_lbs, hometown, previous_school
    }
    return true;
  }

  function getKeyForName(name) { return name; }

  // Build the FILES array result expected by the app from a directory handle
  async function buildFiles(dirHandle) {
    const raw = await listTopLevelVideos(dirHandle);
    WEB.fileByKey.clear();
    return Promise.all(raw.map(async ({ name, handle, file }) => {
      const key = getKeyForName(name);
      const url = fileToUrl(file);
      const f = {
        name,
        base: basenameNoExt(name),
        ext: extname(name),
        dir: '',
        path: key, // synthetic key in web mode
        url,
      };
      WEB.fileByKey.set(key, { handle, dirHandle, url });
  try { FILES_META.set(key, { sizeBytes: file.size, mtimeMs: file.lastModified, ext: extname(name).toLowerCase() }); } catch {}
      return f;
    }));
  }

  async function webRename(fromKey, newBase) {
    if (!WEB.dirHandle) throw new Error('No directory');
    const entry = WEB.fileByKey.get(fromKey);
    if (!entry) throw new Error('File not found');
    const { handle, dirHandle } = entry;
    const oldName = handle.name;
    const ext = extname(oldName);
    const targetName = await uniqueName(dirHandle, newBase, ext);

    // Prefer native move/rename if supported
    if (typeof handle.move === 'function') {
      await handle.move(dirHandle, targetName);
      const newHandle = await dirHandle.getFileHandle(targetName, { create: false });
      const newFile = await newHandle.getFile();
      // cleanup old URL
      try { URL.revokeObjectURL(entry.url); } catch {}
      const url = fileToUrl(newFile);
      const newKey = getKeyForName(targetName);
  WEB.fileByKey.delete(fromKey);
      WEB.fileByKey.set(newKey, { handle: newHandle, dirHandle, url });
  try { const nf = await newHandle.getFile(); FILES_META.delete(fromKey); FILES_META.set(newKey, { sizeBytes: nf.size, mtimeMs: nf.lastModified, ext: extname(targetName).toLowerCase() }); } catch {}
      return {
        name: targetName,
        base: basenameNoExt(targetName),
        ext: extname(targetName),
        dir: '',
        path: newKey,
        url,
      };
    }

    // Fallback: copy to new file then remove old
    const newHandle = await dirHandle.getFileHandle(targetName, { create: true });
    const writable = await newHandle.createWritable({ keepExistingData: false });
    const readFile = await handle.getFile();
    await writable.write(await readFile.arrayBuffer());
    await writable.close();
    // remove old
    await dirHandle.removeEntry(oldName, { recursive: false });
    // update map
    try { URL.revokeObjectURL(entry.url); } catch {}
    const newFile = await newHandle.getFile();
    const url = fileToUrl(newFile);
    const newKey = getKeyForName(targetName);
  WEB.fileByKey.delete(fromKey);
    WEB.fileByKey.set(newKey, { handle: newHandle, dirHandle, url });
  try { FILES_META.delete(fromKey); FILES_META.set(newKey, { sizeBytes: newFile.size, mtimeMs: newFile.lastModified, ext: extname(targetName).toLowerCase() }); } catch {}
    return {
      name: targetName,
      base: basenameNoExt(targetName),
      ext: extname(targetName),
      dir: '',
      path: newKey,
      url,
    };
  }

  async function webDelete(key) {
    const entry = WEB.fileByKey.get(key);
    if (!entry) throw new Error('File not found');
    const { handle, dirHandle, url } = entry;
    await dirHandle.removeEntry(handle.name, { recursive: false });
    try { URL.revokeObjectURL(url); } catch {}
    WEB.fileByKey.delete(key);
  FILES_META.delete(key);
  }

  // Expose browser api with same shape
  window.api = {
    pickFolder: async () => {
      if (!isFSAvailable) {
        return { canceled: true, error: 'File System Access API not supported' };
      }
      try {
        const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        WEB.dirHandle = dirHandle;
        const files = await buildFiles(dirHandle);
        return { canceled: false, dir: dirHandle.name || 'Selected Folder', files };
      } catch (e) {
        return { canceled: true };
      }
    },
    renameFile: async (fromPath, newBase) => {
      try {
        const file = await webRename(fromPath, newBase);
        return { ok: true, file };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },
    deleteFile: async (fullPath) => {
      try { await webDelete(fullPath); return { ok: true }; } catch (e) { return { ok: false, error: String(e) }; }
    },
    confirmDelete: async (fileName) => {
      try { return { confirmed: window.confirm(`Delete this file?\n${fileName}`) }; } catch (e) { return { confirmed: false, error: String(e) }; }
    },
    showInFolder: (_fullPath) => {
      // Not available on the web; no-op
    },
    pickRoster: async () => {
      try {
        if (typeof window.showOpenFilePicker !== 'function') {
          return { canceled: true, error: 'File Picker not supported' };
        }
        const [h] = await window.showOpenFilePicker({ multiple: false, types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] });
        if (!h) return { canceled: true };
        const file = await h.getFile();
        const text = await file.text();
        let data; try { data = JSON.parse(text); } catch { return { canceled: true, error: 'Invalid JSON' }; }
        if (!validateRosterWeb(data)) return { canceled: true, error: 'Roster schema invalid' };
        try { localStorage.setItem('FR_ROSTER', JSON.stringify(data)); } catch {}
        return { canceled: false, roster: data };
      } catch (e) {
        return { canceled: true };
      }
    },
    getRoster: async () => {
      try { const raw = localStorage.getItem('FR_ROSTER'); if (!raw) return { ok: false, error: 'No roster loaded' }; const roster = JSON.parse(raw); return { ok: true, roster }; } catch (e) { return { ok: false, error: String(e) }; }
    }
  };

  // Hide unsupported UI affordances in web mode
  try { document.getElementById('showInFolderBtn').style.display = 'none'; } catch {}
})();

/* ===== Utilities ===== */

function formatTime(s) {
  if (!isFinite(s) || s == null) return '00:00';
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function sanitizeBaseName(name) {
  // Remove invalid filename chars on Windows and common OSes
  const cleaned = name.replace(/[\/\\:*?"<>|]/g, '-').trim();
  // Avoid empty or dots-only
  return cleaned.replace(/^\.+$/, '').trim();
}

function getLastName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1];
}

function ensureUniqueTags(tags) {
  const seen = new Set();
  const out = [];
  for (const p of tags) {
    const key = p.number + '|' + p.name;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

function buildTaggedBaseName(originalBase, tags) {
  if (!tags.length) return originalBase;
  const suffixes = tags.map(p => getLastName(p.name)).filter(Boolean);
  if (!suffixes.length) return originalBase;
  return originalBase + '_' + suffixes.join('_');
}

function filterPlayersByNumber(prefix) {
  if (!ROSTER || !ROSTER.players) return [];
  if (!prefix) return ROSTER.players.slice(0, 50); // limit
  const lower = prefix.toLowerCase();
  return ROSTER.players.filter(p => p.number.toLowerCase().startsWith(lower)).slice(0, 50);
}

function renderSuggestions(list) {
  if (!list.length) {
    tagSuggestions.innerHTML = '<div class="item" style="opacity:0.5;pointer-events:none;">No matches</div>';
    return;
  }
  tagSuggestions.innerHTML = list.map(p => `
    <div class="item" data-number="${p.number.replace(/"/g,'&quot;')}" data-name="${p.name.replace(/"/g,'&quot;')}">
      <span class="num">#${p.number}</span>
      <span class="name">${p.name}</span>
      <span class="pos">${p.position || ''}</span>
    </div>`).join('');
}

function openTagOverlay() {
  if (!FILES.length || isRenaming || isTagging) return;
  if (!ROSTER) {
    showToast('Load roster first (button top-left)');
    return;
  }
  isTagging = true;
  const file = FILES[index];
  currentTags = fileTagCache.get(file.path) ? [...fileTagCache.get(file.path)] : [];
  tagInput.value = '';
  tagOverlay.classList.remove('hidden');
  tagSuggestions.classList.remove('hidden');
  renderSuggestions(filterPlayersByNumber(''));
  renderCurrentTagPills();
  setTimeout(() => { tagInput.focus(); tagInput.select(); }, 0);
}

function closeTagOverlay() {
  if (!isTagging) return;
  isTagging = false;
  tagOverlay.classList.add('hidden');
}

function openDetailsOverlay() {
  if (!FILES.length || isRenaming || isEnteringDetails) return;
  isEnteringDetails = true;
  detailsInput.value = '';
  detailsOverlay.classList.remove('hidden');
  setTimeout(()=>{ detailsInput.focus(); detailsInput.select(); },0);
}

function closeDetailsOverlay() {
  if (!isEnteringDetails) return;
  isEnteringDetails = false;
  detailsOverlay.classList.add('hidden');
}

function finalizeTagsThenDetails() {
  if (!isTagging) return;
  if (!FILES.length) { closeTagOverlay(); return; }
  // proceed to details entry (rename will happen after details)
  closeTagOverlay();
  openDetailsOverlay();
}

async function performTagRename(file, newBase) {
  // Pause & detach to avoid file locks
  const wasPlaying = !videoEl.paused;
  videoEl.pause();
  videoEl.src = '';
  const res = await window.api.renameFile(file.path, sanitizeBaseName(newBase));
  if (!res || !res.ok) {
    showToast('Tag rename failed');
    videoEl.src = file.url;
    if (wasPlaying) videoEl.play().catch(()=>{});
    closeTagOverlay();
    return;
  }
  FILES[index] = res.file;
  const currentIndex = index;
  let advanced = false;
  if (currentIndex < FILES.length - 1) {
    loadVideoAt(currentIndex + 1, true);
    advanced = true;
  } else {
    loadVideoAt(currentIndex, true);
  }
  showToast(advanced ? 'Tagged → Next clip' : 'Tagged (last clip)');
  closeTagOverlay();
  try { refreshListUI(); } catch {}
}

function addTag(player) {
  currentTags.push(player);
  currentTags = ensureUniqueTags(currentTags);
  const label = currentTags.map(p => '#' + p.number + ' ' + getLastName(p.name)).join(', ');
  tagInput.value = '';
  tagInput.placeholder = label || 'Type jersey number';
  renderSuggestions(filterPlayersByNumber(''));
  // cache current tags per file
  if (FILES.length) {
    fileTagCache.set(FILES[index].path, [...currentTags]);
  }
  renderCurrentTagPills();
}

function renderCurrentTagPills() {
  if (!currentTagsEl) return;
  if (!currentTags.length) {
    currentTagsEl.innerHTML = '<span style="opacity:.5;font-size:11px;">No players tagged</span>';
    return;
  }
  currentTagsEl.innerHTML = currentTags.map((p,i)=>`<span class="pill" data-i="${i}">#${p.number} ${getLastName(p.name)} <button title="Remove" data-remove="${i}">×</button></span>`).join('');
}

function showToast(msg, ms = 1800) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, ms);
}

function updateCounter() {
  // Bottom-left shows clip index (e.g., 1 / N)
  currentNameEl.textContent = `${FILES.length ? index + 1 : 0} / ${FILES.length}`;
}

function setFilenameUI() {
  if (!FILES.length) {
  // Header shows placeholder; bottom-left shows count
  fileCounterEl.textContent = 'No file loaded';
  currentNameEl.textContent = '0 / 0';
    return;
  }
  const f = FILES[index];
  fileCounterEl.textContent = f.name;
}


/* ===== List View (Sidebar) ===== */
function bytesToMB(n) { return n == null ? null : Math.round((n / (1024*1024)) * 10) / 10; }
function formatMTime(ms) { try { return new Date(ms).toLocaleDateString() } catch { return '' } }

function computeExts(files) {
  const set = new Set();
  for (const f of files) {
    const meta = FILES_META.get(f.path);
    if (meta && meta.ext) set.add(meta.ext);
    else if (f.ext) set.add((f.ext || '').toLowerCase());
  }
  return Array.from(set).sort();
}

function renderExtPills() {
  if (!listExtContainer) return;
  const exts = computeExts(FILES);
  if (!exts.length) { listExtContainer.innerHTML = '<span class="muted small">No videos</span>'; return; }
  listExtContainer.innerHTML = exts.map(e => `<span class="pill ${FILTERS.exts.has(e) ? 'active' : ''}" data-ext="${e}">${e}</span>`).join('');
}

function applyFilters() {
  let arr = FILES.map((f, i) => ({ f, i }));
  const q = (FILTERS.q || '').toLowerCase();
  if (q) arr = arr.filter(({f}) => f.name.toLowerCase().includes(q));
  if (FILTERS.exts && FILTERS.exts.size) arr = arr.filter(({f}) => {
    const meta = FILES_META.get(f.path);
    const e = (meta?.ext || f.ext || '').toLowerCase();
    return FILTERS.exts.has(e);
  });
  if (FILTERS.sizeMin != null || FILTERS.sizeMax != null) arr = arr.filter(({f}) => {
    const size = FILES_META.get(f.path)?.sizeBytes;
    if (size == null) return true;
    const mb = size / (1024*1024);
    if (FILTERS.sizeMin != null && mb < FILTERS.sizeMin) return false;
    if (FILTERS.sizeMax != null && mb > FILTERS.sizeMax) return false;
    return true;
  });
  if (FILTERS.hasTags) arr = arr.filter(({f}) => (fileTagCache.get(f.path) || []).length > 0);

  const dir = FILTERS.dir === 'desc' ? -1 : 1;
  const sortKey = FILTERS.sort;
  arr.sort((a, b) => {
    const A = a.f, B = b.f;
    if (sortKey === 'name') return dir * A.name.localeCompare(B.name, undefined, { numeric: true, sensitivity: 'base' });
    if (sortKey === 'ext') return dir * ((A.ext || '').localeCompare(B.ext || ''));
    if (sortKey === 'size') {
      const sa = FILES_META.get(A.path)?.sizeBytes || 0;
      const sb = FILES_META.get(B.path)?.sizeBytes || 0;
      return dir * (sa - sb);
    }
    if (sortKey === 'mtime') {
      const ma = FILES_META.get(A.path)?.mtimeMs || 0;
      const mb = FILES_META.get(B.path)?.mtimeMs || 0;
      return dir * (ma - mb);
    }
    return 0;
  });
  return arr;
}

function renderFileList() {
  if (!fileListContainer) return;
  const rows = applyFilters();
  if (listCountEl) listCountEl.textContent = `${rows.length} shown / ${FILES.length} total`;
  if (!rows.length) { fileListContainer.innerHTML = '<div class="muted small" style="padding:8px;">No files match.</div>'; return; }
  const activePath = FILES[index]?.path;
  fileListContainer.innerHTML = rows.map(({f, i}) => {
    const meta = FILES_META.get(f.path) || {};
    const sizeMB = bytesToMB(meta.sizeBytes);
    const hasTags = (fileTagCache.get(f.path) || []).length > 0;
    return `
      <div class="file-item ${activePath===f.path ? 'active' : ''}" data-i="${i}" title="${f.name}">
        <div class="name">${f.name}</div>
        <div class="meta">
          <span>${(meta.ext || f.ext || '').toUpperCase().replace('.', '')}</span>
          ${sizeMB!=null ? `<span>${sizeMB} MB</span>` : ''}
          ${meta.mtimeMs ? `<span>${formatMTime(meta.mtimeMs)}</span>` : ''}
          ${hasTags ? `<span style="color:#9fe870;">tagged</span>` : ''}
        </div>
      </div>`;
  }).join('');
}

function syncActiveInList() {
  if (!fileListContainer) return;
  const items = fileListContainer.querySelectorAll('.file-item');
  items.forEach(el => el.classList.remove('active'));
  const activePath = FILES[index]?.path;
  const row = Array.from(items).find(el => FILES[Number(el.getAttribute('data-i'))]?.path === activePath);
  if (row) row.classList.add('active');
}

function refreshListUI() { renderExtPills(); renderFileList(); syncActiveInList(); }

function scheduleListRender() { cancelAnimationFrame(scheduleListRender._id); scheduleListRender._id = requestAnimationFrame(refreshListUI); }

// List sidebar events
if (toggleListBtn) toggleListBtn.addEventListener('click', () => {
  const willShow = listPanel.classList.contains('hidden');
  listPanel.classList.toggle('hidden');
  // Keep button label stable
  toggleListBtn.textContent = 'List View';
  if (willShow) {
    try { refreshListUI(); } catch {}
  }
});
if (closeListBtn) closeListBtn.addEventListener('click', () => {
  listPanel.classList.add('hidden');
  toggleListBtn.textContent = 'List View';
});
if (fileListContainer) fileListContainer.addEventListener('click', (e) => {
  const item = e.target.closest('.file-item');
  if (!item) return;
  const i = Number(item.getAttribute('data-i'));
  if (!Number.isNaN(i)) loadVideoAt(i, true);
  try { listPanel.classList.add('hidden'); toggleListBtn.textContent = 'List View'; } catch {}
});
if (listSearchInput) listSearchInput.addEventListener('input', (e) => { FILTERS.q = e.target.value; scheduleListRender(); });
if (listSortSelect) listSortSelect.addEventListener('change', (e) => { FILTERS.sort = e.target.value; scheduleListRender(); });
if (listSortDir) listSortDir.addEventListener('change', (e) => { FILTERS.dir = e.target.value; scheduleListRender(); });
if (listSizeMin) listSizeMin.addEventListener('input', (e) => { const v = e.target.value; FILTERS.sizeMin = v ? Number(v) : null; scheduleListRender(); });
if (listSizeMax) listSizeMax.addEventListener('input', (e) => { const v = e.target.value; FILTERS.sizeMax = v ? Number(v) : null; scheduleListRender(); });
if (listHasTagsCheckbox) listHasTagsCheckbox.addEventListener('change', (e) => { FILTERS.hasTags = !!e.target.checked; scheduleListRender(); });
if (listExtContainer) listExtContainer.addEventListener('click', (e) => {
  const pill = e.target.closest('.pill');
  if (!pill) return;
  const ext = pill.getAttribute('data-ext');
  if (!ext) return;
  if (FILTERS.exts.has(ext)) FILTERS.exts.delete(ext); else FILTERS.exts.add(ext);
  scheduleListRender();
});
if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', () => {
  FILTERS = { q: '', sort: 'name', dir: 'asc', sizeMin: null, sizeMax: null, exts: new Set(), hasTags: false };
  if (listSearchInput) listSearchInput.value = '';
  if (listSortSelect) listSortSelect.value = 'name';
  if (listSortDir) listSortDir.value = 'asc';
  if (listSizeMin) listSizeMin.value = '';
  if (listSizeMax) listSizeMax.value = '';
  if (listHasTagsCheckbox) listHasTagsCheckbox.checked = false;
  scheduleListRender();
});

/* ===== Loading & navigation ===== */

function loadVideoAt(i, keepPaused = true) {
  if (!FILES.length) return;
  index = Math.max(0, Math.min(i, FILES.length - 1));
  const f = FILES[index];

  // Load new source
  videoEl.pause();
  videoEl.src = f.url;
  videoEl.currentTime = 0;
  if (!keepPaused) {
    videoEl.play().catch(() => {});
  }

  setFilenameUI();
  updateCounter();
  // Update mute button label
  muteBtn.textContent = videoEl.muted ? 'Unmute' : 'Mute';
  try { syncActiveInList(); } catch {}
}

function next() {
  if (!FILES.length) return;
  if (index < FILES.length - 1) {
    loadVideoAt(index + 1, true);
  } else {
    showToast('Reached end of list');
  }
}

function prev() {
  if (!FILES.length) return;
  if (index > 0) {
    loadVideoAt(index - 1, true);
  } else {
    showToast('At beginning');
  }
}

/* ===== Rename flow ===== */

function startRename() {
  if (!FILES.length || isRenaming) return;
  isRenaming = true;

  const f = FILES[index];
  renameInput.value = f.base; // prefill without extension
  renameOverlay.classList.remove('hidden');
  setTimeout(() => {
    renameInput.focus();
    renameInput.select();
  }, 0);
}

async function saveRenameAndAdvance() {
  if (!FILES.length || !isRenaming) return;
  const old = FILES[index];
  let newBase = sanitizeBaseName(renameInput.value);
  if (!newBase) {
    showToast('Name cannot be empty.');
    return;
  }

  // Pause & detach to avoid file-lock issues on Windows
  const wasPlaying = !videoEl.paused;
  videoEl.pause();
  videoEl.src = '';

  const res = await window.api.renameFile(old.path, newBase);
  if (!res || !res.ok) {
    const err = res && res.error ? res.error : 'Unknown error';
    showToast('Rename failed: ' + err, 2600);
    // Try to restore current video if failed
    videoEl.src = old.url;
    if (wasPlaying) videoEl.play().catch(() => {});
    return;
  }

  const updated = res.file;
  // Update the entry in-place
  FILES[index] = updated;
  try { refreshListUI(); } catch {}

  // Exit rename mode
  isRenaming = false;
  renameOverlay.classList.add('hidden');

  // Auto-advance
  if (index < FILES.length - 1) {
    loadVideoAt(index + 1, true);
  } else {
    // On last file, stay on it with the new name
    loadVideoAt(index, true);
    showToast('All files processed!');
  }
}

function cancelRename() {
  if (!isRenaming) return;
  isRenaming = false;
  renameOverlay.classList.add('hidden');
}

/* ===== Mouse scrubbing ===== */

function updateSeekUI() {
  const d = videoEl.duration || 0;
  const t = videoEl.currentTime || 0;
  currentTimeEl.textContent = formatTime(t);
  durationEl.textContent = formatTime(d);
  if (d > 0 && !seeking) {
    seekEl.value = String((t / d) * 100);
  }
}

function seekToPercent(pct) {
  const d = videoEl.duration || 0;
  if (d > 0) {
    videoEl.currentTime = (pct / 100) * d;
  }
}

// Throttle scrubbing updates to animation frames for smoother seeking
let _rafSeek = null;
let _queuedSeekPct = null;
function requestSeekToPercent(pct) {
  _queuedSeekPct = pct;
  if (_rafSeek) return;
  _rafSeek = requestAnimationFrame(() => {
    _rafSeek = null;
    if (_queuedSeekPct == null) return;
    seekToPercent(_queuedSeekPct);
    updateSeekUI(); // ensure time labels reflect during scrub
    _queuedSeekPct = null;
  });
}

/* ===== Frame stepping ===== */
function stepFrame(direction = 1) {
  const d = videoEl.duration || 0;
  if (d <= 0) return;
  // Use a reasonable default frame duration; true FPS isn't exposed in HTMLVideoElement
  const frameDur = 1 / 30; // ~33.33ms
  const wasPaused = videoEl.paused;
  // Pause to ensure frame-accurate preview
  videoEl.pause();
  const epsilon = 0.0005;
  const target = Math.max(0, Math.min(d - epsilon, (videoEl.currentTime || 0) + direction * frameDur));
  videoEl.currentTime = target;
  updateSeekUI();
  // Do not auto-resume; user is likely scrubbing
  if (!wasPaused) {
    // keep paused until user presses play or releases modifier
  }
}

/* ===== Events ===== */

openFolderBtn.addEventListener('click', async () => {
  const res = await window.api.pickFolder();
  if (res.canceled) {
    if (res.error) showToast('Error: ' + res.error);
    return;
  }
  DIR = res.dir;
  FILES = res.files || [];
  folderPathEl.textContent = DIR || '';
  if (!FILES.length) {
  currentNameEl.textContent = 'No video files in this folder.';
  fileCounterEl.textContent = '0 / 0';
    videoEl.src = '';
    return;
  }
  loadVideoAt(0, true);
  try { updateSplashVisibility(); } catch {}
  try { refreshListUI(); } catch {}
});

showInFolderBtn.addEventListener('click', () => {
  if (FILES.length) {
    window.api.showInFolder(FILES[index].path);
  }
});

// Header: Open Folder in Explorer
if (typeof openDirBtn !== 'undefined' && openDirBtn) {
  openDirBtn.addEventListener('click', () => {
    if (FILES.length) {
      window.api.showInFolder(FILES[index].path);
    } else {
      showToast('Pick a folder first');
    }
  });
}

prevBtn.addEventListener('click', prev);
nextBtn.addEventListener('click', next);

playPauseBtn.addEventListener('click', () => {
  if (videoEl.paused) {
    videoEl.play().then(() => (playPauseBtn.textContent = 'Pause')).catch(() => {});
  } else {
    videoEl.pause();
    playPauseBtn.textContent = 'Play';
  }
});

muteBtn.addEventListener('click', () => {
  videoEl.muted = !videoEl.muted;
  muteBtn.textContent = videoEl.muted ? 'Unmute' : 'Mute';
});

deleteBtn.addEventListener('click', async () => {
  if (!FILES.length) return;
  const file = FILES[index];
  const confirm = await window.api.confirmDelete(file.name);
  if (!confirm || !confirm.confirmed) {
    showToast('Canceled');
    return;
  }
  // Temporarily release video handle
  videoEl.pause();
  videoEl.src = '';
  const res = await window.api.deleteFile(file.path);
  if (!res || !res.ok) {
    showToast('Delete failed');
    // restore if needed
    if (file && file.url) videoEl.src = file.url;
    return;
  }
  // Remove from list
  FILES.splice(index, 1);
  if (!FILES.length) {
  currentNameEl.textContent = 'No file loaded';
  fileCounterEl.textContent = '0 / 0';
    showToast('Deleted. No more files.');
    return;
  }
  if (index >= FILES.length) index = FILES.length - 1;
  loadVideoAt(index, true);
  showToast('Deleted');
  try { refreshListUI(); } catch {}
});

videoEl.addEventListener('play', () => (playPauseBtn.textContent = 'Pause'));
videoEl.addEventListener('pause', () => (playPauseBtn.textContent = 'Play'));
videoEl.addEventListener('loadedmetadata', updateSeekUI);
videoEl.addEventListener('timeupdate', updateSeekUI);
videoEl.addEventListener('durationchange', updateSeekUI);

seekEl.addEventListener('mousedown', () => {
  seeking = true;
  wasPlayingBeforeSeek = !videoEl.paused;
  // Pause during scrub for frame-accurate preview
  videoEl.pause();
});
seekEl.addEventListener('mouseup', () => {
  seeking = false;
  // Resume if it was playing before the scrub
  if (wasPlayingBeforeSeek) {
    videoEl.play().catch(() => {});
  }
});
seekEl.addEventListener('input', (e) => {
  seeking = true;
  const pct = Number(e.target.value);
  requestSeekToPercent(pct);
});
// Pointer/touch support for robust scrubbing across platforms
seekEl.addEventListener('pointerdown', (e) => {
  seeking = true;
  wasPlayingBeforeSeek = !videoEl.paused;
  videoEl.pause();
  _seekPointerId = e.pointerId;
  _seekRect = seekEl.getBoundingClientRect();
  if (seekEl.setPointerCapture) {
    try { seekEl.setPointerCapture(e.pointerId); } catch {}
  }
  // Immediate update on initial down
  const pct = Math.max(0, Math.min(100, ((e.clientX - _seekRect.left) / _seekRect.width) * 100));
  seekEl.value = String(pct);
  requestSeekToPercent(pct);
});
seekEl.addEventListener('pointerup', () => {
  seeking = false;
  if (wasPlayingBeforeSeek) {
    videoEl.play().catch(() => {});
  }
  _seekPointerId = null;
  _seekRect = null;
});
// Drive frame updates directly from pointer movement for smooth scrubbing
window.addEventListener('pointermove', (e) => {
  if (!seeking) return;
  if (_seekRect == null) _seekRect = seekEl.getBoundingClientRect();
  const pct = Math.max(0, Math.min(100, ((e.clientX - _seekRect.left) / _seekRect.width) * 100));
  seekEl.value = String(pct);
  requestSeekToPercent(pct);
});
seekEl.addEventListener('touchstart', () => {
  seeking = true;
  wasPlayingBeforeSeek = !videoEl.paused;
  videoEl.pause();
}, { passive: true });
seekEl.addEventListener('touchend', () => {
  seeking = false;
  if (wasPlayingBeforeSeek) {
    videoEl.play().catch(() => {});
  }
}, { passive: true });

document.addEventListener('keydown', (e) => {
  // Frame-by-frame scrubbing with Shift + Arrow keys
  if (e.shiftKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    e.preventDefault();
    stepFrame(e.key === 'ArrowRight' ? +1 : -1);
    return;
  }
  // If typing in rename input, let Enter go through to save
  if (isRenaming) {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveRenameAndAdvance();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelRename();
      return;
    }
    return;
  }

  if (isEnteringDetails) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const details = sanitizeBaseName(detailsInput.value.trim());
      const file = FILES[index];
      const baseNoExtra = file.base.split(/_(?=[^_]+$)/)[0] || file.base; // first segment before last underscore if any
      let taggedBase = buildTaggedBaseName(baseNoExtra, currentTags);
      if (details) taggedBase = taggedBase + '_' + details;
      closeDetailsOverlay();
  performTagRename(file, taggedBase);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDetailsOverlay();
      showToast('Canceled details');
      return;
    }
    return;
  }

  if (isTagging) {
    if (e.key === 'Enter') {
      e.preventDefault();
      finalizeTagsThenDetails();
      return;
    }
    if (e.key === ' ') { // allow play/pause while tagging
      e.preventDefault();
      if (videoEl.paused) {
        videoEl.play().catch(()=>{});
      } else {
        videoEl.pause();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
  // Do not clear tags on Esc; just close
  closeTagOverlay();
      return;
    }
    return; // other keys handled by input event
  }

  // Close list page with Escape
  if (!listPanel.classList.contains('hidden') && e.key === 'Escape') {
    e.preventDefault();
    listPanel.classList.add('hidden');
    toggleListBtn.textContent = 'List View';
    return;
  }

  // Global shortcuts
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    next();
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    prev();
  } else if (e.key === ' ') {
    e.preventDefault();
    if (videoEl.paused) {
      videoEl.play().catch(() => {});
    } else {
      videoEl.pause();
    }
  } else if (e.key === 'Enter') { // new flow: Enter -> tag overlay first
    e.preventDefault();
    openTagOverlay();
  } else if (e.key === 'Delete') {
    e.preventDefault();
    deleteBtn.click();
  }
});

/* Startup: wire splash and update visibility */
window.addEventListener('DOMContentLoaded', async () => {
  // Onboarding buttons
  if (splashStartBtn) splashStartBtn.addEventListener('click', () => setOnboardStep(1));
  if (splashShortcutsContinueBtn) splashShortcutsContinueBtn.addEventListener('click', () => setOnboardStep(3));

  // Splash: use built-in Bama roster
  if (splashUseBamaBtn) splashUseBamaBtn.addEventListener('click', () => {
    ROSTER = BAMA_ROSTER;
    try { localStorage.setItem('FR_ROSTER', JSON.stringify(ROSTER)); } catch {}
    showToast('Loaded Alabama roster');
    setOnboardStep(2);
  });
  // Splash: import custom roster
  if (splashImportRosterBtn) splashImportRosterBtn.addEventListener('click', async () => {
    const res = await window.api.pickRoster();
    if (res && !res.canceled && res.roster) {
      ROSTER = res.roster;
      showToast('Roster loaded');
    }
    setOnboardStep(2);
  });
  // Splash: skip roster
  if (splashSkipRosterBtn) splashSkipRosterBtn.addEventListener('click', () => setOnboardStep(2));

  // Footage import
  if (splashFootageOpenBtn) splashFootageOpenBtn.addEventListener('click', () => openFolderBtn.click());
  // Copy roster template
  if (copyRosterTemplateBtn) copyRosterTemplateBtn.addEventListener('click', async () => {
    const template = {
      team: "",
      season: 2025,
      source: "",
      players: [
        {
          number: "",
          name: "",
          position: "",
          class: "",
          height: "",
          weight_lbs: "",
          hometown: "",
          previous_school: ""
        }
      ],
      notes: ""
    };
    const text = JSON.stringify(template, null, 2);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      showToast('Roster template copied to clipboard');
    } catch (e) {
      showToast('Copy failed');
    }
  });

  // Initial onboarding state
  setOnboardStep(0);
  try { updateSplashVisibility(); } catch {}
});

/* Roster load button */
loadRosterBtn.addEventListener('click', async () => {
  const res = await window.api.pickRoster();
  if (res && !res.canceled && res.roster) {
    ROSTER = res.roster;
    showToast('Roster loaded: ' + (ROSTER.team || 'Team'));
  try { updateSplashVisibility(); } catch {}
  } else if (res && res.error) {
    showToast('Roster error: ' + res.error);
  }
});

/* Attempt to load stored roster at startup */
window.api.getRoster().then(r => { if (r && r.ok) { ROSTER = r.roster; } }).finally(() => { try { updateSplashVisibility(); } catch {} });

/* Tag input events */
tagInput.addEventListener('input', (e) => {
  if (!isTagging) return;
  const v = e.target.value.trim();
  renderSuggestions(filterPlayersByNumber(v));
});

tagSuggestions.addEventListener('click', (e) => {
  const item = e.target.closest('.item');
  if (!item) return;
  const num = item.getAttribute('data-number');
  const name = item.getAttribute('data-name');
  const player = ROSTER.players.find(p => p.number === num && p.name === name);
  if (player) {
    addTag(player);
  }
});

tagOverlay.addEventListener('click', (e) => {
  if (e.target === tagOverlay) {
  // Close without clearing tags when clicking backdrop
  closeTagOverlay();
  }
});

detailsOverlay.addEventListener('click', (e) => {
  if (e.target === detailsOverlay) {
    closeDetailsOverlay();
  }
});

// Tag pill removal
if (currentTagsEl) {
  currentTagsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-remove]');
    if (!btn) return;
    const idx = Number(btn.getAttribute('data-remove'));
    if (!Number.isNaN(idx)) {
      currentTags.splice(idx,1);
      if (FILES.length) fileTagCache.set(FILES[index].path, [...currentTags]);
      renderCurrentTagPills();
      const label = currentTags.map(p => '#' + p.number + ' ' + getLastName(p.name)).join(', ');
      tagInput.placeholder = label || 'Type jersey number';
    }
  });
}

/* ===== Zoom & Pan (Playback Area) ===== */
// Scroll wheel to zoom, click-drag to pan when zoomed > 1, double-click to reset.
let _zoom = 1;
let _panX = 0;
let _panY = 0;
let _isDragging = false;
let _dragStartX = 0;
let _dragStartY = 0;
let _origPanX = 0;
let _origPanY = 0;

function applyVideoTransform() {
  // Clamp pan so you can't drag beyond edges excessively
  const rect = videoEl.getBoundingClientRect();
  const maxX = (_zoom - 1) * rect.width / 2;
  const maxY = (_zoom - 1) * rect.height / 2;
  if (maxX > 0) {
    _panX = Math.max(-maxX, Math.min(maxX, _panX));
  } else { _panX = 0; }
  if (maxY > 0) {
    _panY = Math.max(-maxY, Math.min(maxY, _panY));
  } else { _panY = 0; }
  videoEl.style.transform = `translate(${_panX}px, ${_panY}px) scale(${_zoom})`;
  if (_zoom > 1) {
    videoEl.style.cursor = _isDragging ? 'grabbing' : 'grab';
  } else {
    videoEl.style.cursor = 'default';
  }
}

function resetZoomPan() {
  _zoom = 1;
  _panX = 0;
  _panY = 0;
  applyVideoTransform();
}

videoEl.addEventListener('wheel', (e) => {
  // Only act if not over an overlay
  if (isRenaming || isTagging || isEnteringDetails) return;
  e.preventDefault();
  const prevZoom = _zoom;
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  _zoom = Math.max(1, Math.min(8, _zoom * factor));
  // Keep pointer position roughly stable while zooming
  if (_zoom !== prevZoom) {
    const rect = videoEl.getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width / 2;
    const cy = e.clientY - rect.top - rect.height / 2;
    // Adjust pan so the zoom centers around cursor
    _panX = ( _panX + cx ) * (_zoom / prevZoom) - cx;
    _panY = ( _panY + cy ) * (_zoom / prevZoom) - cy;
    applyVideoTransform();
  }
}, { passive: false });

videoEl.addEventListener('mousedown', (e) => {
  if (_zoom <= 1) return; // no pan when not zoomed
  if (e.button !== 0) return;
  _isDragging = true;
  videoEl.classList.add('dragging');
  _dragStartX = e.clientX;
  _dragStartY = e.clientY;
  _origPanX = _panX;
  _origPanY = _panY;
});

window.addEventListener('mousemove', (e) => {
  if (!_isDragging) return;
  const dx = e.clientX - _dragStartX;
  const dy = e.clientY - _dragStartY;
  _panX = _origPanX + dx;
  _panY = _origPanY + dy;
  applyVideoTransform();
});

window.addEventListener('mouseup', () => {
  if (_isDragging) {
    _isDragging = false;
    videoEl.classList.remove('dragging');
  applyVideoTransform();
  }
});

videoEl.addEventListener('mouseleave', () => {
  if (_isDragging) {
    _isDragging = false;
    videoEl.classList.remove('dragging');
  applyVideoTransform();
  }
});

videoEl.addEventListener('dblclick', () => {
  resetZoomPan();
});

// Reset zoom/pan whenever a new video loads
const _origLoadVideoAt = loadVideoAt;
loadVideoAt = function(i, keepPaused = true) { // override while preserving original
  _origLoadVideoAt(i, keepPaused);
  resetZoomPan();
};

