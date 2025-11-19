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

export const AI_PROMPT_TEXT = `Skapa ett JSON-objekt för ett quiz med 15 frågor. 
Strukturen måste vara strikt enligt följande format:

{
  "title": "Titel på quizet",
  "questions": [
    {
      "question": "Frågetext?",
      "options": ["Alt 1", "Alt 2", "Alt 3", "Alt 4"],
      "correctAnswerIndex": 0,
      "explanation": "Kort förklaring."
    }
  ]
}
Svara med endast JSON-objektet. Inget annat.
`;

export const DEFAULT_QUIZ_JSON = JSON.stringify({
    title: "Exempel: Webb & Design",
    category: "Webbutveckling",
    questions: [
        {
            question: "Vad står HTML för?",
            options: ["HyperText Markup Language", "HighTech Made Language", "Home Tool Markup Language", "Hyperlinks and Text Markup Language"],
            correctAnswerIndex: 0,
            explanation: "HTML är standardspråket för att skapa webbsidor."
        },
        {
            question: "Vilken CSS-egenskap ändrar textfärg?",
            options: ["text-color", "font-color", "color", "foreground"],
            correctAnswerIndex: 2,
            explanation: "'color' styr textens färg i CSS, medan 'background-color' styr bakgrunden."
        }
    ]

}, null, 2);
