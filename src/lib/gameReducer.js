import { generatePin, generateTeamNames } from './utils';
import { DEFAULT_CATEGORIES } from './constants';

export const initialState = {
    view: 'landing',
    user: null,
    savedQuizzes: [],
    categories: DEFAULT_CATEGORIES,
    editingQuizIndex: null,
    session: {
        pin: null,
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
        case 'ADD_CATEGORY':
            if (state.categories.includes(action.payload)) return state;
            return { ...state, categories: [...state.categories, action.payload] };
        case 'DELETE_CATEGORY':
            return { ...state, categories: state.categories.filter(c => c !== action.payload) };
        case 'SAVE_QUIZ': {
            const newImportedQuiz = { ...action.payload, id: Date.now() };
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
            let jeopardyTeams = [];
            let questionModifiers = [];

            if (action.payload.settings.gameMode === 'jeopardy') {
                const teamNames = action.payload.settings.teamNames || generateTeamNames(action.payload.settings.jeopardyTeams);
                for (let i = 0; i < teamNames.length; i++) {
                    jeopardyTeams.push({ name: teamNames[i], score: 0 });
                }
                const qCount = action.payload.quizData.questions.length;
                for (let i = 0; i < qCount; i++) {
                    const rand = Math.random();
                    if (rand < 0.10) questionModifiers.push('gamble');
                    else if (rand < 0.30) questionModifiers.push('double');
                    else questionModifiers.push('normal');
                }
            }

            return {
                ...state,
                view: action.payload.settings.gameMode === 'solo' ? 'teacher_solo_share' :
                    (action.payload.settings.gameMode === 'jeopardy' ? 'teacher_game' : 'teacher_lobby'),
                session: {
                    ...state.session,
                    pin: generatePin(),
                    status: 'lobby',
                    quizData: action.payload.quizData,
                    settings: { ...state.session.settings, ...action.payload.settings },
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
        case 'PLAYER_JOIN':
            return {
                ...state,
                session: {
                    ...state.session,
                    players: [...state.session.players, { ...action.payload, lastAnsweredQuestionIndex: -1 }]
                }
            };
        case 'SEND_REACTION': {
            const newReaction = {
                id: Date.now(),
                emoji: action.payload.emoji,
                left: Math.random() * 80 + 10
            };
            return {
                ...state,
                session: {
                    ...state.session,
                    lobbyReactions: [...state.session.lobbyReactions, newReaction]
                }
            };
        }
        case 'REMOVE_REACTION':
            return {
                ...state,
                session: {
                    ...state.session,
                    lobbyReactions: state.session.lobbyReactions.filter(r => r.id !== action.payload)
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
            let points = 0;
            if (action.payload.isCorrect) {
                if (state.session.settings.scoreMode === 'speed' && state.session.settings.timerEnabled) {
                    const timeTaken = Date.now() - state.session.questionStartTime;
                    const totalTime = state.session.settings.timerDuration * 1000;
                    const ratio = 1 - (timeTaken / totalTime);
                    points = Math.round(500 + (500 * Math.max(0, ratio)));
                } else {
                    points = 100;
                }
            }
            const updatedPlayersAnswer = state.session.players.map(p =>
                p.id === action.payload.playerId
                    ? {
                        ...p,
                        score: p.score + points,
                        lastAnsweredQuestionIndex: state.session.currentQuestionIndex
                    }
                    : p
            );
            return { ...state, session: { ...state.session, players: updatedPlayersAnswer } };
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