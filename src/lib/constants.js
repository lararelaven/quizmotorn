export const ADJECTIVES = [
    'Glad', 'Snabb', 'Lurig', 'Tokig', 'Smart', 'Stark', 'Vild', 'Modig', 'Röd', 'Blå',
    'Hoppande', 'Sömnig', 'Listig', 'Pigg', 'Cool', 'Super', 'Mega', 'Ultra', 'Episk',
    'Galen', 'Brutal', 'Enorm', 'Liten', 'Arg', 'Sur', 'Glansig', 'Digital', 'Analog', 'Koffein', 'Laggande'
];

export const NOUNS = [
    'Banan', 'Tiger', 'Robot', 'Kaktus', 'Muffin', 'Drake', 'Ninja', 'Pirat', 'Viking',
    'Katt', 'Hund', 'Uggla', 'Räv', 'Björn', 'Haj', 'Örn', 'Säl', 'Val', 'Panda',
    'Zombie', 'Spöke', 'Alien', 'Troll', 'Gurka', 'Potatis', 'Bug', 'Server', 'Pixel', 'Router', 'Skärm'
];

export const FUN_TEAM_NAMES = [
    "Syntax Error", "Lag Lagg", "Kaffeknarkarna", "Ctrl+Alt+Defeat", "404 Brain Not Found",
    "De Vilda Vetrarna", "Google Mästrarna", "Quiz-Riddarna", "Den Sista Cellen", "Beta Testarna",
    "Hårddiskarna", "Pixel Piraterna", "Cyber-Svamparna", "De Analoga", "Zoom-Zombies",
    "Git Push It", "JavaSipparna", "Python Ormarna", "CSS-Stylisterna", "HTML-Hjältarna",
    "Data Dårarna", "Skärmsläckarna", "Tangentbordskrigarna", "Wi-Fi Visarna", "Buffrarna",
    "Binära Björnarna", "Kompilerarna", "Bug Jägarna", "Ram-Minnesmästarna", "Blue Screen Survivors"
];

export const DEFAULT_CATEGORIES = [
    "Allmänt"
];

export const JEOPARDY_COLORS = [
    'bg-pink-200 hover:bg-pink-300 text-pink-900',
    'bg-blue-200 hover:bg-blue-300 text-blue-900',
    'bg-yellow-200 hover:bg-yellow-300 text-yellow-900',
    'bg-purple-200 hover:bg-purple-300 text-purple-900',
    'bg-green-200 hover:bg-green-300 text-green-900',
    'bg-orange-200 hover:bg-orange-300 text-orange-900'
];

const BASE_INTRO = "Agera som en expertlärare på gymnasienivå. Skapa ett JSON-objekt för ett quiz med 12 frågor.";
const JSON_STRUCTURE = `Strukturen måste vara strikt enligt följande format: {"title": "Titel", "questions": [{"question": "Fråga?", "options": ["Alt 1", "Alt 2", "Alt 3", "Alt 4"], "correctAnswerIndex": 0, "explanation": "Kort förklaring"}]}. Svara med endast JSON-objektet. Inget annat.`;

export const AI_PROMPT_TEXT = `${BASE_INTRO} ${JSON_STRUCTURE}`;

export const PARTY_TOPICS = [
    "Bilmärken", "Odling", "Naturkunskap", "Matematik", "Historia", "Kändisar", "Geografi", "Film", "Musik", "Sport",
    "Djur", "Rymden", "Teknik", "Matlagning", "Litteratur", "Konst", "Politik", "Ekonomi", "Psykologi", "Filosofi",
    "Religion", "Språk", "Kemi", "Fysik", "Biologi", "Medicin", "Astronomi", "Arkitektur", "Mode", "Design",
    "Fotografi", "Dans", "Teater", "Spel", "Serier", "Anime", "Manga", "K-pop", "Hiphop", "Rock",
    "Jazz", "Klassisk musik", "Opera", "Musikal", "Cirkus", "Trolleri", "Stand-up", "Improvisationsteater", "Poesi", "Noveller",
    "Romaner", "Deckare", "Fantasy", "Sci-fi", "Skräck", "Thriller", "Komedi", "Drama", "Action", "Äventyr",
    "Dokumentär", "Reality-TV", "Nyheter", "Väder", "Klimat", "Miljö", "Hållbarhet", "Återvinning", "Energi", "Transport",
    "Resor", "Turism", "Kultur", "Traditioner", "Högtider", "Matkultur", "Dryckeskultur", "Kaffekultur", "Tekultur", "Vinkultur",
    "Ölkultur", "Whiskykultur", "Cocktailkultur", "Bakning", "Grillning", "Vegetariskt", "Veganskt", "Kött", "Fisk", "Skaldjur",
    "Frukt", "Grönsaker", "Bär", "Svamp", "Kryddor", "Örter", "Blommor", "Träd", "Buskar", "Gräs"
];

export const PROMPT_TEMPLATES = {
    "Standard": {
        label: "Standard",
        description: "Vanligt quiz med 12 frågor",
        prompt: AI_PROMPT_TEXT
    },
    "Luriga Fällan": {
        label: "Luriga Fällan",
        description: "Fokus på missuppfattningar",
        prompt: `${BASE_INTRO} Fokusera på vanliga missuppfattningar. De felaktiga svarsalternativen måste vara "troliga fel" som man gör om man inte förstått fullt ut. ${JSON_STRUCTURE}`
    },
    "Exit Ticket": {
        label: "Exit Ticket",
        description: "Snabba kontrollfrågor",
        prompt: `${BASE_INTRO} Frågorna ska vara snabba att läsa och kontrollera att man förstått den absoluta kärnan i materialet. ${JSON_STRUCTURE}`
    },
    "Nivåstegrande": {
        label: "Nivåstegrande",
        description: "Från enkelt till svårt",
        prompt: `${BASE_INTRO} Börja med 4 enkla minnesfrågor, följ upp med 4 frågor om förståelse, och avsluta med 4 svåra frågor som kräver analys/tillämpning, men försök hålla ner textmängden. ${JSON_STRUCTURE}`
    },
    "Party": {
        label: "Party",
        description: "Slumpat ämne för fest",
        prompt: (topic) => `${BASE_INTRO} Skapa frågor om ämnet: ${topic}. ${JSON_STRUCTURE}`
    }
};

export const DEFAULT_QUIZ_JSON = JSON.stringify({ "title": "Matkultur och Hälsa", "questions": [{ "question": "Vad kännetecknar främst den så kallade 'medelhavskosten' ur ett närings- och kulturperspektiv?", "options": ["Ett högt intag av omättade fetter (t.ex. olivolja), grönsaker, baljväxter och fisk", "En kost som helt utesluter kolhydrater och fokuserar enbart på animaliskt protein", "En diet baserad huvudsakligen på mejeriprodukter och rött kött", "En modern kosthållning som bygger på processade ersättningsprodukter"], "correctAnswerIndex": 0, "explanation": "Medelhavskosten bygger traditionellt på råvaror som finns runt Medelhavet, med fokus på nyttiga fetter, mycket vegetabilier och mindre andel rött kött." }] });
