import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Trophy, StopCircle, Monitor, ArrowRight, Maximize2, Loader2, CheckCircle, Users, ChevronDown, X, Info } from 'lucide-react';
import confetti from 'canvas-confetti';

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

    // State for players and leaderboard
    const [topPlayers, setTopPlayers] = useState([]);
    const [connectedPlayers, setConnectedPlayers] = useState([]);
    const totalPlayers = connectedPlayers.length;

    // Derive answers count from connected players
    const answersCount = connectedPlayers.filter(p => p.answers && p.answers[session.currentQuestionIndex] !== undefined).length;

    const scrollRef = useRef(null);
    const channelRef = useRef(null);

    // --- Confetti Effect on Finish ---
    useEffect(() => {
        if (isFinished) {
            const duration = 3000;
            const end = Date.now() + duration;

            const frame = () => {
                confetti({
                    particleCount: 2,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: ['#6366f1', '#ec4899', '#eab308']
                });
                confetti({
                    particleCount: 2,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: ['#6366f1', '#ec4899', '#eab308']
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            };
            frame();
        }
    }, [isFinished]);

    // --- Lyssna på inkommande svar OCH poänguppdateringar (för leaderboard) ---
    useEffect(() => {
        const fetchPlayers = async () => {
            const { data } = await supabase
                .from('players')
                .select('*')
                .eq('session_id', session.id);
            if (data) {
                setConnectedPlayers(data);
                fetchTopPlayers(); // Initial fetch
            }
        };

        fetchPlayers();

        const channel = supabase
            .channel(`room:${session.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players', filter: `session_id=eq.${session.id}` }, (payload) => {
                setConnectedPlayers((prev) => [...prev, payload.new]);
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'players', filter: `session_id=eq.${session.id}` }, (payload) => {
                setConnectedPlayers((prev) => prev.filter(p => p.id !== payload.old.id));
                setTimeout(() => {
                    fetchTopPlayers();
                }, 500);
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players', filter: `session_id=eq.${session.id}` }, (payload) => {
                setConnectedPlayers((prev) => prev.map(p => p.id === payload.new.id ? payload.new : p));
                // Update leaderboard on score/answer changes
                setTimeout(() => {
                    fetchTopPlayers();
                }, 500);
            })
            .subscribe();

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
        };
    }, [session.id]);

    const fetchTopPlayers = async () => {
        const { data } = await supabase
            .from('players')
            .select('id, name, score')
            .eq('session_id', session.id)
            .order('score', { ascending: false })
            .limit(3);
        if (data) setTopPlayers(data);
    };

    const handleShowAnswer = async () => {
        setShowAnswer(true);

        // Uppdatera lokalt
        dispatch({
            type: 'UPDATE_SESSION',
            payload: {
                settings: { ...session.settings, showAnswer: true, question_state: 'finished' }
            }
        });

        // Uppdatera DB
        await supabase
            .from('sessions')
            .update({
                settings: { ...session.settings, showAnswer: true, question_state: 'finished' } // question_state finished stoppar svar
            })
            .eq('id', session.id);
    };

    // --- Auto-Show Answer Logic ---
    useEffect(() => {
        if (
            session.settings?.question_state === 'answering' &&
            totalPlayers > 0 &&
            answersCount === totalPlayers &&
            !showAnswer
        ) {
            handleShowAnswer();
        }
    }, [answersCount, totalPlayers, session.settings?.question_state, showAnswer]);

    // --- Timer Countdown Logic ---
    useEffect(() => {
        if (
            session.settings?.question_state !== 'answering' ||
            !session.settings.timerEnabled ||
            showAnswer
        ) {
            return;
        }

        if (timeLeft === 0) {
            handleShowAnswer();
            return;
        }

        if (timeLeft === null) return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, session.settings?.question_state, session.settings.timerEnabled, showAnswer]);

    // --- Hantera Preview-fasen automatiskt via useEffect ---
    useEffect(() => {
        if (session.settings?.question_state === 'preview') {
            // Om timer är avstängd, visa frågorna direkt (ingen "Gör dig redo"-fas)
            const delay = session.settings.timerEnabled ? 4000 : 0;

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

            }, delay);

            return () => clearTimeout(timer);
        }
    }, [session.settings?.question_state, session.id, dispatch, session.settings]);

    const handleNextQuestion = async () => {
        const nextIndex = session.currentQuestionIndex + 1;
        setShowAnswer(false);

        // Reset timer immediately if enabled
        if (session.settings.timerEnabled) {
            setTimeLeft(session.settings.timerDuration);
        }

        // Uppdatera lokalt
        dispatch({
            type: 'UPDATE_SESSION',
            payload: {
                currentQuestionIndex: nextIndex,
                settings: { ...session.settings, showAnswer: false, question_state: 'preview' }
            }
        });

        // Uppdatera DB
        await supabase
            .from('sessions')
            .update({
                current_question_index: nextIndex,
                settings: { ...session.settings, showAnswer: false, question_state: 'preview' }
            })
            .eq('id', session.id);
    };

    const handleCloseSession = async () => {
        await supabase
            .from('sessions')
            .update({ status: 'finished' })
            .eq('id', session.id);

        dispatch({ type: 'RESET_APP' });
        window.location.href = '/';
    };

    const handleEndGame = async () => {
        await supabase
            .from('sessions')
            .update({ status: 'finished' })
            .eq('id', session.id);

        dispatch({
            type: 'UPDATE_SESSION',
            payload: { status: 'finished' }
        });
    };

    const handleKickPlayer = async (playerId) => {
        setConnectedPlayers((prev) => prev.filter(p => p.id !== playerId));

        await supabase.channel(`room:${session.id}`).send({
            type: 'broadcast',
            event: 'kick-player',
            payload: { playerId }
        });

        const { error } = await supabase
            .from('players')
            .delete()
            .eq('id', playerId);

        if (error) {
            console.error('Error kicking player:', error);
        } else {
            setTimeout(() => {
                fetchTopPlayers();
            }, 500);
        }
    };

    if (isFinished) {
        const sortedPlayers = [...connectedPlayers].sort((a, b) => b.score - a.score);
        const totalQuestions = session.quizData.questions.length;

        // Helper to get correct answers count
        const getCorrectCount = (player) => {
            if (!player.answers) return 0;
            return Object.entries(player.answers).filter(([qIdx, ansIdx]) => {
                const q = session.quizData.questions[qIdx];
                return q && q.correctAnswerIndex === ansIdx;
            }).length;
        };

        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
                <div className="z-10 text-center space-y-8 max-w-5xl w-full">
                    <Trophy className="w-24 h-24 text-yellow-500 mx-auto animate-bounce mb-8" />

                    {/* Top 3 Podium */}
                    <div className="flex items-end justify-center gap-4 h-96 mb-12">
                        {/* 2nd Place */}
                        {sortedPlayers[1] && (
                            <div className="flex flex-col items-center animate-in slide-in-from-bottom-12 duration-700 delay-200 w-1/3 max-w-[200px]">
                                <div className="w-20 h-20 rounded-full bg-slate-300 border-4 border-slate-400 flex items-center justify-center text-3xl font-bold text-slate-800 mb-4 shadow-xl relative z-10">
                                    2
                                </div>
                                <div className="bg-slate-800 p-4 rounded-t-xl w-full h-48 flex flex-col items-center justify-center border-t-4 border-slate-400 relative">
                                    <span className="font-mono text-slate-300 text-2xl font-bold mb-2">{sortedPlayers[1].score}p</span>
                                    <span className="text-slate-500 text-sm font-bold">{getCorrectCount(sortedPlayers[1])}/{totalQuestions} rätt</span>
                                </div>
                                <div className="mt-4 text-center w-full">
                                    <span className="font-bold text-white text-xl block break-words leading-tight">{sortedPlayers[1].name}</span>
                                </div>
                            </div>
                        )}

                        {/* 1st Place */}
                        {sortedPlayers[0] && (
                            <div className="flex flex-col items-center animate-in slide-in-from-bottom-12 duration-700 w-1/3 max-w-[220px]">
                                <div className="w-28 h-28 rounded-full bg-yellow-400 border-4 border-yellow-500 flex items-center justify-center text-5xl font-bold text-yellow-900 mb-4 shadow-2xl relative z-20">
                                    <Trophy className="w-12 h-12 absolute -top-10 text-yellow-400 drop-shadow-lg animate-pulse" />
                                    1
                                </div>
                                <div className="bg-slate-800 p-6 rounded-t-xl w-full h-64 flex flex-col items-center justify-center border-t-4 border-yellow-500 shadow-[0_0_50px_rgba(234,179,8,0.3)] relative z-10">
                                    <span className="font-mono text-yellow-400 text-4xl font-black mb-2">{sortedPlayers[0].score}p</span>
                                    <span className="text-slate-400 text-lg font-bold">{getCorrectCount(sortedPlayers[0])}/{totalQuestions} rätt</span>
                                </div>
                                <div className="mt-4 text-center w-full">
                                    <span className="font-black text-white text-3xl block break-words leading-tight drop-shadow-lg">{sortedPlayers[0].name}</span>
                                </div>
                            </div>
                        )}

                        {/* 3rd Place */}
                        {sortedPlayers[2] && (
                            <div className="flex flex-col items-center animate-in slide-in-from-bottom-12 duration-700 delay-400 w-1/3 max-w-[200px]">
                                <div className="w-20 h-20 rounded-full bg-amber-700 border-4 border-amber-800 flex items-center justify-center text-3xl font-bold text-amber-100 mb-4 shadow-xl relative z-10">
                                    3
                                </div>
                                <div className="bg-slate-800 p-4 rounded-t-xl w-full h-36 flex flex-col items-center justify-center border-t-4 border-amber-700 relative">
                                    <span className="font-mono text-amber-600 text-2xl font-bold mb-2">{sortedPlayers[2].score}p</span>
                                    <span className="text-slate-500 text-sm font-bold">{getCorrectCount(sortedPlayers[2])}/{totalQuestions} rätt</span>
                                </div>
                                <div className="mt-4 text-center w-full">
                                    <span className="font-bold text-white text-xl block break-words leading-tight">{sortedPlayers[2].name}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleCloseSession}
                        className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all flex items-center gap-3 mx-auto border border-white/10"
                    >
                        <StopCircle className="w-6 h-6" /> Avsluta Session
                    </button>
                </div>
            </div>
        );
    }

    if (!question) return <div className="p-8 text-white">Laddar fråga...</div>;

    const isPreview = session.settings?.question_state === 'preview';
    const questionTextSize = 'text-[30px]';
    const isLastQuestion = session.currentQuestionIndex >= session.quizData.questions.length - 1;

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col relative overflow-hidden">

            {/* Timer Bar (Top Center) - Only if enabled - NOW OVER EVERYTHING */}
            {session.settings.timerEnabled && (
                <div className="fixed top-0 left-0 w-full h-2 bg-slate-800 z-50">
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
                                        <div className="p-4 text-center text-slate-500 text-sm">
                                            Inga deltagare än
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => setShowExitConfirm(true)}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-lg border border-red-500/20 transition-colors"
                        title="Avsluta session"
                    >
                        <StopCircle className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative z-10">

                {/* Question Text */}
                <div className="w-full max-w-5xl text-center mb-8 md:mb-12">
                    <h2 className={`${questionTextSize} font-bold text-white leading-tight drop-shadow-lg`}>
                        {question.question}
                    </h2>
                </div>

                {/* Image (if exists) */}
                {question.image && (
                    <div className="mb-8 relative group cursor-zoom-in" onClick={() => setZoomImage(question.image)}>
                        <img
                            src={question.image}
                            alt="Question"
                            className="max-h-[30vh] rounded-2xl shadow-2xl border-4 border-white/10 group-hover:scale-[1.02] transition-transform duration-300"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded-2xl">
                            <Maximize2 className="w-8 h-8 text-white drop-shadow-lg" />
                        </div>
                    </div>
                )}

                {/* Content Switch: Preview vs Options */}
                {isPreview ? (
                    <div className="flex flex-col items-center justify-center py-12 animate-in zoom-in duration-300">
                        <div className="w-24 h-24 rounded-full bg-indigo-600 flex items-center justify-center mx-auto mb-6 shadow-[0_0_50px_rgba(79,70,229,0.5)] animate-pulse">
                            <Loader2 className="w-12 h-12 text-white animate-spin" />
                        </div>
                        <h3 className="text-4xl font-black text-white mb-2">Gör dig redo!</h3>
                        <p className="text-xl text-indigo-300">Svarsalternativen kommer snart...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-5xl animate-in fade-in slide-in-from-bottom-8 duration-500">
                        {question.options.map((opt, idx) => {
                            const isCorrect = idx === question.correctAnswerIndex;
                            const showResult = showAnswer;

                            // Teacher View Styling (Letter + Dark BG + Colored Border)
                            let containerClass = `
                            relative overflow-hidden rounded-2xl p-1 transition-all duration-300
                            bg-gradient-to-br ${gradients[idx % 4]}
                            shadow-lg
                        `;

                            let contentClass = "bg-slate-900/90 backdrop-blur-sm h-full w-full rounded-xl p-6 flex items-center gap-6 relative z-10";
                            let opacityClass = "opacity-100";

                            if (showResult) {
                                if (isCorrect) {
                                    containerClass += " ring-4 ring-green-400/50 scale-[1.02] z-10";
                                } else {
                                    opacityClass = "opacity-50 grayscale";
                                }
                            }

                            return (
                                <div key={idx} className={`${containerClass} ${opacityClass}`}>
                                    <div className={contentClass}>
                                        {/* Letter Circle */}
                                        <div className={`
                                        w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center text-2xl font-black text-white shadow-lg
                                        bg-gradient-to-br ${gradients[idx % 4]}
                                    `}>
                                            {letters[idx]}
                                        </div>

                                        {/* Option Text */}
                                        <span className="text-2xl font-bold text-white leading-tight">{opt}</span>

                                        {/* Result Icons */}
                                        {showResult && isCorrect && (
                                            <CheckCircle className="w-8 h-8 text-green-400 ml-auto animate-bounce" />
                                        )}
                                    </div>
                                    {/* Border gradient background */}
                                    <div className={`absolute inset-0 bg-gradient-to-r ${gradients[idx % 4]} opacity-20`} />
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Explanation Text (Only when answer is shown) */}
                {showAnswer && question.explanation && (
                    <div className="fixed bottom-8 left-8 z-50 max-w-4xl animate-in slide-in-from-bottom-8 duration-500">
                        <div className="bg-slate-900/95 backdrop-blur-md border border-indigo-500/30 p-4 rounded-2xl shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-indigo-500/20 rounded-lg">
                                    <Info className="w-6 h-6 text-indigo-400" />
                                </div>
                                <div>
                                    <h4 className="text-indigo-400 font-bold mb-1 uppercase tracking-wider text-sm">Förklaring</h4>
                                    <p className="text-white text-lg leading-relaxed">{question.explanation}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Controls (Next / Show Answer) - FIXED BOTTOM RIGHT */}
                {!isPreview && (
                    <div className="fixed bottom-8 right-8 z-50 flex gap-4">
                        {!showAnswer ? (
                            <button
                                onClick={handleShowAnswer}
                                className="px-12 py-4 bg-white text-slate-900 rounded-full font-black text-xl hover:bg-indigo-50 hover:scale-105 transition-all duration-300 shadow-[0_0_30px_rgba(255,255,255,0.3)] flex items-center gap-3"
                            >
                                <Monitor className="w-6 h-6" /> Visa Svar
                            </button>
                        ) : (
                            <button
                                onClick={handleNextQuestion}
                                className={`px-12 py-4 rounded-full font-black text-xl transition-all duration-300 flex items-center gap-3 ${isLastQuestion
                                    ? 'bg-yellow-500 text-black hover:bg-yellow-400 hover:scale-105 shadow-[0_0_30px_rgba(234,179,8,0.5)]'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-105 shadow-[0_0_30px_rgba(79,70,229,0.5)]'
                                    }`}
                            >
                                {isLastQuestion ? (
                                    <>
                                        <Trophy className="w-6 h-6" /> Resultat
                                    </>
                                ) : (
                                    <>
                                        Nästa Fråga <ArrowRight className="w-6 h-6" />
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                )}

                {/* Exit Confirmation Modal */}
                {showExitConfirm && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="bg-slate-800 border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                                    <StopCircle className="w-6 h-6 text-red-400" />
                                </div>
                                <button
                                    onClick={() => setShowExitConfirm(false)}
                                    className="text-slate-400 hover:text-white transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <h3 className="text-2xl font-black text-white mb-4">Avsluta sessionen?</h3>
                            <p className="text-slate-300 mb-8">
                                Detta kommer att avsluta spelet för alla deltagare. Är du säker?
                            </p>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => {
                                        setShowExitConfirm(false);
                                        handleEndGame();
                                    }}
                                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg transition-all"
                                >
                                    Resultat
                                </button>
                                <button
                                    onClick={handleCloseSession}
                                    className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold shadow-lg hover:shadow-red-500/30 transition-all"
                                >
                                    Stäng
                                </button>
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
        </div>
    );
}