import type { Icon } from "@tabler/icons-react";
import {
  IconAbc,
  IconApple,
  IconAtom,
  IconBallFootball,
  IconBallTennis,
  IconBarbell,
  IconBike,
  IconBolt,
  IconBook,
  IconBrain,
  IconBriefcase,
  IconBrush,
  IconBug,
  IconBuildingBank,
  IconBuildingFactory,
  IconBuildingMonument,
  IconBuildingSkyscraper,
  IconBulb,
  IconCalculator,
  IconCamera,
  IconCandle,
  IconCar,
  IconCards,
  IconChartBar,
  IconChartHistogram,
  IconChefHat,
  IconChess,
  IconCloud,
  IconCode,
  IconCoffee,
  IconCoin,
  IconCompass,
  IconConfetti,
  IconCookie,
  IconCpu,
  IconCube,
  IconDatabase,
  IconDeviceGamepad2,
  IconDeviceMobile,
  IconDice,
  IconDna,
  IconDroplet,
  IconEngine,
  IconFeather,
  IconFish,
  IconFlag,
  IconFlask,
  IconFlower,
  IconGuitarPick,
  IconHammer,
  IconHeadphones,
  IconHeartbeat,
  IconHome,
  IconHorse,
  IconKarate,
  IconLanguage,
  IconLanguageHiragana,
  IconLeaf,
  IconMagnet,
  IconMasksTheater,
  IconMathFunction,
  IconMicrophone,
  IconMicrophone2,
  IconMicroscope,
  IconMountain,
  IconMovie,
  IconMusic,
  IconNeedleThread,
  IconNetwork,
  IconNotes,
  IconPalette,
  IconPaw,
  IconPencil,
  IconPiano,
  IconPigMoney,
  IconPill,
  IconPlane,
  IconPlaneDeparture,
  IconPresentation,
  IconPuzzle,
  IconRecycle,
  IconRobot,
  IconRocket,
  IconRuler2,
  IconRun,
  IconSailboat,
  IconSatellite,
  IconScale,
  IconSchool,
  IconScissors,
  IconSeedling,
  IconShieldLock,
  IconShirt,
  IconSnowboarding,
  IconSpeakerphone,
  IconStethoscope,
  IconSun,
  IconSwimming,
  IconSword,
  IconTargetArrow,
  IconTelescope,
  IconTent,
  IconTerminal2,
  IconTimeline,
  IconTool,
  IconTree,
  IconTrendingUp,
  IconTriangle,
  IconTrophy,
  IconTypography,
  IconUsers,
  IconVector,
  IconVirus,
  IconWaveSine,
  IconWorld,
  IconWorldWww,
  IconWriting,
  IconYarn,
  IconYinYang,
  IconYoga,
} from "@tabler/icons-react";
import { SUBJECT_ICONS, type Subject, type SubjectIcon } from "@halolesson/shared";

export interface SubjectIconInfo {
  id: SubjectIcon;
  Icon: Icon;
  label: string;
  // Lowercase words and phrases a subject name may contain; used by search and Auto.
  keywords: string[];
}

const entry = (id: SubjectIcon, Icon: Icon, label: string, keywords: string[]): SubjectIconInfo => ({ id, Icon, label, keywords });

