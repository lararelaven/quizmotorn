'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
    UserCheck, StopCircle, Monitor, Play, ArrowRight, Trophy, Maximize2, X, CheckCircle, Loader2, Users, Trash2, ChevronDown
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Constants for styling (matching Student View)
const letters = ['A', 'B', 'C', 'D'];
const gradients = [
    'from-pink-500 to-rose-500',
    'from-blue-500 to-cyan-500',
    'from-amber-500 to-orange-500',
    'from-purple-500 to-indigo-500'
];

export default function TeacherLiveGame({ session, dispatch }) {
    const question = session.quizData.questions[session.currentQuestionIndex];
    const isFinished = session.status === 'finished' || session.currentQuestionIndex >= session.quizData.questions.length;

    const [showAnswer, setShowAnswer] = useState(false);
    const [timeLeft, setTimeLeft] = useState(session.settings.timerEnabled ? session.settings.timerDuration : null);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [zoomImage, setZoomImage] = useState(null);
    const [showPlayerList, setShowPlayerList] = useState(false);

    // Nytt state för att räkna svar i realtid
    const [answersCount, setAnswersCount] = useState(0);
    const [topPlayers, setTopPlayers] = useState([]);
    const [connectedPlayers, setConnectedPlayers] = useState([]);
    const totalPlayers = connectedPlayers.length;

    const scrollRef = useRef(null);

    // --- Lyssna på inkommande svar OCH poänguppdateringar (för leaderboard) ---
    useEffect(() => {
        if (!session.id) return;

        // Nollställ räknaren vid ny fråga
        setAnswersCount(0);

        // Hämta spelare initialt
        const fetchPlayers = async () => {
            const { data } = await supabase.from('players').select('*').eq('session_id', session.id);
            if (data) {
                setConnectedPlayers(data);
                // Räkna hur många som redan svarat på denna fråga (om man laddar om sidan)
                const answered = data.filter(p => p.answers && p.answers[session.currentQuestionIndex] !== undefined).length;
                setAnswersCount(answered);
            }
        };
        fetchPlayers();

        const channel = supabase
            .channel('game_answers_live')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'players', filter: `session_id=eq.${session.id}` },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setConnectedPlayers(prev => [...prev, payload.new]);
                    } else if (payload.eventType === 'DELETE') {
                        setConnectedPlayers(prev => prev.filter(p => p.id !== payload.old.id));
                    } else if (payload.eventType === 'UPDATE') {
                        setConnectedPlayers(prev => prev.map(p => p.id === payload.new.id ? payload.new : p));

                        // Uppdatera leaderboard om poäng ändras
                        if (payload.new.score !== payload.old.score) {
                            fetchTopPlayers();
                        }
                    }
                }
            )
            .subscribe();

        fetchTopPlayers(); // Hämta initialt

        return () => {
            supabase.removeChannel(channel);
        };
    }, [session.currentQuestionIndex, session.id]);

    // Uppdatera answersCount baserat på connectedPlayers
    useEffect(() => {
        const count = connectedPlayers.filter(p => p.answers && p.answers[session.currentQuestionIndex] !== undefined).length;
        setAnswersCount(count);
    }, [connectedPlayers, session.currentQuestionIndex]);

    const fetchTopPlayers = async () => {
        const { data } = await supabase
            .from('players')
            .select('name, score')
            .eq('session_id', session.id)
            .order('score', { ascending: false })
            .limit(3);
        if (data) setTopPlayers(data);
    };

    // --- Hantera Preview-fasen automatiskt via useEffect ---
    useEffect(() => {
        if (session.settings?.question_state === 'preview') {
            const timer = setTimeout(async () => {
                const startTime = Date.now();

                // Uppdatera lokalt
                dispatch({
                    type: 'UPDATE_SESSION',
                    payload: {
                        settings: {
                            ...session.settings,
                            question_state: 'answering',
                            question_start_time: startTime
                        }
                    }
                });

                // Uppdatera DB
                await supabase
                    .from('sessions')
                    .update({
                        settings: {
                            ...session.settings,
                            question_state: 'answering',
                            question_start_time: startTime
                        }
                    })
                    .eq('id', session.id);

                // Starta timer-animationen
                setTimeLeft(session.settings.timerDuration);

            }, 4000); // 4 sekunders förberedelse

            return () => clearTimeout(timer);
        }
    }, [session.settings?.question_state, session.id, dispatch, session.settings]);

    // --- Databas-funktioner ---
    const handleNextQuestion = async () => {
        setShowAnswer(false);

        const nextIndex = session.currentQuestionIndex + 1;
        const isLastQuestion = nextIndex >= session.quizData.questions.length;

        // Bestäm nästa state baserat på om timer är aktiv
        const nextState = session.settings.timerEnabled ? 'preview' : 'answering';

        // Uppdatera lokalt direkt för snabb UI-respons
        dispatch({ type: 'NEXT_QUESTION' });
        dispatch({
            type: 'UPDATE_SESSION',
            payload: {
                settings: { ...session.settings, question_state: nextState, showAnswer: false }
            }
        });

        // Uppdatera DB
        await supabase
            .from('sessions')
            .update({
                current_question_index: nextIndex,
                settings: { ...session.settings, question_state: nextState, showAnswer: false },
                ...(isLastQuestion && { status: 'finished' })
            })
            .eq('id', session.id);
    };

    const handleShowAnswer = async () => {
        setShowAnswer(true);
        // Visa svar för elever OCH sätt status till finished så de inte kan svara mer
        await supabase
            .from('sessions')
            .update({
                settings: { ...session.settings, showAnswer: true, question_state: 'finished' } // question_state finished stoppar svar
            })
            .eq('id', session.id);
    };

    const handleKickPlayer = async (playerId) => {
        // Direkt borttagning utan konfirmation
        await supabase.from('players').delete().eq('id', playerId);
        // Realtime lyssnaren kommer uppdatera listan
    };

    const handleEndGame = async () => {
        await supabase.from('sessions').update({ status: 'finished' }).eq('id', session.id);
        dispatch({ type: 'END_GAME' });
    };

    const handleCloseSession = async () => {
        await supabase.from('sessions').update({ status: 'closed' }).eq('id', session.id);
        if (typeof window !== 'undefined') localStorage.removeItem('teacher_session_id');
        dispatch({ type: 'RESET_APP' });
        window.location.href = '/';
    };

    // Timer logic
    useEffect(() => {
        // Stoppa timer om vi visar svaret eller om frågan inte är i 'answering' fas
        if (showAnswer || session.settings?.question_state !== 'answering' || !session.settings.timerEnabled) {
            // Om vi precis visade svaret, behåll tiden där den är (frys den)
            // Om vi byter fråga (showAnswer blir false), återställs den av nästa effekt
            return;
        }

        if (timeLeft === null) return;

        if (timeLeft === 0) {
            handleShowAnswer();
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, session.settings?.question_state, session.settings.timerEnabled, showAnswer]);

    // Reset timer when question changes (fallback)
    useEffect(() => {
        if (session.settings.timerEnabled && !showAnswer) {
            setTimeLeft(session.settings.timerDuration);
        }
    }, [session.currentQuestionIndex, session.settings.timerEnabled, session.settings.timerDuration, showAnswer]);

    useEffect(() => {
        if (showAnswer && scrollRef.current) {
            setTimeout(() => {
                scrollRef.current.scrollTo({
                    top: scrollRef.current.scrollHeight,
                    behavior: 'smooth'
                });
            }, 100);
        }
    }, [showAnswer]);

    // --- Hämta slutgiltiga poäng när spelet är slut ---
    useEffect(() => {
        if (isFinished) {
            fetchTopPlayers();
            import('canvas-confetti').then((confetti) => {
                const duration = 3000;
                const end = Date.now() + duration;

                (function frame() {
                    confetti.default({
                        particleCount: 5,
                        angle: 60,
                        spread: 55,
                        origin: { x: 0 },
                        colors: ['#6366f1', '#ec4899', '#eab308']
                    });
                    confetti.default({
                        particleCount: 5,
                        angle: 120,
                        spread: 55,
                        origin: { x: 1 },
                        colors: ['#6366f1', '#ec4899', '#eab308']
                    });

                    if (Date.now() < end) {
                        requestAnimationFrame(frame);
                    }
                }());
            });
        }
    }, [isFinished]);

    if (isFinished) {
        // ... (Resultatvy - behålls som den är för nu, fokus på spelvyn)
        const sortedPlayers = [...(topPlayers.length > 0 ? topPlayers : connectedPlayers || [])]
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

        return (
            <div className="flex flex-col h-screen items-center justify-center bg-slate-900 text-white p-8 overflow-hidden relative">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 animate-pulse"></div>
                <Trophy className="w-32 h-32 text-yellow-400 mb-8 animate-bounce drop-shadow-[0_0_35px_rgba(250,204,21,0.6)]" />
                <h1 className="text-7xl font-black mb-16 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 drop-shadow-sm">Resultat</h1>
                {/* ... (Resten av resultatvyn) ... */}
                <div className="flex items-end justify-center gap-4 md:gap-8 w-full max-w-4xl mb-12 perspective-1000">
                    {/* 2nd Place */}
                    {sortedPlayers[1] && (
                        <div className="flex flex-col items-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
                            <div className="mb-4 text-center">
                                <span className="block text-2xl font-bold text-slate-300">{sortedPlayers[1].name}</span>
                                <span className="block text-xl font-mono text-slate-400">{sortedPlayers[1].score} p</span>
                            </div>
                            <div className="w-24 md:w-32 h-40 bg-gradient-to-t from-slate-700 to-slate-600 rounded-t-lg flex items-end justify-center pb-4 shadow-2xl border-t border-white/20 relative group">
                                <span className="text-5xl font-black text-white/20 group-hover:text-white/40 transition-colors">2</span>
                            </div>
                        </div>
                    )}
                    {/* 1st Place */}
                    {sortedPlayers[0] && (
                        <div className="flex flex-col items-center z-10 animate-slide-up">
                            <div className="mb-6 text-center">
                                <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-2 animate-pulse" />
                                <span className="block text-4xl font-black text-yellow-400 drop-shadow-md">{sortedPlayers[0].name}</span>
                                <span className="block text-3xl font-mono text-yellow-200 font-bold">{sortedPlayers[0].score} p</span>
                            </div>
                            <div className="w-32 md:w-40 h-56 bg-gradient-to-t from-yellow-600 to-yellow-400 rounded-t-lg flex items-end justify-center pb-6 shadow-[0_0_50px_rgba(234,179,8,0.4)] border-t border-white/30 relative group">
                                <span className="text-7xl font-black text-white/30 group-hover:text-white/50 transition-colors">1</span>
                                <div className="absolute inset-0 bg-white/10 animate-pulse rounded-t-lg"></div>
                            </div>
                        </div>
                    )}
                    {/* 3rd Place */}
                    {sortedPlayers[2] && (
                        <div className="flex flex-col items-center animate-slide-up" style={{ animationDelay: '0.4s' }}>
                            <div className="mb-4 text-center">
                                <span className="block text-2xl font-bold text-slate-300">{sortedPlayers[2].name}</span>
                                <span className="block text-xl font-mono text-slate-400">{sortedPlayers[2].score} p</span>
                            </div>
                            <div className="w-24 md:w-32 h-32 bg-gradient-to-t from-amber-800 to-amber-700 rounded-t-lg flex items-end justify-center pb-4 shadow-2xl border-t border-white/20 relative group">
                                <span className="text-5xl font-black text-white/20 group-hover:text-white/40 transition-colors">3</span>
                            </div>
                        </div>
                    )}
                </div>
                <button onClick={handleCloseSession} className="relative z-[100] px-10 py-4 bg-white text-slate-900 rounded-full font-black text-xl hover:bg-indigo-50 hover:scale-105 transition-all duration-300 flex items-center gap-2 cursor-pointer">
                    <StopCircle className="w-6 h-6" /> Avsluta Session
                </button>
            </div>
        );
    }

    if (!question) return <div className="text-white text-center p-10 flex flex-col items-center gap-4"><Loader2 className="animate-spin w-10 h-10" /><span>Laddar fråga...</span></div>;

    const isPreview = session.settings?.question_state === 'preview';

    // Dynamic font size for long questions
    const questionTextSize = question.question.length > 60 ? 'text-[24px]' : 'text-[30px]';

    // Check if this is the last question
    const isLastQuestion = session.currentQuestionIndex >= session.quizData.questions.length - 1;

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col relative overflow-hidden">

            {/* Timer Bar (Top Center) - Only if enabled - NOW OVER EVERYTHING */}
            {session.settings.timerEnabled && (
                <div className="absolute top-0 left-0 w-full h-2 bg-slate-800 z-50">
                    <div
                        className={`h-full shadow-[0_0_10px_rgba(99,102,241,0.5)] ${session.settings.question_state === 'answering' && !showAnswer ? 'transition-all duration-1000 ease-linear' : 'transition-none'} ${(timeLeft / session.settings.timerDuration) > 0.5 ? 'bg-green-500' :
                            (timeLeft / session.settings.timerDuration) > 0.2 ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'
                            }`}
                        style={{ width: `${(timeLeft / session.settings.timerDuration) * 100}%` }}
                    />
                </div>
            )}

            {/* Header - Transparent & No Border */}
            <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-40 pointer-events-none mt-4">
                {/* Left: Question Counter */}
                <div className="bg-black/20 backdrop-blur-md px-4 py-2 rounded-lg font-mono font-bold text-white/80 border border-white/10 pointer-events-auto">
                    FRÅGA {session.currentQuestionIndex + 1} / {session.quizData.questions.length}
                </div>

                {/* Center: Leaderboard (Top 3) */}
                <div className="flex gap-2 pointer-events-auto">
                    {topPlayers.slice(0, 3).map((p, i) => (
                        <div key={p.id} className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 animate-in fade-in slide-in-from-top-4 duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-slate-400 text-black' : 'bg-amber-700 text-white'}`}>
                                {i + 1}
                            </div>
                            <span className="text-xs font-bold text-white max-w-[80px] truncate">{p.name}</span>
                            <span className="text-xs font-mono text-indigo-300">{p.score}</span>
                        </div>
                    ))}
                </div>

                {/* Right: Answer Count & Controls */}
                <div className="flex items-center gap-4 pointer-events-auto">
                    <div className="relative">
                        <button
                            onClick={() => setShowPlayerList(!showPlayerList)}
                            className="flex items-center gap-2 bg-slate-950/50 px-4 py-2 rounded-lg border border-white/5 hover:bg-slate-900 transition-colors backdrop-blur-md"
                        >
                            <Users className="w-5 h-5 text-indigo-400" />
                            <span className="font-bold text-white">{answersCount}</span>
                            <span className="text-slate-400 text-sm">/ {totalPlayers} svar</span>
                            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${showPlayerList ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Player Dropdown */}
                        {showPlayerList && (
                            <div className="absolute top-full right-0 mt-2 w-72 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
                                <div className="p-3 border-b border-white/5 bg-slate-900/50">
                                    <h3 className="text-sm font-bold text-slate-300">Deltagare</h3>
                                </div>
                                <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                                    {connectedPlayers.map(p => {
                                        const hasAnswered = p.answers && p.answers[session.currentQuestionIndex] !== undefined;
                                        return (
                                            <div key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 group">
                                                <div className="flex items-center gap-3">
                                                    {hasAnswered ? (
                                                        <CheckCircle className="w-4 h-4 text-green-400" />
                                                    ) : (
                                                        <div className="w-4 h-4 rounded-full border-2 border-slate-600" />
                                                    )}
                                                    <span className="text-sm font-medium text-white">{p.name}</span>
                                                </div>
                                                <button
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleKickPlayer(p.id);
                                                    }}
                                                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors cursor-pointer z-50"
                                                    title="Ta bort spelare"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                    {connectedPlayers.length === 0 && (
                                        <div className="p-4 text-center text-slate-500 text-sm">Inga deltagare anslutna</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => setShowExitConfirm(true)}
                        className="p-2 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors backdrop-blur-md bg-slate-950/30"
                    >
                        <StopCircle className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 overflow-y-auto mt-16" ref={scrollRef}>

                {/* Question Card */}
                <div className="w-full max-w-4xl mb-8 animate-slide-up">
                    {question.image && (
                        <div className="mb-6 relative group cursor-zoom-in" onClick={() => setZoomImage(question.image)}>
                            <img
                                src={question.image}
                                alt="Question"
                                className="w-full h-64 md:h-80 object-cover rounded-2xl shadow-2xl border border-white/10 group-hover:brightness-110 transition-all"
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded-2xl">
                                <Maximize2 className="w-12 h-12 text-white drop-shadow-lg" />
                            </div>
                        </div>
                    )}
                    <h2 className={`${questionTextSize} font-bold text-white text-center leading-tight drop-shadow-xl`}>
                        {question.question}
                    </h2>
                </div>

                {/* Options Grid - Styled like Student View */}
                <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-5xl transition-opacity duration-500 ${isPreview ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    {question.options.map((opt, idx) => {
                        const isCorrect = idx === question.correctAnswerIndex;
                        const showResult = showAnswer;

                        // Base styling
                        let containerClass = "bg-slate-800";
                        let opacityClass = "opacity-100";

                        if (showResult) {
                            if (isCorrect) {
                                containerClass = "bg-green-600 ring-4 ring-green-400/50 scale-[1.02] z-10";
                            } else {
                                opacityClass = "opacity-50 grayscale";
                            }
                        }

                        return (
                            <div
                                key={idx}
                                className={`
                                    relative overflow-hidden rounded-2xl p-1 transition-all duration-200
                                    ${containerClass} ${opacityClass}
                                    ${!showResult ? 'hover:scale-[1.02]' : ''}
                                    shadow-xl group
                                `}
                            >
                                <div className="bg-slate-900/90 backdrop-blur-sm h-full w-full rounded-xl p-4 md:p-6 flex items-center gap-3 md:gap-4 relative z-10 text-left">
                                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex-shrink-0 flex items-center justify-center text-lg md:text-xl font-black text-white shadow-lg bg-gradient-to-br ${gradients[idx % 4]}`}>
                                        {letters[idx]}
                                    </div>
                                    <span className="text-xl md:text-2xl font-bold text-white leading-tight w-full">{opt}</span>
                                    {showResult && isCorrect && <CheckCircle className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 text-white animate-bounce" />}
                                </div>
                                {/* Border gradient background */}
                                <div className={`absolute inset-0 bg-gradient-to-r ${gradients[idx % 4]} opacity-20`} />
                            </div>
                        );
                    })}
                </div>

                {/* Explanation Text (Only shown after answer) */}
                {showAnswer && question.explanation && (
                    <div className="w-full max-w-5xl mt-8 p-6 bg-indigo-900/30 border border-indigo-500/30 rounded-2xl animate-fade-in">
                        <h3 className="text-indigo-300 font-bold mb-2 flex items-center gap-2">
                            <Monitor className="w-5 h-5" /> Förklaring
                        </h3>
                        <p className="text-white text-lg leading-relaxed">
                            {question.explanation}
                        </p>
                    </div>
                )}

                {/* Preview Indicator */}
                {isPreview && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-32">
                        <div className="flex flex-col items-center gap-2 animate-pulse">
                            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                            <span className="text-indigo-300 font-bold tracking-widest uppercase text-sm">Gör dig redo...</span>
                        </div>
                    </div>
                )}

            </div>

            {/* Floating Action Button */}
            <div className="fixed bottom-8 right-8 z-50">
                {!showAnswer ? (
                    <button
                        onClick={handleShowAnswer}
                        className="bg-white text-slate-900 px-8 py-4 rounded-full font-black text-xl hover:bg-indigo-50 hover:scale-105 transition-all shadow-2xl flex items-center gap-2 shadow-indigo-500/20"
                    >
                        <Monitor className="w-6 h-6" /> Visa Svar
                    </button>
                ) : (
                    <button
                        onClick={handleNextQuestion}
                        className={`
                            px-8 py-4 rounded-full font-black text-xl hover:scale-105 transition-all shadow-2xl flex items-center gap-2
                            ${isLastQuestion
                                ? 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-yellow-500/30'
                                : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-500/30'
                            }
                        `}
                    >
                        {isLastQuestion ? (
                            <>Resultat <Trophy className="w-6 h-6" /></>
                        ) : (
                            <>Nästa Fråga <ArrowRight className="w-6 h-6" /></>
                        )}
                    </button>
                )}
            </div>

            {/* Exit Confirm Modal */}
            {showExitConfirm && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-slate-900 border border-white/10 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center">
                        <h3 className="text-2xl font-bold text-white mb-2">Avsluta sessionen?</h3>
                        <p className="text-slate-400 mb-8">Alla deltagare kommer att kopplas bort.</p>
                        <div className="flex gap-4">
                            <button onClick={handleEndGame} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg transition-all">Resultat</button>
                            <button onClick={handleCloseSession} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold shadow-lg hover:shadow-red-500/30 transition-all">Stäng</button>
                            <button onClick={() => setShowExitConfirm(false)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors">Avbryt</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Zoom Modal */}
            {zoomImage && (
                <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setZoomImage(null)}>
                    <img src={zoomImage} alt="Zoomed" className="max-w-full max-h-full rounded-lg shadow-2xl animate-in zoom-in duration-300" />
                </div>
            )}
        </div>
    );
}