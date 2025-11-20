import { generatePin, generateTeamNames } from './utils';
import { DEFAULT_CATEGORIES } from './constants';

export const initialState = {
    view: 'landing',
    user: null,
    savedQuizzes: [],
    categories: DEFAULT_CATEGORIES,
    editingQuizIndex: null,
    session: {
        id: null,          // NYTT: Vi behöver ID för att koppla mot DB
        pin_code: null,    // NYTT: Bytte namn från 'pin' till 'pin_code' för att matcha DB
        status: 'idle',
        currentQuestionIndex: -1,
        questionStartTime: null,
        settings: {
            gameMode: 'live',
            jeopardyTeams: 3,
            timerEnabled: false,
            timerDuration: 30,
            forceRandomNames: false,
            scoreMode: 'speed'
        },
        players: [],
        lobbyReactions: [],
        jeopardyState: {
            teams: [],
            completedQuestions: [],
            questionModifiers: [],
            currentTeamTurn: 0
        },
        quizData: null
    },
    currentPlayer: null
};

export const gameReducer = (state, action) => {
    switch (action.type) {
        case 'LOGIN_TEACHER':
            return { ...state, view: 'teacher_dashboard', user: action.payload };
        case 'SET_QUIZZES': {
            const loadedQuizzes = action.payload;
            const existingCategories = new Set(state.categories);
            loadedQuizzes.forEach(q => {
                if (q.category) existingCategories.add(q.category);
            });
            return {
                ...state,
                savedQuizzes: loadedQuizzes,
                categories: Array.from(existingCategories)
            };
        }
        case 'ADD_CATEGORY':
            if (state.categories.includes(action.payload)) return state;
            return { ...state, categories: [...state.categories, action.payload] };
        case 'DELETE_CATEGORY':
            return { ...state, categories: state.categories.filter(c => c !== action.payload) };
        case 'SAVE_QUIZ': {
            const newImportedQuiz = {
                ...action.payload,
                id: action.payload.id || Date.now()
            };
            if (!newImportedQuiz.category) newImportedQuiz.category = "Allmänt";
            let updatedCats = state.categories;
            if (!state.categories.includes(newImportedQuiz.category)) {
                updatedCats = [...state.categories, newImportedQuiz.category];
            }
            return { ...state, savedQuizzes: [...state.savedQuizzes, newImportedQuiz], categories: updatedCats };
        }
        case 'DELETE_QUIZ':
            return { ...state, savedQuizzes: state.savedQuizzes.filter((_, i) => i !== action.payload) };
        case 'START_EDITING_QUIZ':
            return { ...state, view: 'teacher_editor', editingQuizIndex: action.payload };
        case 'CREATE_EMPTY_QUIZ':
            return { ...state, view: 'teacher_editor', editingQuizIndex: -1 };
        case 'SAVE_EDITED_QUIZ': {
            const updatedQuiz = { ...action.payload };
            if (!updatedQuiz.category) updatedQuiz.category = "Allmänt";
            const updatedQuizzesList = [...state.savedQuizzes];
            if (state.editingQuizIndex !== null && state.editingQuizIndex >= 0) {
                updatedQuizzesList[state.editingQuizIndex] = updatedQuiz;
            } else {
                updatedQuizzesList.push({ ...updatedQuiz, id: Date.now() });
            }
            let updatedCatsAfterEdit = state.categories;
            if (!state.categories.includes(updatedQuiz.category)) {
                updatedCatsAfterEdit = [...state.categories, updatedQuiz.category];
            }
            return {
                ...state,
                savedQuizzes: updatedQuizzesList,
                categories: updatedCatsAfterEdit,
                view: 'teacher_dashboard',
                editingQuizIndex: null
            };
        }
        case 'UPDATE_QUIZ_TITLE': {
            const { index, newTitle } = action.payload;
            const quizzesWithUpdatedTitle = [...state.savedQuizzes];
            quizzesWithUpdatedTitle[index].title = newTitle;
            return { ...state, savedQuizzes: quizzesWithUpdatedTitle };
        }
        case 'CREATE_SESSION': {
            // Här hämtar vi datan som skapades i Dashboard (från Supabase)
            const { sessionId, pinCode, quizData, settings } = action.payload;

            let jeopardyTeams = [];
            let questionModifiers = [];

            if (settings.gameMode === 'jeopardy') {
                const teamNames = settings.teamNames || generateTeamNames(settings.jeopardyTeams);
                for (let i = 0; i < teamNames.length; i++) {
                    jeopardyTeams.push({ name: teamNames[i], score: 0 });
                }
                const qCount = quizData.questions.length;
                for (let i = 0; i < qCount; i++) {
                    const rand = Math.random();
                    if (rand < 0.10) questionModifiers.push('gamble');
                    else if (rand < 0.30) questionModifiers.push('double');
                    else questionModifiers.push('normal');
                }
            }
            return {
                ...state,
                view: settings.gameMode === 'solo' ? 'teacher_solo_share' :
                    (settings.gameMode === 'jeopardy' ? 'teacher_game' : 'teacher_lobby'),
                session: {
                    ...state.session,
                    id: sessionId,         // SPARAR ID FRÅN DB
                    pin_code: pinCode,     // SPARAR PIN FRÅN DB
                    status: 'lobby',
                    quizData: quizData,
                    settings: { ...state.session.settings, ...settings },
                    players: [],
                    lobbyReactions: [],
                    jeopardyState: {
                        teams: jeopardyTeams,
                        completedQuestions: [],
                        questionModifiers: questionModifiers,
                        currentTeamTurn: 0
                    }
                }
            };
        }
        case 'STUDENT_JOIN_SESSION': {
            const { session, player } = action.payload;
            return {
                ...state,
                view: 'student_lobby', // Byt till lobbyvyn
                session: { // Sätt elevens session-data baserat på det som hämtats
                    ...state.session,
                    id: session.id,
                    pin_code: session.pin_code,
                    status: session.status,
                    settings: session.settings,
                    quizData: session.quiz_snapshot // Nödvändig quiz-metadata
                },
                currentPlayer: player // Sätt elevens lokala spelarobjekt
            };
        }
        case 'ADD_PLAYER': // Bytte namn för att vara tydlig (samma som PLAYER_JOIN)
            // Kolla så vi inte lägger till samma spelare två gånger
            if (state.session.players.find(p => p.id === action.payload.id)) return state;
            return {
                ...state,
                session: {
                    ...state.session,
                    players: [...state.session.players, { ...action.payload, lastAnsweredQuestionIndex: -1 }]
                }
            };
        case 'START_GAME':
            return {
                ...state,
                view: 'teacher_game',
                session: {
                    ...state.session,
                    status: 'active',
                    currentQuestionIndex: 0,
                    questionStartTime: Date.now()
                }
            };
        case 'END_GAME':
            return {
                ...state,
                session: { ...state.session, status: 'finished' }
            };
        case 'NEXT_QUESTION':
            return {
                ...state,
                session: {
                    ...state.session,
                    currentQuestionIndex: state.session.currentQuestionIndex + 1,
                    questionStartTime: Date.now()
                }
            };
        case 'PLAYER_ANSWER': {
            // Uppdatera spelarens poäng lokalt om vi vill
            return state;
        }
        case 'JEOPARDY_AWARD_POINTS': {
            const { teamIndex, points: jPoints } = action.payload;
            const teamsCopy = [...state.session.jeopardyState.teams];
            teamsCopy[teamIndex].score += jPoints;
            return {
                ...state,
                session: {
                    ...state.session,
                    jeopardyState: { ...state.session.jeopardyState, teams: teamsCopy }
                }
            };
        }
        case 'JEOPARDY_COMPLETE_QUESTION': {
            const nextTurn = (state.session.jeopardyState.currentTeamTurn + 1) % state.session.jeopardyState.teams.length;
            return {
                ...state,
                session: {
                    ...state.session,
                    jeopardyState: {
                        ...state.session.jeopardyState,
                        completedQuestions: [...state.session.jeopardyState.completedQuestions, action.payload.index],
                        currentTeamTurn: nextTurn
                    }
                }
            };
        }
        case 'SET_VIEW': return { ...state, view: action.payload };
        case 'SET_CURRENT_PLAYER': return { ...state, currentPlayer: action.payload };
        case 'RESET_APP': return { ...state, view: 'teacher_dashboard', session: initialState.session };
        case 'LOGOUT': return initialState;
        default: return state;
    }
};

