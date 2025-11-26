'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Check, X, Frown, Trophy } from 'lucide-react';

const letters = ['A', 'B', 'C', 'D'];
const gradients = [
    'from-pink-500 to-rose-500',
    'from-blue-500 to-cyan-500',
    'from-amber-500 to-orange-500',
    'from-purple-500 to-indigo-500'
];

export default function StudentGame({ session, player, dispatch }) {
    const questionIndex = session.currentQuestionIndex;
    const question = session.quizData.questions[questionIndex];
    const showAnswer = session.settings.showAnswer;

    const [selectedOption, setSelectedOption] = useState(null);
    const [hasAnswered, setHasAnswered] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [timeLeft, setTimeLeft] = useState(session.settings.timerEnabled ? session.settings.timerDuration : null);
    const [earnedPoints, setEarnedPoints] = useState(0);
    const [confidence, setConfidence] = useState('medium'); // Default to 'medium' (Tror)

    // Reset state on new question
    useEffect(() => {
        setHasAnswered(false);
        setSelectedOption(null);
        setIsSending(false);
        setEarnedPoints(0);
        setConfidence('medium'); // Reset confidence to default
        if (session.settings.timerEnabled) {
            setTimeLeft(session.settings.timerDuration);
        }
    }, [question, questionIndex, session.settings.timerEnabled, session.settings.timerDuration]);

    // Timer logic (Sync with teacher's timer roughly)
    useEffect(() => {
        if (showAnswer || session.settings?.question_state !== 'answering' || !session.settings.timerEnabled) {
            return;
        }

        if (timeLeft === null) return;
        if (timeLeft === 0) return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, session.settings?.question_state, session.settings.timerEnabled, showAnswer]);

    // Realtime subscription (Session updates AND Player Kick)
    useEffect(() => {
        const channel = supabase
            .channel(`student_game_${session.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'sessions',
                    filter: `id=eq.${session.id}`,
                },
                (payload) => {
                    dispatch({ type: 'UPDATE_SESSION', payload: payload.new });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'players',
                    filter: `id=eq.${player.id}`,
                },
                () => {
                    // Player was kicked (fallback via DB)
                    alert("Du har blivit borttagen från spelet.");
                    dispatch({ type: 'RESET_APP' });
                    window.location.href = '/';
                }
            )
            .on(
                'broadcast',
                { event: 'kick-player' },
                (payload) => {
                    // Player was kicked (via broadcast)
                    if (payload.payload.playerId === player.id) {
                        alert("Du har blivit borttagen från spelet.");
                        dispatch({ type: 'RESET_APP' });
                        window.location.href = '/';
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [session.id, dispatch, player.id]);

    const handleAnswer = async (optionIndex) => {
        if (hasAnswered || isSending) return;

        setIsSending(true);
        setSelectedOption(optionIndex);

        try {
            let currentAnswers = player.answers || {};
            currentAnswers[questionIndex] = optionIndex;

            const isCorrect = optionIndex === question.correctAnswerIndex;
            let points = 0;

            if (isCorrect) {
                // 1. Base Score (Speed or Simple)
                if (session.settings.timerEnabled && session.settings.scoreMode === 'speed' && session.settings.question_start_time) {
                    const now = Date.now();
                    const startTime = session.settings.question_start_time;
                    const duration = (session.settings.timerDuration || 30) * 1000;
                    const elapsed = Math.max(0, now - startTime);
                    const percentageLeft = Math.max(0, (duration - elapsed) / duration);
                    points = Math.round(100 + (900 * percentageLeft));
                } else {
                    points = 1000;
                }

                // 2. Hybris Bonus (Additive)
                if (session.settings.gamificationMode === 'hybris') {
                    if (confidence === 'high') points += 500; // Vet
                    else if (confidence === 'medium') points += 200; // Tror
                    else points += 0; // Gissar (No bonus)
                }
            } else {
                // Wrong Answer Logic
                if (session.settings.gamificationMode === 'hybris') {
                    if (confidence === 'high') points -= 500; // Vet penalty
                    else if (confidence === 'medium') points -= 200; // Tror penalty
                    else points -= 0; // Gissar (No penalty)
                }
            }

            const newScore = (player.score || 0) + points;

            const { error } = await supabase
                .from('players')
                .update({
                    answers: currentAnswers,
                    score: newScore
                })
                .eq('id', player.id);

            if (error) throw error;

            setHasAnswered(true);
            setEarnedPoints(points);
            dispatch({ type: 'UPDATE_PLAYER_SCORE', payload: newScore });
        } catch (error) {
            console.error('Error submitting answer:', error);
            setIsSending(false);
        }
    };

    // --- MAIN GAME VIEW (Preview + Answering + Results) ---
    const isPreview = session.settings?.question_state === 'preview';

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col p-4 relative overflow-hidden">
            {/* Timer Bar (Top Center) - Only if enabled */}
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

            <div className="flex justify-between items-center mb-6 text-slate-400 font-bold font-mono text-sm mt-4">
                <span>FRÅGA {questionIndex + 1}</span>
                <div className="flex flex-col items-end">
                    <span className="text-white">{player.name}</span>
                    <span className="text-xs text-indigo-400">{player.score || 0} p</span>
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full pb-[50vh] md:pb-0">
                <h2 className="text-2xl font-bold text-white text-center mb-8">{question.question}</h2>

                {/* Hybris Controls - Visible in Preview AND Answering (if not answered) */}
                {session.settings.gamificationMode === 'hybris' && !hasAnswered && !showAnswer && (
                    <div className="flex justify-center gap-2 mb-6 animate-fade-in relative z-50">
                        <button
                            onClick={() => setConfidence('low')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all border-2 ${confidence === 'low' ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg scale-105' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                        >
                            Gissar (0)
                        </button>
                        <button
                            onClick={() => setConfidence('medium')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all border-2 ${confidence === 'medium' ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg scale-105' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                        >
                            Tror (+/- 200)
                        </button>
                        <button
                            onClick={() => setConfidence('high')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all border-2 ${confidence === 'high' ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg scale-105' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                        >
                            Vet (+/- 500)
                        </button>
                    </div>
                )}

                {/* Preview Loading State */}
                {isPreview && (
                    <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl bg-indigo-600 animate-pulse mb-6">
                            <Loader2 className="w-10 h-10 text-white animate-spin" />
                        </div>
                        <h3 className="text-2xl font-black text-white mb-2">Gör dig redo!</h3>
                        <p className="text-slate-400">Svarsalternativen kommer snart...</p>
                    </div>
                )}

                {/* Options Grid - Hidden during preview */}
                {!isPreview && (
                    <div className="grid grid-cols-2 gap-2 w-full fixed bottom-0 left-0 h-[50vh] md:relative md:h-auto md:gap-4 md:p-0 z-40 bg-slate-900 md:bg-transparent animate-slide-up">
                        {question.options.map((opt, idx) => {
                            const isSelected = selectedOption === idx;
                            const isCorrect = idx === question.correctAnswerIndex;

                            // Base styling
                            let containerClass = "";
                            let opacityClass = "opacity-100";
                            let contentClass = "";
                            let letterClass = "hidden md:flex"; // Hide letter on mobile
                            let textClass = "text-center md:text-left mt-0 md:mt-0"; // Center text on mobile

                            if (showAnswer) {
                                if (isSelected) {
                                    // Selected Answer Styling
                                    if (isCorrect) {
                                        // Correct: Full Green Background (Mobile & Desktop)
                                        containerClass = `
                                            bg-green-600
                                            md:bg-green-600 
                                            ring-4 ring-green-500 scale-[1.02] z-10
                                        `;
                                    } else {
                                        // Incorrect: Full Red Background (Mobile & Desktop)
                                        containerClass = `
                                            bg-red-600
                                            md:bg-red-600 
                                            ring-4 ring-red-500 scale-[1.02] z-10
                                        `;
                                    }
                                    // Transparent content so background shows through
                                    contentClass = "bg-transparent md:bg-transparent";
                                } else if (isCorrect) {
                                    // Correct Answer (Not Selected): Dimmed Green Highlight
                                    containerClass = `
                                        bg-green-600/30
                                        md:bg-green-600/30
                                        ring-2 ring-green-500/50 scale-[1.02] z-10
                                    `;
                                    contentClass = "bg-transparent md:bg-transparent";
                                } else {
                                    // Unselected & Incorrect Options: Dimmed
                                    containerClass = `
                                        bg-gradient-to-br ${gradients[idx % 4]} 
                                        md:bg-slate-800
                                    `;
                                    contentClass = "bg-transparent md:bg-slate-900/90";
                                    opacityClass = "opacity-50 grayscale scale-95";
                                }
                            } else if (hasAnswered) {
                                // Waiting for result (Answered but not shown yet)
                                if (isSelected) {
                                    containerClass = `
                                        bg-gradient-to-br ${gradients[idx % 4]} 
                                        md:bg-slate-800 
                                        ring-4 ring-white scale-[1.02] z-10
                                    `;
                                    contentClass = "bg-transparent md:bg-slate-900/90";
                                } else {
                                    containerClass = `
                                        bg-gradient-to-br ${gradients[idx % 4]} 
                                        md:bg-slate-800
                                    `;
                                    contentClass = "bg-transparent md:bg-slate-900/90";
                                    opacityClass = "opacity-50 grayscale scale-95";
                                }
                            } else {
                                // Default State (Answering)
                                containerClass = `
                                    bg-gradient-to-br ${gradients[idx % 4]} 
                                    md:bg-slate-800
                                `;
                                contentClass = "bg-transparent md:bg-slate-900/90";
                            }

                            return (
                                <button
                                    key={idx}
                                    onClick={() => handleAnswer(idx)}
                                    disabled={isSending || hasAnswered || showAnswer}
                                    className={`
                                    relative overflow-hidden rounded-2xl p-1 transition-all duration-200
                                    ${containerClass} ${opacityClass}
                                    ${!hasAnswered && !showAnswer ? 'active:scale-95 md:hover:scale-[1.02]' : ''}
                                    shadow-xl group
                                `}
                                >
                                    <div className={`${contentClass} backdrop-blur-sm h-full w-full rounded-xl p-4 md:p-6 flex flex-col md:flex-row items-center justify-center md:justify-start gap-2 md:gap-4 relative z-10`}>
                                        <div className={`
                                        ${letterClass}
                                        w-10 h-10 md:w-12 md:h-12 rounded-full flex-shrink-0 items-center justify-center text-lg md:text-xl font-black text-white shadow-lg 
                                        bg-gradient-to-br ${gradients[idx % 4]}
                                        absolute top-2 left-3 md:static
                                    `}>
                                            {letters[idx]}
                                        </div>
                                        <span className={`text-xl md:text-2xl font-bold text-white leading-tight w-full ${textClass}`}>{opt}</span>
                                        {showAnswer && isSelected && isCorrect && (
                                            <Check className="w-8 h-8 text-white absolute top-2 right-2 md:static md:ml-auto animate-bounce" />
                                        )}
                                        {showAnswer && isSelected && !isCorrect && (
                                            <X className="w-8 h-8 text-white absolute top-2 right-2 md:static md:ml-auto animate-pulse" />
                                        )}
                                    </div>
                                    {/* Border gradient background (Desktop only) */}
                                    <div className={`hidden md:block absolute inset-0 bg-gradient-to-r ${gradients[idx % 4]} opacity-20`} />
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Result Feedback (Points Delta) */}
                {showAnswer && hasAnswered && (
                    <div className="mt-6 text-center animate-fade-in">
                        <div className={`text-4xl font-black ${earnedPoints > 0 ? 'text-green-400' : earnedPoints < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                            {earnedPoints > 0 ? `+${earnedPoints}` : earnedPoints} p
                        </div>
                        <div className="text-slate-400 text-sm font-bold uppercase tracking-wider mt-1">
                            {earnedPoints > 0 ? 'Bra jobbat!' : 'Bättre lycka nästa gång'}
                        </div>
                    </div>
                )}

                {showAnswer && !hasAnswered && (
                    <div className="mt-6 text-center animate-fade-in">
                        <div className="text-4xl font-black text-orange-400">
                            Missad!
                        </div>
                        <div className="text-slate-400 text-sm font-bold uppercase tracking-wider mt-1">
                            Du hann inte svara
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}