// One row per icon: id (stored in the database), glyph, label, search keywords.
const infoList: SubjectIconInfo[] = [
  entry("atom", IconAtom, "Physics", ["physics", "atoms", "quantum", "particles", "mechanics", "science"]),
  entry("world", IconWorld, "Geography", ["geography", "world", "earth", "countries", "global", "maps", "culture"]),
  entry("math", IconMathFunction, "Math", ["math", "maths", "mathematics", "algebra", "calculus", "functions", "equations"]),
  entry("flask", IconFlask, "Chemistry", ["chemistry", "chemical", "lab", "experiments", "reactions", "science"]),
  entry("code", IconCode, "Programming", ["programming", "coding", "code", "software", "development", "javascript", "python", "typescript", "developer"]),
  entry("palette", IconPalette, "Art", ["art", "color", "colour", "painting", "creative", "design"]),
  entry("book", IconBook, "Reading", ["reading", "book", "books", "study", "learning", "course"]),
  entry("music", IconMusic, "Music", ["music", "songs", "theory", "listening", "composition"]),
  entry("language", IconLanguage, "Languages", ["language", "languages", "english", "spanish", "french", "german", "vocabulary", "grammar", "linguistics"]),
  entry("heart", IconHeartbeat, "Health", ["health", "wellness", "heart", "cardio", "first aid", "care"]),
  entry("rocket", IconRocket, "Rocket science", ["rocket", "aerospace", "space", "launch", "astronautics", "spaceflight"]),
  entry("bulb", IconBulb, "Ideas", ["ideas", "creativity", "innovation", "general", "thinking", "invention"]),
  entry("dna", IconDna, "Biology", ["biology", "genetics", "dna", "cells", "life science", "genes", "evolution"]),
  entry("microscope", IconMicroscope, "Microscopy", ["microscope", "microbiology", "cell biology", "lab", "histology", "research"]),
  entry("virology", IconVirus, "Virology", ["virus", "virology", "epidemiology", "pathogens", "bacteria", "immunology", "infection"]),
  entry("ecology", IconLeaf, "Ecology", ["ecology", "environment", "nature", "botany", "plants", "sustainability", "environmental science"]),
  entry("astronomy", IconTelescope, "Astronomy", ["astronomy", "stars", "telescope", "cosmology", "astrophysics", "sky", "universe"]),
  entry("mechanical", IconEngine, "Mechanical engineering", ["mechanical", "engineering", "engines", "machines", "thermodynamics", "mechanics", "automotive"]),
  entry("electricity", IconBolt, "Electrical engineering", ["electrical", "electricity", "power", "voltage", "energy", "electronics"]),
  entry("electronics", IconCpu, "Electronics", ["electronics", "hardware", "computer architecture", "microcontroller", "arduino", "chips", "embedded"]),
  entry("civil", IconBuildingSkyscraper, "Civil engineering", ["civil", "construction", "structures", "buildings", "urban", "structural"]),
  entry("architecture", IconRuler2, "Architecture", ["architecture", "drafting", "blueprint", "technical drawing", "measurement", "surveying"]),
  entry("data", IconChartBar, "Data science", ["data science", "data", "analytics", "analysis", "visualization", "charts", "business intelligence"]),
  entry("databases", IconDatabase, "Databases", ["database", "sql", "databases", "data engineering", "storage", "postgres", "nosql"]),
  entry("computer-science", IconTerminal2, "Computer science", ["computer science", "cs", "algorithms", "command line", "linux", "terminal", "shell", "systems", "operating systems"]),
  entry("ai", IconRobot, "AI and ML", ["ai", "artificial intelligence", "machine learning", "ml", "deep learning", "neural networks", "robotics", "llm"]),
  entry("neuroscience", IconBrain, "Neuroscience", ["neuroscience", "brain", "psychology", "cognition", "cognitive", "mind", "neurology", "memory"]),
  entry("statistics", IconChartHistogram, "Statistics", ["statistics", "probability", "stats", "distribution", "data analysis", "biostatistics"]),
  entry("geology", IconMountain, "Geology", ["geology", "rocks", "minerals", "earth science", "mountains", "hiking", "climbing", "volcano"]),
  entry("medicine", IconStethoscope, "Medicine", ["medicine", "medical", "doctor", "anatomy", "physiology", "clinical", "nursing", "physician"]),
  entry("pharmacy", IconPill, "Pharmacology", ["pharmacology", "pharmacy", "drugs", "medication", "pharmaceutical"]),
  entry("economics", IconCoin, "Economics", ["economics", "economy", "money", "microeconomics", "macroeconomics", "markets", "trade"]),
  entry("law", IconScale, "Law", ["law", "legal", "justice", "court", "legislation", "jurisprudence", "rights"]),
  entry("history", IconBuildingMonument, "History", ["history", "historical", "ancient", "civilization", "archaeology", "heritage", "war"]),
  entry("philosophy", IconYinYang, "Philosophy", ["philosophy", "ethics", "logic", "metaphysics", "stoicism", "thought", "religion"]),
  entry("sociology", IconUsers, "Sociology", ["sociology", "society", "social science", "anthropology", "community", "groups"]),
  entry("education", IconSchool, "Education", ["education", "teaching", "school", "pedagogy", "teacher", "classroom", "tutoring"]),
  entry("literature", IconFeather, "Literature", ["literature", "poetry", "poems", "novels", "writing", "creative writing", "fiction", "authoring"]),
  entry("literacy", IconAbc, "Alphabet", ["alphabet", "literacy", "spelling", "phonics", "letters", "reading basics", "early learning"]),
  entry("japanese", IconLanguageHiragana, "Japanese", ["japanese", "hiragana", "kanji", "asian languages", "chinese", "korean", "mandarin"]),
  entry("finance", IconBuildingBank, "Finance", ["finance", "banking", "bank", "economics", "accounting", "financial"]),
  entry("investing", IconTrendingUp, "Investing", ["investing", "stocks", "investment", "trading", "portfolio", "crypto", "markets", "wealth"]),
  entry("saving", IconPigMoney, "Saving", ["saving", "savings", "budgeting", "personal finance", "budget", "frugal"]),
  entry("accounting", IconCalculator, "Accounting", ["accounting", "bookkeeping", "tax", "calculator", "arithmetic"]),
  entry("business", IconBriefcase, "Business", ["business", "management", "career", "entrepreneurship", "startup", "work", "professional"]),
  entry("marketing", IconSpeakerphone, "Marketing", ["marketing", "advertising", "sales", "branding", "promotion", "seo", "social media"]),
  entry("public-speaking", IconPresentation, "Public speaking", ["public speaking", "presentation", "speech", "presenting", "debate", "communication", "rhetoric"]),
  entry("project", IconTimeline, "Project management", ["project management", "planning", "agile", "productivity", "roadmap", "scrum"]),
  entry("politics", IconFlag, "Politics", ["politics", "government", "political science", "policy", "civics", "diplomacy"]),
  entry("security", IconShieldLock, "Cybersecurity", ["cybersecurity", "security", "hacking", "cryptography", "infosec", "privacy", "encryption"]),
  entry("networking", IconNetwork, "Networking", ["networking", "network", "internet", "protocols", "sysadmin", "cloud", "devops", "infrastructure"]),
  entry("web", IconWorldWww, "Web development", ["web development", "web design", "html", "css", "frontend", "website", "react"]),
  entry("mobile", IconDeviceMobile, "App development", ["mobile", "app development", "android", "ios", "apps", "swift", "kotlin"]),
  entry("satellites", IconSatellite, "Satellites", ["satellites", "orbit", "remote sensing", "gps", "space technology", "astronautics"]),
  entry("weather", IconCloud, "Meteorology", ["meteorology", "weather", "climate", "atmosphere", "climatology", "clouds"]),
  entry("hydrology", IconDroplet, "Hydrology", ["hydrology", "water", "oceanography", "fluids", "fluid mechanics", "liquids"]),
  entry("solar", IconSun, "Solar energy", ["solar", "renewable energy", "sun", "energy", "photovoltaic", "daylight"]),
  entry("magnetism", IconMagnet, "Magnetism", ["magnetism", "magnets", "electromagnetism", "field theory"]),
  entry("signals", IconWaveSine, "Signals", ["signals", "waves", "signal processing", "acoustics", "frequency", "oscillation", "fourier"]),
  entry("geometry", IconTriangle, "Geometry", ["geometry", "trigonometry", "shapes", "triangles", "topology"]),
  entry("industry", IconBuildingFactory, "Manufacturing", ["manufacturing", "industry", "factory", "industrial engineering", "production", "supply chain"]),
  entry("repair", IconTool, "Repair", ["repair", "fix", "maintenance", "diy", "tools", "handyman", "mechanic"]),
  entry("marine", IconFish, "Marine biology", ["marine biology", "fish", "fishing", "ocean", "aquarium", "sea", "aquatic"]),
  entry("insects", IconBug, "Entomology", ["entomology", "insects", "bugs", "zoology", "debugging"]),
  entry("pets", IconPaw, "Pets", ["pets", "dogs", "cats", "animals", "animal care", "veterinary", "zoology", "training"]),
  entry("horse", IconHorse, "Horse riding", ["horse", "horses", "riding", "equestrian", "equine"]),
  entry("forestry", IconTree, "Forestry", ["forestry", "trees", "forest", "woodland", "arborist"]),
  entry("gardening", IconSeedling, "Gardening", ["gardening", "garden", "plants", "growing", "farming", "vegetables", "permaculture", "agriculture"]),
  entry("flowers", IconFlower, "Flowers", ["flowers", "floral", "botany", "florist", "flower arranging", "bonsai"]),
  entry("needle-thread", IconNeedleThread, "Sewing", ["sewing", "stitching", "tailoring", "embroidery", "needlework", "fabric", "quilting"]),
  entry("knitting", IconYarn, "Knitting", ["knitting", "crochet", "yarn", "wool", "fiber arts", "weaving"]),
  entry("fashion", IconShirt, "Fashion", ["fashion", "clothing", "style", "clothes", "apparel", "textile"]),
  entry("cooking", IconChefHat, "Cooking", ["cooking", "cuisine", "chef", "recipes", "kitchen", "culinary", "food"]),
  entry("baking", IconCookie, "Baking", ["baking", "pastry", "bread", "cakes", "desserts", "sourdough", "cookies"]),
  entry("coffee", IconCoffee, "Coffee", ["coffee", "barista", "espresso", "tea", "brewing", "cafe"]),
  entry("nutrition", IconApple, "Nutrition", ["nutrition", "diet", "healthy eating", "dietetics", "food science", "fruit"]),
  entry("woodworking", IconHammer, "Woodworking", ["woodworking", "carpentry", "building", "woodwork", "furniture", "joinery", "workshop", "metalwork"]),
  entry("painting", IconBrush, "Painting", ["painting", "oil painting", "watercolor", "acrylic", "canvas", "brush", "gouache"]),
  entry("drawing", IconPencil, "Drawing", ["drawing", "sketching", "illustration", "sketch", "pencil", "cartoon", "comics", "manga"]),
  entry("photography", IconCamera, "Photography", ["photography", "camera", "photo", "lenses", "photos", "portrait", "editing"]),
  entry("film", IconMovie, "Film", ["film", "cinema", "movies", "video", "filmmaking", "directing", "screenwriting", "editing"]),
  entry("podcast", IconMicrophone2, "Podcasting", ["podcasting", "podcast", "audio", "radio", "broadcast", "recording", "voice"]),
  entry("singing", IconMicrophone, "Singing", ["singing", "vocals", "voice", "karaoke", "choir", "vocal training"]),
  entry("guitar", IconGuitarPick, "Guitar", ["guitar", "bass", "strings", "chords", "acoustic", "electric guitar", "ukulele"]),
  entry("piano", IconPiano, "Piano", ["piano", "keyboard", "keys", "synth", "organ", "pianist"]),
  entry("production", IconHeadphones, "Music production", ["music production", "audio engineering", "beats", "mixing", "djing", "dj", "sound design", "producer"]),
  entry("theatre", IconMasksTheater, "Theatre", ["theatre", "theater", "drama", "acting", "performing", "improv", "stage"]),
  entry("music-theory", IconNotes, "Music theory", ["music theory", "notation", "sheet music", "solfege", "harmony", "ear training"]),
  entry("dance", IconConfetti, "Dance", ["dance", "dancing", "ballet", "hip hop", "salsa", "choreography"]),
  entry("fitness", IconBarbell, "Fitness", ["fitness", "gym", "weights", "workout", "strength", "lifting", "bodybuilding", "exercise", "training"]),
  entry("running", IconRun, "Running", ["running", "jogging", "marathon", "sprint", "athletics", "track", "cardio"]),
  entry("cycling", IconBike, "Cycling", ["cycling", "bicycle", "bike", "mountain biking", "biking"]),
  entry("swimming", IconSwimming, "Swimming", ["swimming", "pool", "diving", "water polo", "freestyle"]),
  entry("yoga", IconYoga, "Yoga", ["yoga", "stretching", "flexibility", "pilates", "mobility", "asana"]),
  entry("martial-arts", IconKarate, "Martial arts", ["martial arts", "karate", "judo", "boxing", "taekwondo", "jiu-jitsu", "bjj", "kickboxing", "self defense"]),
  entry("fencing", IconSword, "Fencing", ["fencing", "swords", "sword", "kendo", "hema", "historical combat"]),
  entry("archery", IconTargetArrow, "Archery", ["archery", "bow", "arrows", "shooting", "goals", "aim", "precision", "darts"]),
  entry("football", IconBallFootball, "Football", ["football", "soccer", "rugby", "team sports", "goalkeeper"]),
  entry("tennis", IconBallTennis, "Tennis", ["tennis", "racket", "badminton", "squash", "table tennis", "padel"]),
  entry("snow", IconSnowboarding, "Snow sports", ["snowboarding", "skiing", "ski", "snow", "winter sports", "ice skating"]),
  entry("competition", IconTrophy, "Competition", ["competition", "trophy", "contests", "olympiad", "tournament", "achievement", "awards"]),
  entry("chess", IconChess, "Chess", ["chess", "strategy", "board games", "openings", "tactics", "go", "checkers"]),
  entry("gaming", IconDeviceGamepad2, "Gaming", ["gaming", "video games", "games", "esports", "game", "console", "speedrun"]),
  entry("cards", IconCards, "Card games", ["card games", "poker", "cards", "magic", "bridge", "tcg", "blackjack"]),
  entry("puzzles", IconPuzzle, "Puzzles", ["puzzles", "puzzle", "rubik", "cube", "riddles", "sudoku", "brain teasers", "crossword"]),
  entry("tabletop", IconDice, "Tabletop games", ["tabletop", "dnd", "dungeons", "dice", "role playing", "rpg", "board game"]),
  entry("driving", IconCar, "Driving", ["driving", "car", "license", "road", "driver", "traffic", "motoring"]),
  entry("travel", IconPlane, "Travel", ["travel", "trip", "flying", "tourism", "journey", "vacation", "abroad", "airplane"]),
  entry("aviation", IconPlaneDeparture, "Aviation", ["aviation", "pilot", "flight", "aircraft", "aeronautics", "flying lessons"]),
  entry("sailing", IconSailboat, "Sailing", ["sailing", "boat", "boating", "nautical", "navigation", "sea", "yacht", "kayak", "rowing"]),
  entry("navigation", IconCompass, "Navigation", ["navigation", "compass", "orienteering", "exploration", "cartography", "maps", "wayfinding"]),
  entry("camping", IconTent, "Camping", ["camping", "outdoors", "survival", "bushcraft", "scouting", "wilderness", "hiking trips"]),
  entry("meditation", IconCandle, "Meditation", ["meditation", "mindfulness", "calm", "zen", "relaxation", "spirituality", "buddhism"]),
  entry("3d", IconCube, "3D modeling", ["3d", "modeling", "blender", "cad", "sculpting", "rendering", "3d printing", "animation", "game art"]),
  entry("graphic-design", IconVector, "Graphic design", ["graphic design", "vector", "illustrator", "logo", "layout", "typography", "ui", "ux", "figma"]),
  entry("typography", IconTypography, "Typography", ["typography", "fonts", "lettering", "calligraphy", "handwriting", "type"]),
  entry("crafts", IconScissors, "Crafts", ["crafts", "craft", "diy", "papercraft", "origami", "scrapbooking", "handmade", "hobby"]),
  entry("sustainability", IconRecycle, "Sustainability", ["sustainability", "recycling", "zero waste", "green", "upcycling", "climate action"]),
  entry("home", IconHome, "Home", ["home", "household", "interior design", "housekeeping", "organizing", "real estate", "cleaning"]),
  entry("writing", IconWriting, "Writing", ["writing", "notes", "journaling", "blogging", "essays", "copywriting", "journal", "author"]),
];

