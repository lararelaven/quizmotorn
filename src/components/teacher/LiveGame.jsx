'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
    UserCheck, StopCircle, Monitor, Play, ArrowRight, Trophy, Maximize2, X
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

        return () => supabase.removeChannel(channel);
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
    // ---------------------------------------

    // --- NYTT: Databas-funktioner ---
    const handleNextQuestion = async () => {
        setShowAnswer(false);

        // 1. Uppdatera lokalt state
        dispatch({ type: 'NEXT_QUESTION' });

        // 2. Skicka signal till databasen (Elevernas skärmar byter nu!)
        const nextIndex = session.currentQuestionIndex + 1;
        const isLastQuestion = nextIndex >= session.quizData.questions.length;

        await supabase
            .from('sessions')
            .update({
                current_question_index: nextIndex,
                settings: { ...session.settings, showAnswer: false }, // Göm svar för elever
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
        // Uppdatera status i DB så eleverna ser resultat-skärmen
        await supabase.from('sessions').update({ status: 'finished' }).eq('id', session.id);
        dispatch({ type: 'END_GAME' });
    };
    // --------------------------------

    useEffect(() => {
        if (!session.settings.timerEnabled || showAnswer || isFinished || timeLeft === null) return;
        if (timeLeft <= 0) {
            handleShowAnswer();
            return;
        }
        const timerId = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
        return () => clearInterval(timerId);
    }, [timeLeft, showAnswer, isFinished, session.settings.timerEnabled]);

    useEffect(() => {
        if (session.settings.timerEnabled) setTimeLeft(session.settings.timerDuration);
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

    // --- NYTT: Hämta slutgiltiga poäng när spelet är slut ---
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
                    onClick={() => {
                        localStorage.removeItem('teacher_session_id');
                        dispatch({ type: 'RESET_APP' });
                    }}
                    className="relative z-[100] px-10 py-4 bg-white text-slate-900 rounded-full font-black text-xl hover:bg-indigo-50 hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all duration-300 flex items-center gap-2 cursor-pointer"
                >
                    <StopCircle className="w-6 h-6" /> Avsluta Session
                </button>
            </div>
        );
    }

    if (!question) return <div className="text-white p-10">Laddar fråga...</div>;

    return (
        <div className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden">
            <div className="p-6 pb-0 flex-shrink-0">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/10 text-slate-300 px-4 py-2 rounded-full font-mono shadow-sm border border-white/10">
                            Fråga {session.currentQuestionIndex + 1} / {session.quizData.questions.length}
                        </div>
                        {!showAnswer && (
                            <div className="flex items-center gap-2 bg-indigo-600/20 px-4 py-2 rounded-full border border-indigo-500/30 text-indigo-200">
                                <UserCheck className="w-4 h-4" /> {answersCount} / {totalPlayers} svar
                            </div>
                        )}
                    </div>

                    <div className="flex gap-4 items-center">
                        {/* Leaderboard Mini */}
                        <div className="hidden md:flex items-center gap-3 bg-black/20 px-4 py-2 rounded-xl border border-white/5">
                            <Trophy className="w-4 h-4 text-yellow-400" />
                            <div className="flex gap-3 text-xs font-bold">
                                {topPlayers.map((p, i) => (
                                    <div key={i} className="flex items-center gap-1">
                                        <span className="text-slate-400">#{i + 1}</span>
                                        <span className="text-white">{p.name}</span>
                                        <span className="text-indigo-300">{p.score}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button onClick={() => setShowExitConfirm(true)} className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg hover:bg-red-500/30 transition-colors font-bold text-sm"><StopCircle className="w-4 h-4" /> Avsluta</button>
                    </div>
                </div>

                {session.settings.timerEnabled && !showAnswer && (
                    <div className="w-full h-3 bg-slate-800 rounded-full mb-6 overflow-hidden relative shadow-inner">
                        <div
                            className={`h-full transition-all duration-1000 ease-linear ${getTimerColor(timeLeft, session.settings.timerDuration)}`}
                            style={{ width: `${(timeLeft / session.settings.timerDuration) * 100}%` }}
                        />
                    </div>
                )}
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 flex flex-col items-center pt-8 pb-40">
                <div className="max-w-6xl w-full flex flex-col items-center justify-start my-auto min-h-full">
                    <h2 className="text-3xl md:text-5xl font-bold text-center mb-8 leading-tight drop-shadow-lg max-w-4xl">{question.question}</h2>

                    {question.image && (
                        <div className="mb-8 w-full flex justify-center">
                            <div className="relative group cursor-zoom-in" onClick={() => setZoomImage(question.image)}>
                                <img src={question.image} alt="Quiz question" className="max-h-[15vh] w-auto object-contain rounded-xl shadow-lg border border-white/10 transition-transform group-hover:scale-105" />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 rounded-xl transition-opacity"><Maximize2 className="w-8 h-8 text-white drop-shadow-md" /></div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-8">
                        {question.options.map((opt, idx) => {
                            const isCorrect = idx === question.correctAnswerIndex;
                            const letters = ['A', 'B', 'C', 'D'];
                            const gradients = ['from-pink-500 to-rose-600', 'from-blue-500 to-cyan-600', 'from-yellow-400 to-orange-500', 'from-purple-500 to-indigo-600'];
                            return (
                                <div key={idx} className={`relative overflow-hidden rounded-2xl p-1 transition-all duration-300 ${showAnswer ? (isCorrect ? 'bg-gradient-to-r from-green-400 to-green-600 scale-105 shadow-[0_0_30px_rgba(74,222,128,0.5)]' : 'bg-slate-800 opacity-30 grayscale') : 'bg-slate-800 hover:bg-slate-700 hover:scale-[1.02] cursor-default'}`}>
                                    <div className="bg-slate-900/90 backdrop-blur-sm h-full w-full rounded-xl p-8 flex items-center gap-6 relative z-10">
                                        <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-xl font-black text-white shadow-lg bg-gradient-to-br ${gradients[idx % 4]}`}>{letters[idx]}</div>
                                        <span className="text-2xl font-bold text-white">{opt}</span>
                                    </div>
                                    {!showAnswer && <div className={`absolute inset-0 bg-gradient-to-r ${gradients[idx % 4]} opacity-20`} />}
                                </div>
                            );
                        })}
                    </div>

                    {showAnswer && (
                        <div className="w-full p-6 rounded-2xl mb-6 animate-fade-in border border-indigo-500/30 bg-indigo-900/20 backdrop-blur-md">
                            <h3 className="font-bold mb-2 flex items-center gap-2 text-indigo-300 text-lg"><Monitor className="w-5 h-5" /> Fördjupning</h3>
                            <p className="text-xl leading-relaxed text-indigo-100 font-light">{question.explanation}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="fixed bottom-8 right-8 z-50">
                {!showAnswer ? (
                    <button onClick={handleShowAnswer} className="px-8 py-4 rounded-xl font-bold text-xl shadow-2xl bg-white text-indigo-900 hover:bg-indigo-50 hover:shadow-indigo-500/50 hover:scale-105 transition-all flex items-center gap-2 border-4 border-indigo-100">
                        <Play className="w-5 h-5" /> Rätta Nu / Visa Svar
                    </button>
                ) : (
                    <button onClick={handleNextQuestion} className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold text-xl hover:bg-indigo-500 hover:scale-105 shadow-2xl flex items-center gap-2 transition-all border-4 border-indigo-400/50">
                        Nästa <ArrowRight />
                    </button>
                )}
            </div>

            {zoomImage && (
                <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 cursor-zoom-out animate-fade-in" onClick={() => setZoomImage(null)}>
                    <img src={zoomImage} alt="Zoomed question" className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl" />
                    <button className="absolute top-4 right-4 text-white/50 hover:text-white p-2"><X className="w-8 h-8" /></button>
                </div>
            )}

            {showExitConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl text-slate-900 max-w-sm w-full animate-fade-in text-center">
                        <h3 className="text-xl font-bold mb-2">Avsluta Quizet?</h3>
                        <p className="text-slate-500 mb-6">Detta kommer att avsluta omgången för alla elever och visa resultaten.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowExitConfirm(false)} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50">Nej, fortsätt</button>
                            <button onClick={handleEndGame} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg">Ja, avsluta</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}