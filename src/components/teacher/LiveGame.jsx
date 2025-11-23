'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
    UserCheck, StopCircle, Monitor, Play, ArrowRight, Trophy, Maximize2, X, CheckCircle, Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function TeacherLiveGame({ session, dispatch }) {
    const question = session.quizData.questions[session.currentQuestionIndex];
    const isFinished = session.status === 'finished' || session.currentQuestionIndex >= session.quizData.questions.length;

    const [showAnswer, setShowAnswer] = useState(false);
    const [timeLeft, setTimeLeft] = useState(session.settings.timerEnabled ? session.settings.timerDuration : null);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [zoomImage, setZoomImage] = useState(null);

    // Nytt state för att räkna svar i realtid
    const [answersCount, setAnswersCount] = useState(0);
    const [topPlayers, setTopPlayers] = useState([]);
    const totalPlayers = session.players?.length || 0;

    const scrollRef = useRef(null);

    // --- NYTT: Lyssna på inkommande svar OCH poänguppdateringar (för leaderboard) ---
    useEffect(() => {
        if (!session.id) return;

        // Nollställ räknaren vid ny fråga
        setAnswersCount(0);

        const channel = supabase
            .channel('game_answers_live')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'players', filter: `session_id=eq.${session.id}` },
                (payload) => {
                    // Uppdatera antal svar
                    if (payload.new.answers && payload.new.answers[session.currentQuestionIndex] !== undefined) {
                        setAnswersCount(prev => prev + 1);
                    }
                    // Uppdatera leaderboard om poäng ändras
                    if (payload.new.score !== payload.old.score) {
                        fetchTopPlayers();
                    }
                }
            )
            .subscribe();

        fetchTopPlayers(); // Hämta initialt

        return () => {
            supabase.removeChannel(channel);
        };
    }, [session.currentQuestionIndex, session.id]);

    const fetchTopPlayers = async () => {
        const { data } = await supabase
            .from('players')
            .select('name, score')
            .eq('session_id', session.id)
            .order('score', { ascending: false })
            .limit(3);
        if (data) setTopPlayers(data);
    };

    // --- NYTT: Hantera Preview-fasen automatiskt via useEffect ---
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
        // Visa svar för elever
        await supabase
            .from('sessions')
            .update({
                settings: { ...session.settings, showAnswer: true }
            })
            .eq('id', session.id);
    };

    const handleEndGame = async () => {
        // Sätt status till 'finished' för att visa resultatsidan för alla
        await supabase.from('sessions').update({ status: 'finished' }).eq('id', session.id);
        dispatch({ type: 'END_GAME' });
    };

    const handleCloseSession = async () => {
        // Stäng sessionen helt
        await supabase.from('sessions').update({ status: 'closed' }).eq('id', session.id);

        // Rensa lokal lagring
        if (typeof window !== 'undefined') {
            localStorage.removeItem('teacher_session_id');
        }

        dispatch({ type: 'RESET_APP' });
        // Tvinga navigering till dashboard
        window.location.href = '/';
    };

    // Timer logic
    useEffect(() => {
        if (session.settings?.question_state !== 'answering' || !session.settings.timerEnabled) {
            setTimeLeft(session.settings.timerDuration);
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
    }, [timeLeft, session.settings?.question_state, session.settings.timerEnabled]);

    // Reset timer when question changes (fallback)
    useEffect(() => {
        if (session.settings.timerEnabled) {
            setTimeLeft(session.settings.timerDuration);
        }
        setShowAnswer(false);
    }, [session.currentQuestionIndex, session.settings.timerEnabled, session.settings.timerDuration]);

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

    const getTimerColor = (current, total) => {
        const percentage = (current / total) * 100;
        if (percentage > 60) return 'bg-green-500';
        if (percentage > 30) return 'bg-yellow-400';
        return 'bg-red-500 animate-pulse';
    };

    if (isFinished) {
        const sortedPlayers = [...(topPlayers.length > 0 ? topPlayers : session.players || [])]
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

        return (
            <div className="flex flex-col h-screen items-center justify-center bg-slate-900 text-white p-8 overflow-hidden relative">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 animate-pulse"></div>

                <Trophy className="w-32 h-32 text-yellow-400 mb-8 animate-bounce drop-shadow-[0_0_35px_rgba(250,204,21,0.6)]" />
                <h1 className="text-7xl font-black mb-16 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 drop-shadow-sm">Resultat</h1>

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

                <div className="w-full max-w-2xl space-y-2 mb-12 px-4">
                    {sortedPlayers.slice(3).map((p, i) => (
                        <div key={p.id || i} className="flex justify-between items-center bg-white/5 p-4 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-sm">{i + 4}</div>
                                <span className="text-xl font-medium text-slate-200">{p.name}</span>
                            </div>
                            <span className="text-xl font-mono text-slate-400">{p.score} p</span>
                        </div>
                    ))}
                </div>

                <button
                    onClick={handleCloseSession}
                    className="relative z-[100] px-10 py-4 bg-white text-slate-900 rounded-full font-black text-xl hover:bg-indigo-50 hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all duration-300 flex items-center gap-2 cursor-pointer"
                >
                    <StopCircle className="w-6 h-6" /> Avsluta Session
                </button>
            </div>
        );
    }

    if (!question) return <div className="text-white text-center p-10 flex flex-col items-center gap-4"><Loader2 className="animate-spin w-10 h-10" /><span>Laddar fråga...</span></div>;

    const isPreview = session.settings?.question_state === 'preview';

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col relative overflow-hidden">
            {/* Header */}
            <div className="bg-slate-800/50 p-4 flex justify-between items-center border-b border-white/5 backdrop-blur-sm z-10">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 px-4 py-2 rounded-lg font-bold text-white shadow-lg">
                        {session.currentQuestionIndex + 1} / {session.quizData.questions.length}
                    </div>
                    <div className="text-slate-400 font-mono text-sm hidden md:block">PIN: {session.pin_code}</div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-950/50 px-4 py-2 rounded-lg border border-white/5">
                        <UserCheck className="w-5 h-5 text-green-400" />
                        <span className="font-bold text-white">{answersCount}</span>
                        <span className="text-slate-400 text-sm">svar</span>
                    </div>
                    <button
                        onClick={() => setShowExitConfirm(true)}
                        className="p-2 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                    >
                        <StopCircle className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">

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
                    <h2 className="text-3xl md:text-5xl font-black text-white text-center leading-tight drop-shadow-xl">
                        {question.question}
                    </h2>
                </div>

                {/* Options Grid - HIDDEN DURING PREVIEW */}
                <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-5xl transition-opacity duration-500 ${isPreview ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    {question.options.map((opt, idx) => {
                        const isCorrect = idx === question.correctAnswerIndex;
                        const showResult = showAnswer;

                        let bgClass = "bg-slate-800";
                        if (showResult) {
                            bgClass = isCorrect ? "bg-green-600 ring-4 ring-green-400/50 scale-[1.02] z-10" : "bg-slate-800 opacity-50 grayscale";
                        }

                        return (
                            <div
                                key={idx}
                                className={`${bgClass} p-6 rounded-2xl border border-white/10 flex items-center gap-4 transition-all duration-500 shadow-xl relative overflow-hidden group`}
                            >
                                <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-xl font-black text-white shadow-lg bg-gradient-to-br ${['from-pink-500 to-rose-500', 'from-blue-500 to-cyan-500', 'from-amber-500 to-orange-500', 'from-purple-500 to-indigo-500'][idx % 4]}`}>
                                    {['A', 'B', 'C', 'D'][idx]}
                                </div>
                                <span className="text-xl md:text-2xl font-bold text-white">{opt}</span>
                                {showResult && isCorrect && <CheckCircle className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 text-white animate-bounce" />}
                            </div>
                        );
                    })}
                </div>

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

            {/* Footer / Controls */}
            <div className="bg-slate-900/80 backdrop-blur-md p-6 border-t border-white/5 z-20">
                <div className="max-w-6xl mx-auto flex items-center justify-between gap-8">
                    {/* Timer Bar */}
                    <div className="flex-1 h-4 bg-slate-800 rounded-full overflow-hidden relative shadow-inner">
                        <div
                            className={`h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_15px_rgba(99,102,241,0.5)] ${session.settings.question_state === 'answering' ? 'transition-all duration-1000 ease-linear' : 'transition-none'}`}
                            style={{ width: `${(timeLeft / session.settings.timerDuration) * 100}%` }}
                        />
                    </div>

                    {/* Action Button */}
                    {!showAnswer ? (
                        <button
                            onClick={() => setShowAnswer(true)}
                            className="bg-white text-slate-900 px-8 py-3 rounded-xl font-black text-lg hover:bg-indigo-50 hover:scale-105 transition-all shadow-lg flex items-center gap-2 min-w-[200px] justify-center"
                        >
                            <Monitor className="w-5 h-5" /> Visa Svar
                        </button>
                    ) : (
                        <button
                            onClick={handleNextQuestion}
                            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-lg hover:bg-indigo-500 hover:scale-105 transition-all shadow-lg shadow-indigo-500/30 flex items-center gap-2 min-w-[200px] justify-center"
                        >
                            Nästa Fråga <ArrowRight className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Exit Confirm Modal */}
            {showExitConfirm && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-slate-900 border border-white/10 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center">
                        <h3 className="text-2xl font-bold text-white mb-2">Avsluta sessionen?</h3>
                        <p className="text-slate-400 mb-8">Alla deltagare kommer att kopplas bort.</p>
                        <div className="flex gap-4">
                            <button onClick={() => setShowExitConfirm(false)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors">Avbryt</button>
                            <button onClick={handleCloseSession} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold shadow-lg hover:shadow-red-500/30 transition-all">Avsluta</button>
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