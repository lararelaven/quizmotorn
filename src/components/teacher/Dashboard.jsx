'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Plus, Bot, Copy, BookOpen, Edit2, Trash2, Smartphone, Grid,
    Settings, X, Shuffle, Zap, CheckCircle, LogOut, Gamepad2, Tag, FilePlus, ArrowRight, AlertTriangle, Save, Loader2, Trophy
} from 'lucide-react';
import { AI_PROMPT_TEXT, DEFAULT_QUIZ_JSON, PROMPT_TEMPLATES, PARTY_TOPICS } from '../../lib/constants';
import { generateTeamNames, generatePin } from '../../lib/utils';
import { supabase } from '@/lib/supabase';

export default function TeacherDashboard({ state, dispatch }) {
    const router = useRouter();
    const [jsonInput, setJsonInput] = useState("");
    const [error, setError] = useState('');
    const [jeopardyConfig, setJeopardyConfig] = useState(null);
    const [liveConfig, setLiveConfig] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState("Alla");
    const [showCategoryManager, setShowCategoryManager] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [quizToDelete, setQuizToDelete] = useState(null);

    // Prompt Template State
    const [templates, setTemplates] = useState(() => {
        return Object.entries(PROMPT_TEMPLATES).map(([key, val]) => ({
            id: key,
            ...val
        }));
    });
    const [selectedPromptTemplate, setSelectedPromptTemplate] = useState("Standard");
    const [currentPromptText, setCurrentPromptText] = useState(AI_PROMPT_TEXT);
    const [showTemplateManager, setShowTemplateManager] = useState(false);
    const [draggedItem, setDraggedItem] = useState(null);
    const [editingTemplateId, setEditingTemplateId] = useState(null);

    useEffect(() => {
        const saved = localStorage.getItem('quiz_templates');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    setTemplates(parsed);
                } else {
                    // Migration from object to array
                    setTemplates(Object.entries(parsed).map(([key, val]) => ({ id: key, ...val })));
                }
            } catch (e) {
                console.error("Failed to parse templates", e);
            }
        }
    }, []);

    const updateTemplates = (newTemplates) => {
        setTemplates(newTemplates);
        localStorage.setItem('quiz_templates', JSON.stringify(newTemplates));
    };

    const [startingSession, setStartingSession] = useState(false);

    useEffect(() => {
        const fetchQuizzes = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('quizzes')
                .select('*')
                .eq('creator_id', user.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Kunde inte hämta quiz:", error);
            } else if (data) {
                dispatch({ type: 'SET_QUIZZES', payload: data });
            }
        };
        fetchQuizzes();
    }, []);

    const handleSaveQuiz = async () => {
        try {
            if (!jsonInput.trim()) { setError("Ingen data inmatad"); return; }
            const parsed = JSON.parse(jsonInput);

            if (!parsed.questions || !Array.isArray(parsed.questions)) {
                throw new Error("JSON saknar 'questions' array.");
            }

            const shuffle = (array) => {
                // Don't shuffle if it's Sant/Falskt
                const isTrueFalse = array.length === 2 &&
                    array.some(a => String(a).toLowerCase() === 'sant') &&
                    array.some(a => String(a).toLowerCase() === 'falskt');

                if (isTrueFalse) {
                    // Ensure Sant comes first
                    return array.sort((a, b) => {
                        if (String(a).toLowerCase() === 'sant') return -1;
                        if (String(b).toLowerCase() === 'sant') return 1;
                        return 0;
                    });
                }

                let currentIndex = array.length, randomIndex;
                while (currentIndex !== 0) {
                    randomIndex = Math.floor(Math.random() * currentIndex);
                    currentIndex--;
                    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
                }
                return array;
            };

            const processedQuestions = parsed.questions.map(q => {
                const correctOptionText = q.options[q.correctAnswerIndex];
                const shuffledOptions = shuffle([...q.options]);
                const newAnswerIndex = shuffledOptions.indexOf(correctOptionText);
                return { ...q, options: shuffledOptions, correctAnswerIndex: newAnswerIndex };
            });

            parsed.questions = processedQuestions;

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data, error } = await supabase
                    .from('quizzes')
                    .insert([{
                        title: parsed.title || "Importerat Quiz",
                        description: parsed.description || "",
                        category: parsed.category || "Allmänt",
                        questions: parsed.questions,
                        creator_id: user.id
                    }])
                    .select()
                    .single();

                if (error) throw new Error(error.message);

                dispatch({ type: 'SAVE_QUIZ', payload: data });
                setError('');
                setJsonInput("");
            }

        } catch (e) {
            setError("Fel: " + e.message);
        }
    };

    const initiateDelete = (quizId, index) => {
        setQuizToDelete({ id: quizId, index: index });
    };

    const confirmDelete = async () => {
        if (!quizToDelete) return;
        const { id, index } = quizToDelete;
        if (id) {
            // 1. Hämta alla sessioner för detta quiz
            const { data: sessions } = await supabase.from('sessions').select('id').eq('quiz_id', id);

            if (sessions && sessions.length > 0) {
                const sessionIds = sessions.map(s => s.id);

                // 2. Ta bort alla spelare kopplade till dessa sessioner
                const { error: playersError } = await supabase.from('players').delete().in('session_id', sessionIds);
                if (playersError) console.error("Kunde inte ta bort spelare:", playersError);

                // 3. Ta bort sessionerna
                const { error: sessionError } = await supabase.from('sessions').delete().in('id', sessionIds);
                if (sessionError) console.error("Kunde inte ta bort sessioner:", sessionError);
            }

            // 4. Ta bort quizet
            const { error } = await supabase.from('quizzes').delete().eq('id', id);
            if (error) {
                setError("Kunde inte ta bort: " + error.message);
                setQuizToDelete(null);
                return;
            }
        }
        dispatch({ type: 'DELETE_QUIZ', payload: index });
        setQuizToDelete(null);
    };

    const handleCopyPrompt = () => {
        const textArea = document.createElement("textarea");
        textArea.value = currentPromptText;
        document.body.appendChild(textArea);
        textArea.select();
        try { document.execCommand('copy'); } catch (err) { console.error('Fallback copy failed', err); }
        document.body.removeChild(textArea);
    };

    const handlePromptTemplateChange = (templateId) => {
        setSelectedPromptTemplate(templateId);
        const template = templates.find(t => t.id === templateId);

        if (!template) return;

        let promptText = template.prompt;
        if (typeof promptText === 'string' && promptText.includes('{{TOPIC}}')) {
            const randomTopic = PARTY_TOPICS[Math.floor(Math.random() * PARTY_TOPICS.length)];
            promptText = promptText.replace('{{TOPIC}}', randomTopic);
        }

        setCurrentPromptText(promptText);
    };

    const handleResetTemplates = () => {
        if (confirm("Är du säker på att du vill återställa alla mallar till standard?")) {
            const defaults = Object.entries(PROMPT_TEMPLATES).map(([key, val]) => ({ id: key, ...val }));
            updateTemplates(defaults);
            setShowTemplateManager(false);
        }
    };

    const handleDeleteTemplate = (id) => {
        if (confirm(`Ta bort mallen?`)) {
            const newTemplates = templates.filter(t => t.id !== id);
            updateTemplates(newTemplates);
        }
    };

    const handleSaveTemplate = (id, data) => {
        const existingIndex = templates.findIndex(t => t.id === id);
        let newTemplates;
        if (existingIndex >= 0) {
            newTemplates = [...templates];
            newTemplates[existingIndex] = { ...newTemplates[existingIndex], ...data };
        } else {
            newTemplates = [...templates, { id, ...data }];
        }
        updateTemplates(newTemplates);
    };

    // Drag and Drop Handlers
    const handleDragStart = (e, index) => {
        setDraggedItem(templates[index]);
        e.dataTransfer.effectAllowed = "move";
        // e.dataTransfer.setDragImage(e.target, 20, 20); // Optional custom drag image
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        const draggedOverItem = templates[index];

        // If the item is dragged over itself, ignore
        if (draggedItem === draggedOverItem) {
            return;
        }

        // Filter out the currently dragged item
        let items = templates.filter(item => item !== draggedItem);

        // Add the dragged item after the dragged over item
        items.splice(index, 0, draggedItem);

        setTemplates(items);
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
        updateTemplates(templates); // Save the new order
    };

    const handleTitleBlur = async (index, newTitle, quizId) => {
        if (newTitle.trim() !== "") {
            dispatch({ type: 'UPDATE_QUIZ_TITLE', payload: { index, newTitle } });
            if (quizId) {
                await supabase.from('quizzes').update({ title: newTitle }).eq('id', quizId);
            }
        }
    };

    const handleAddCategory = () => {
        if (newCategoryName.trim()) {
            dispatch({ type: 'ADD_CATEGORY', payload: newCategoryName.trim() });
            setNewCategoryName("");
        }
    };

    // --- SKAPA SESSION I DB (ENDAST FÖR LIVE QUIZ) ---
    const createSessionInDb = async (quiz, gameMode, settings) => {
        setStartingSession(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Ingen användare");

            const pinCode = generatePin();

            // Uppdaterad payload för att matcha Supabase-schemat (host_id istället för creator_id)
            const { data: sessionData, error } = await supabase
                .from('sessions')
                .insert([{
                    quiz_id: quiz.id,
                    pin_code: pinCode,
                    status: 'lobby',
                    settings: { ...settings, quizDataSnapshot: quiz }, // Hack: Spara quiz-data i settings
                    host_id: user.id
                }])
                .select()
                .single();

            if (error) throw error;

            return { sessionData, pinCode };

        } catch (err) {
            setError("Kunde inte starta session: " + err.message);
            return null;
        } finally {
            setStartingSession(false);
        }
    };

    const openJeopardySetup = (quiz) => setJeopardyConfig({
        quiz,
        teams: 3,
        teamNames: generateTeamNames(3),
        scoreMode: 'progressive', // 'progressive' | 'flat'
        columns: Math.min(6, quiz.questions.length) // Default to max 6 or question count
    });
    const openLiveSetup = (quiz) => setLiveConfig({ quiz, timerEnabled: false, timerDuration: 30, forceRandomNames: false, scoreMode: 'speed', gamificationMode: 'none' });

    // --- JEOPARDY (OFFLINE / LOKALT) ---
    const startJeopardy = () => {
        if (!jeopardyConfig) return;
        const settings = {
            gameMode: 'jeopardy',
            jeopardyTeams: jeopardyConfig.teams,
            teamNames: jeopardyConfig.teamNames,
            scoreMode: jeopardyConfig.scoreMode,
            columns: jeopardyConfig.columns
        };

        // Körs lokalt utan databas, med dummy-data
        dispatch({
            type: 'CREATE_SESSION',
            payload: {
                sessionId: 'local-jeopardy',
                pinCode: 'OFFLINE',
                quizData: jeopardyConfig.quiz,
                settings: settings
            }
        });
        setJeopardyConfig(null);
    };

    // --- LIVE QUIZ (ONLINE / DB) ---
    const startLive = async () => {
        if (!liveConfig) return;
        const settings = {
            gameMode: 'live',
            timerEnabled: liveConfig.timerEnabled,
            timerDuration: liveConfig.timerDuration,
            forceRandomNames: liveConfig.forceRandomNames,
            scoreMode: liveConfig.scoreMode,
            gamificationMode: liveConfig.gamificationMode
        };

        // Skapa i DB
        const result = await createSessionInDb(liveConfig.quiz, 'live', settings);
        if (!result) return;

        // Navigera till host-sidan (UUID)
        const targetUrl = `/host/${result.sessionData.id}`;
        console.log("Navigerar till:", targetUrl);
        router.push(targetUrl);

        setLiveConfig(null);
    }
    // -----------------------------------------

    const filteredQuizzes = selectedCategory === "Alla"
        ? state.savedQuizzes
        : state.savedQuizzes.filter(q => q.category === selectedCategory);

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-slate-900 to-black pb-12 relative text-white">
            {/* Visar laddnings-overlay om vi startar en session */}
            {startingSession && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-white text-slate-900 p-6 rounded-xl flex items-center gap-4 shadow-2xl">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                        <span className="font-bold text-lg">Startar session...</span>
                    </div>
                </div>
            )}

            <header className="bg-white/5 backdrop-blur-md border-b border-white/10 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                        <Gamepad2 className="w-6 h-6" />
                    </div>
                    <h1 className="font-black text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-indigo-200">Quizmotorn</h1>
                </div>
                <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-2 text-sm text-red-300 hover:text-red-100 hover:bg-red-500/20 px-3 py-2 rounded-lg transition-colors font-medium cursor-pointer"><LogOut className="w-4 h-4" /> Logga ut</button>
            </header>
            <main className="max-w-6xl mx-auto p-6 space-y-12">

                <section>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Plus className="w-6 h-6 text-indigo-400" /> Skapa / Importera</h2>
                        <button
                            onClick={() => dispatch({ type: 'CREATE_EMPTY_QUIZ' })}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-500 transition-all shadow-lg flex items-center gap-2 text-sm cursor-pointer"
                        >
                            <FilePlus className="w-4 h-4" /> Skapa tomt quiz
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        <div className="lg:col-span-3 bg-white/5 border border-white/10 rounded-2xl p-4 h-full backdrop-blur-sm flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm"><Bot className="w-4 h-4" /> AI-Hjälpen</div>
                                    <button onClick={() => setShowTemplateManager(true)} className="text-slate-500 hover:text-white transition-colors cursor-pointer" title="Konfigurera mallar"><Settings className="w-4 h-4" /></button>
                                </div>

                                {/* Prompt Template Selector */}
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {templates.map(tpl => (
                                        <button
                                            key={tpl.id}
                                            onClick={() => handlePromptTemplateChange(tpl.id)}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${selectedPromptTemplate === tpl.id
                                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20'
                                                : 'bg-slate-800 text-slate-400 border-white/5 hover:bg-slate-700 hover:text-white'
                                                }`}
                                        >
                                            {tpl.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="bg-slate-950/50 p-3 rounded-xl text-[10px] font-mono text-slate-300 border border-white/5 h-24 overflow-y-auto shadow-inner select-all whitespace-pre-wrap no-scrollbar">
                                    {currentPromptText}
                                </div>
                            </div>
                            <button onClick={handleCopyPrompt} className="mt-2 w-full py-2 bg-indigo-600/80 text-white font-bold rounded-lg hover:bg-indigo-500 flex items-center justify-center gap-2 text-xs transition-colors border border-white/5 cursor-pointer"><Copy className="w-3 h-3" /> Kopiera Prompt</button>
                        </div>

                        <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-4 shadow-sm h-full flex flex-col justify-between backdrop-blur-sm">
                            <div>
                                <div className="flex items-center gap-2 mb-2 text-white font-bold text-sm"><Copy className="w-4 h-4 text-indigo-400" /> Klistra in JSON</div>
                                <textarea
                                    value={jsonInput}
                                    onChange={(e) => setJsonInput(e.target.value)}
                                    className="w-full h-32 font-mono text-[10px] p-3 bg-slate-950/50 border border-white/10 text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none mb-2 placeholder-white/20 scrollbar-hide resize-none"
                                    placeholder={DEFAULT_QUIZ_JSON}
                                />
                                {error && <p className="text-red-400 text-xs mb-2 bg-red-500/10 p-2 rounded border border-red-500/20">{error}</p>}
                            </div>

                            <button
                                onClick={handleSaveQuiz}
                                className="mt-0 w-full py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-lg hover:shadow-emerald-500/20 hover:scale-[1.02] flex items-center justify-center gap-2 text-xs transition-all border border-white/5 cursor-pointer shadow-lg"
                            >
                                <Save className="w-3 h-3" /> Spara till Bibliotek
                            </button>
                        </div>
                    </div>
                </section>

                <hr className="border-white/10" />
                <section>
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2"><BookOpen className="w-6 h-6 text-indigo-400" /> Mitt Bibliotek</h2>
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                            <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                                <button onClick={() => setSelectedCategory("Alla")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${selectedCategory === "Alla" ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Alla</button>
                                {state.categories.map(cat => (
                                    <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${selectedCategory === cat ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>{cat}</button>
                                ))}
                            </div>
                            <button onClick={() => setShowCategoryManager(true)} className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer" title="Hantera kategorier"><Settings className="w-4 h-4" /></button>
                        </div>
                    </div>

                    {state.savedQuizzes.length === 0 ? (
                        <div className="text-center py-16 bg-white/5 rounded-3xl border-2 border-dashed border-white/10">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4"><BookOpen className="w-8 h-8 text-slate-500" /></div>
                            <p className="text-slate-400">Inga sparade quiz än. Importera ett ovan!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredQuizzes.map((quiz, idx) => (
                                <div key={quiz.id || idx} className="bg-white/5 p-5 rounded-2xl border border-white/10 flex flex-col h-full hover:bg-white/10 hover:border-white/20 transition-all backdrop-blur-sm group relative">
                                    <div className="flex-1 mb-3">
                                        <div className="flex flex-col justify-start mb-1">
                                            <input
                                                type="text"
                                                defaultValue={quiz.title}
                                                onBlur={(e) => handleTitleBlur(idx, e.target.value, quiz.id)}
                                                className="text-lg font-bold text-white bg-transparent border-b border-transparent hover:border-white/30 focus:border-indigo-500 focus:outline-none transition-colors w-full leading-tight truncate block mb-2 cursor-text"
                                            />
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="bg-white/10 inline-block px-2 py-1 rounded-md text-[10px] font-bold text-indigo-200 border border-white/5">{quiz.questions.length} frågor</div>
                                                    <div className="bg-white/10 inline-block px-2 py-1 rounded-md text-[10px] font-bold text-slate-300 border border-white/5">{quiz.category || "Allmänt"}</div>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button onClick={() => dispatch({ type: 'START_EDITING_QUIZ', payload: idx })} className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer" title="Redigera"><Edit2 className="w-4 h-4" /></button>
                                                    <button onClick={() => initiateDelete(quiz.id, idx)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer" title="Radera"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 mt-auto pt-2 border-t border-white/5">
                                        <button onClick={() => openLiveSetup(quiz)} className="col-span-3 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/50 cursor-pointer"><Smartphone className="w-4 h-4" /> Live Quiz</button>
                                        <button onClick={() => openJeopardySetup(quiz)} className="col-span-2 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-orange-500 to-pink-600 text-white hover:from-orange-400 hover:to-pink-500 transition-all flex items-center justify-center gap-1 shadow-lg shadow-orange-900/50 cursor-pointer"><Grid className="w-3 h-3" /> Jeopardy</button>
                                        <button onClick={() => dispatch({ type: 'CREATE_SESSION', payload: { quizData: quiz, settings: { gameMode: 'solo' } } })} className="py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-400 hover:to-teal-500 transition-all flex items-center justify-center gap-1 shadow-lg shadow-emerald-900/50 cursor-pointer"><BookOpen className="w-3 h-3" /> Öva</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>

            {/* POPUPS */}
            {quizToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center transform transition-all scale-100">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500 ring-1 ring-red-500/20">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Är du säker?</h3>
                        <p className="text-slate-400 mb-6 text-sm">
                            Du är på väg att radera detta quiz permanent. Detta går inte att ångra.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setQuizToDelete(null)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-colors cursor-pointer border border-white/5">Avbryt</button>
                            <button onClick={confirmDelete} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold shadow-lg hover:shadow-red-500/30 transition-all cursor-pointer">Radera</button>
                        </div>
                    </div>
                </div>
            )}

            {showCategoryManager && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-white/10 animate-fade-in">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h3 className="font-bold text-xl text-white flex items-center gap-2"><Tag className="w-5 h-5" /> Hantera Kategorier</h3>
                            <button onClick={() => setShowCategoryManager(false)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    placeholder="Ny kategori..."
                                    className="flex-1 p-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                                <button onClick={handleAddCategory} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 cursor-pointer">Lägg till</button>
                            </div>
                            <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
                                {state.categories.map(cat => (
                                    <div key={cat} className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg text-sm text-white border border-white/5">
                                        {cat}
                                        <button onClick={() => dispatch({ type: 'DELETE_CATEGORY', payload: cat })} className="text-slate-400 hover:text-red-400 ml-1 cursor-pointer"><X className="w-3 h-3" /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showTemplateManager && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-white/10 animate-fade-in flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-800/50">
                            <h3 className="font-bold text-xl text-white flex items-center gap-2"><Settings className="w-5 h-5" /> Konfigurera Mallar</h3>
                            <button onClick={() => setShowTemplateManager(false)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-6">
                            <div className="flex justify-end">
                                <button onClick={handleResetTemplates} className="text-xs text-red-400 hover:text-red-300 underline cursor-pointer">Återställ till standard</button>
                            </div>

                            {/* Add/Edit Template Form */}
                            <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-3">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-bold text-white text-sm">{editingTemplateId ? 'Redigera Mall' : 'Lägg till Ny Mall'}</h4>
                                    {editingTemplateId && (
                                        <button
                                            onClick={() => setEditingTemplateId(null)}
                                            className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                                        >
                                            Avbryt
                                        </button>
                                    )}
                                </div>
                                <form onSubmit={(e) => {
                                    e.preventDefault();
                                    const formData = new FormData(e.target);
                                    const label = formData.get('label');
                                    // If editing, use existing ID, otherwise label is ID
                                    const id = editingTemplateId || label;

                                    if (id) {
                                        handleSaveTemplate(id, {
                                            label: label,
                                            description: formData.get('description'),
                                            prompt: formData.get('prompt')
                                        });
                                        e.target.reset();
                                        setEditingTemplateId(null);
                                    }
                                }} className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            name="label"
                                            placeholder="Namn (t.ex. Matte)"
                                            required
                                            className="p-2 bg-slate-950 border border-white/10 rounded-lg text-white text-sm"
                                            defaultValue={editingTemplateId ? templates.find(t => t.id === editingTemplateId)?.label : ''}
                                        />
                                        <input
                                            name="description"
                                            placeholder="Beskrivning"
                                            className="p-2 bg-slate-950 border border-white/10 rounded-lg text-white text-sm"
                                            defaultValue={editingTemplateId ? templates.find(t => t.id === editingTemplateId)?.description : ''}
                                        />
                                    </div>
                                    <textarea
                                        name="prompt"
                                        placeholder="Prompt text..."
                                        required
                                        className="w-full h-24 p-2 bg-slate-950 border border-white/10 rounded-lg text-white text-sm font-mono resize-none"
                                        defaultValue={editingTemplateId ? templates.find(t => t.id === editingTemplateId)?.prompt : ''}
                                    />
                                    <button type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-sm cursor-pointer">
                                        {editingTemplateId ? 'Spara Ändringar' : 'Spara Ny Mall'}
                                    </button>
                                </form>
                            </div>

                            {/* List Existing */}
                            <div className="space-y-2">
                                <h4 className="font-bold text-white text-sm">Befintliga Mallar (Dra för att ändra ordning)</h4>
                                {templates.map((tpl, idx) => (
                                    <div
                                        key={tpl.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, idx)}
                                        onDragOver={(e) => handleDragOver(e, idx)}
                                        onDragEnd={handleDragEnd}
                                        className={`flex items-start justify-between bg-white/5 p-3 rounded-xl border transition-colors cursor-move active:cursor-grabbing ${editingTemplateId === tpl.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 hover:bg-white/10'}`}
                                    >
                                        <div>
                                            <div className="font-bold text-white text-sm">{tpl.label}</div>
                                            <div className="text-xs text-slate-400">{tpl.description}</div>
                                            <div className="text-[10px] text-slate-500 font-mono mt-1 truncate max-w-md">{typeof tpl.prompt === 'string' ? tpl.prompt : '(Funktion)'}</div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => setEditingTemplateId(tpl.id)} className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer" title="Redigera"><Edit2 className="w-4 h-4" /></button>
                                            <button onClick={() => handleDeleteTemplate(tpl.id)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer" title="Ta bort"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {
                jeopardyConfig && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
                        <div className="bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-white/10 max-h-[90vh] flex flex-col">
                            <div className="bg-gradient-to-r from-orange-500 to-pink-600 p-5 flex justify-between items-center text-white flex-shrink-0">
                                <h3 className="font-bold text-xl flex items-center gap-2"><Grid className="w-6 h-6" /> Konfigurera Jeopardy</h3>
                                <button onClick={() => setJeopardyConfig(null)} className="hover:bg-white/20 p-2 rounded-full transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-8 space-y-8 overflow-y-auto">
                                <div>
                                    <label className="block text-sm font-bold text-slate-300 mb-3">Antal Lag: <span className="text-orange-400 text-lg ml-1">{jeopardyConfig.teams}</span></label>
                                    <input
                                        type="range" min="2" max="6"
                                        value={jeopardyConfig.teams}
                                        onChange={(e) => setJeopardyConfig(p => ({ ...p, teams: parseInt(e.target.value), teamNames: generateTeamNames(parseInt(e.target.value)) }))}
                                        className="w-full accent-orange-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <div className="flex justify-between text-xs text-slate-500 mt-2 font-mono px-1"><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span></div>
                                </div>
                                <div className="bg-slate-950/50 p-5 rounded-2xl border border-white/10">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Genererade Lagnamn</span>
                                        <button onClick={() => setJeopardyConfig(p => ({ ...p, teamNames: generateTeamNames(p.teams) }))} className="text-xs flex items-center gap-1 text-orange-400 font-bold hover:text-orange-300 transition-colors cursor-pointer"><Shuffle className="w-3 h-3" /> Slumpa nya</button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">{jeopardyConfig.teamNames.map((name, idx) => (<div key={idx} className="bg-slate-800 px-3 py-2.5 rounded-xl border border-white/5 text-sm font-bold text-white shadow-sm text-center">{name}</div>))}</div>
                                </div>

                                {/* Score Mode Selection */}
                                <div className="bg-slate-950/50 p-5 rounded-2xl border border-white/10">
                                    <label className="block text-sm font-bold text-slate-300 mb-3">Poängsystem</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setJeopardyConfig(p => ({ ...p, scoreMode: 'progressive' }))}
                                            className={`p-3 rounded-xl border text-sm font-bold transition-all ${jeopardyConfig.scoreMode === 'progressive' ? 'bg-orange-500 text-white border-orange-400' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
                                        >
                                            Stegrande (100, 200...)
                                        </button>
                                        <button
                                            onClick={() => setJeopardyConfig(p => ({ ...p, scoreMode: 'flat' }))}
                                            className={`p-3 rounded-xl border text-sm font-bold transition-all ${jeopardyConfig.scoreMode === 'flat' ? 'bg-orange-500 text-white border-orange-400' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
                                        >
                                            Alla lika (100p)
                                        </button>
                                    </div>
                                </div>

                                {/* Column Count Selection */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-300 mb-3">Antal Kolumner: <span className="text-orange-400 text-lg ml-1">{jeopardyConfig.columns}</span></label>
                                    <input
                                        type="range" min="1" max="6"
                                        value={jeopardyConfig.columns}
                                        onChange={(e) => setJeopardyConfig(p => ({ ...p, columns: parseInt(e.target.value) }))}
                                        className="w-full accent-orange-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <div className="flex justify-between text-xs text-slate-500 mt-2 font-mono px-1"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span></div>
                                </div>
                                <button onClick={startJeopardy} className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black text-lg shadow-xl hover:bg-slate-100 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 cursor-pointer">Starta Spelet <ArrowRight className="w-5 h-5" /></button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                liveConfig && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
                        <div className="bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-white/10 max-h-[90vh] flex flex-col">
                            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5 flex justify-between items-center text-white flex-shrink-0">
                                <h3 className="font-bold text-xl flex items-center gap-2"><Smartphone className="w-6 h-6" /> Konfigurera Live Quiz</h3>
                                <button onClick={() => setLiveConfig(null)} className="hover:bg-white/20 p-2 rounded-full transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-8 space-y-6 overflow-y-auto no-scrollbar">
                                <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-white/10">
                                    <div><div className="font-bold text-white">Tvinga slumpade namn</div><div className="text-xs text-slate-400 mt-1">Förhindrar olämpliga namn</div></div>
                                    <button onClick={() => setLiveConfig(p => ({ ...p, forceRandomNames: !p.forceRandomNames }))} className={`w-14 h-8 rounded-full transition-colors relative cursor-pointer ${liveConfig.forceRandomNames ? 'bg-green-500' : 'bg-slate-600'}`}><div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-sm ${liveConfig.forceRandomNames ? 'left-7' : 'left-1'}`} /></button>
                                </div>

                                <div className="bg-slate-800/50 p-5 rounded-2xl border border-white/10">
                                    <div className="flex items-center justify-between mb-6">
                                        <div><div className="font-bold text-white">Tid per fråga</div><div className="text-xs text-slate-400 mt-1">Begränsa svarstiden</div></div>
                                        <button
                                            onClick={() => setLiveConfig(p => {
                                                const newEnabled = !p.timerEnabled;
                                                return { ...p, timerEnabled: newEnabled, scoreMode: newEnabled ? p.scoreMode : 'simple' };
                                            })}
                                            className={`w-14 h-8 rounded-full transition-colors relative cursor-pointer ${liveConfig.timerEnabled ? 'bg-green-500' : 'bg-slate-600'}`}
                                        >
                                            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-sm ${liveConfig.timerEnabled ? 'left-7' : 'left-1'}`} />
                                        </button>
                                    </div>
                                    {liveConfig.timerEnabled && (
                                        <div className="animate-fade-in">
                                            <div className="flex justify-between mb-3 text-sm font-bold text-slate-300"><span>10s</span><span className="text-indigo-400">{liveConfig.timerDuration} sekunder</span><span>60s</span></div>
                                            <input type="range" min="10" max="60" step="5" value={liveConfig.timerDuration} onChange={(e) => setLiveConfig(p => ({ ...p, timerDuration: parseInt(e.target.value) }))} className="w-full accent-indigo-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                                        </div>
                                    )}
                                </div>

                                {liveConfig.timerEnabled && (
                                    <div className="flex items-center justify-between p-5 bg-slate-800/50 rounded-2xl border border-white/10 animate-fade-in">
                                        <div><div className="font-bold text-white">Poängsystem</div><div className="text-xs text-slate-400 mt-1">{liveConfig.scoreMode === 'speed' ? 'Hastighet ger mer poäng' : 'Bara rätt svar (Enkelt)'}</div></div>
                                        <div className="flex bg-slate-950 rounded-xl p-1 border border-white/5">
                                            <button onClick={() => setLiveConfig(p => ({ ...p, scoreMode: 'speed' }))} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${liveConfig.scoreMode === 'speed' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}><Zap className="w-3 h-3" /> Snabbhet</button>
                                            <button onClick={() => setLiveConfig(p => ({ ...p, scoreMode: 'simple' }))} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${liveConfig.scoreMode === 'simple' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}><CheckCircle className="w-3 h-3" /> Enkelt</button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-between p-5 bg-slate-800/50 rounded-2xl border border-white/10">
                                    <div>
                                        <div className="font-bold text-white">Tävlingsform</div>
                                        <div className="text-xs text-slate-400 mt-1">
                                            {liveConfig.gamificationMode === 'hybris' ? 'Satsa poäng på ditt svar' : 'Standard quiz'}
                                        </div>
                                    </div>
                                    <div className="flex bg-slate-950 rounded-xl p-1 border border-white/5">
                                        <button
                                            onClick={() => setLiveConfig(p => ({ ...p, gamificationMode: 'none' }))}
                                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${liveConfig.gamificationMode === 'none' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                        >
                                            Ingen
                                        </button>
                                        <button
                                            onClick={() => setLiveConfig(p => ({ ...p, gamificationMode: 'hybris' }))}
                                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${liveConfig.gamificationMode === 'hybris' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                        >
                                            <Trophy className="w-3 h-3" /> Hybris
                                        </button>
                                    </div>
                                </div>

                                <button onClick={startLive} className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black text-lg shadow-xl hover:bg-slate-100 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 cursor-pointer">Starta Quiz <ArrowRight className="w-5 h-5" /></button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