const infoById = new Map<SubjectIcon, SubjectIconInfo>(infoList.map((info) => [info.id, info]));

// The picker shows icons in SUBJECT_ICONS order.
export const SUBJECT_ICON_INFO: SubjectIconInfo[] = SUBJECT_ICONS.map((id) => infoById.get(id)!);

export const subjectIcons = Object.fromEntries(SUBJECT_ICON_INFO.map((info) => [info.id, info.Icon])) as Record<SubjectIcon, Icon>;

export function iconLabel(icon: SubjectIcon): string {
  return infoById.get(icon)!.label;
}

const words = (text: string) => text.toLowerCase().split(/[^\p{L}\p{N}+#]+/u).filter(Boolean);

// Keywords and words are compared after stripping a plural "s" so "languages" finds "language".
const stem = (word: string) => (word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word);

// Icons whose label or keywords contain every word of the query as a word prefix, or the whole phrase.
export function searchIcons(query: string): SubjectIconInfo[] {
  const terms = words(query);
  if (terms.length === 0) return SUBJECT_ICON_INFO;
  return SUBJECT_ICON_INFO.filter((info) => {
    const haystack = words([info.label, info.id, ...info.keywords].join(" "));
    return terms.every((term) => haystack.some((word) => word.startsWith(term) || stem(word).startsWith(stem(term))));
  });
}

// Score of one icon for a text: whole keyword phrase found = 3 + words, single-word match = 2.
function score(info: SubjectIconInfo, textWords: string[], padded: string): number {
  const stems = new Set(textWords.map(stem));
  let total = 0;
  for (const keyword of [info.label.toLowerCase(), ...info.keywords]) {
    const keywordWords = words(keyword);
    if (keywordWords.length === 0) continue;
    if (keywordWords.length > 1) {
      if (padded.includes(` ${keywordWords.join(" ")} `)) total += 2 + keywordWords.length;
    } else if (stems.has(stem(keywordWords[0]!))) total += 2;
  }
  return total;
}

// Best matching icon for a subject's name (name matches count triple against the description), or null.
export function matchIcon(name: string, description = ""): SubjectIcon | null {
  const nameWords = words(name);
  const descriptionWords = words(description);
  const namePadded = ` ${nameWords.join(" ")} `;
  const descriptionPadded = ` ${descriptionWords.join(" ")} `;
  let best: SubjectIcon | null = null;
  let bestScore = 0;
  for (const info of SUBJECT_ICON_INFO) {
    const total = score(info, nameWords, namePadded) * 3 + score(info, descriptionWords, descriptionPadded);
    if (total > bestScore) { best = info.id; bestScore = total; }
  }
  return best;
}

function hashIcon(seed: string): SubjectIcon {
  const hash = [...seed.trim().toLowerCase()].reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 7);
  return SUBJECT_ICONS[hash % 6]!;
}

// Auto: the icon whose keywords best match the name (and description), else a
// stable pick from the name, so the picker's preview and the saved item agree.
export function autoIcon(name: string, description?: string): SubjectIcon {
  return matchIcon(name, description) ?? hashIcon(name);
}

export function iconFor(subject: Pick<Subject, "icon" | "name"> & { description?: string }): Icon {
  return subjectIcons[subject.icon ?? autoIcon(subject.name, subject.description)];
}
