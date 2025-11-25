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
    const [confidence, setConfidence] = useState('low'); // 'low' (Gissar), 'medium' (Tror), 'high' (Vet)

    // Reset state on new question
    useEffect(() => {
        setHasAnswered(false);
        setSelectedOption(null);
        setIsSending(false);
        setEarnedPoints(0);
        setConfidence('low'); // Reset confidence
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
                    // Player was kicked
                    alert("Du har blivit borttagen från spelet.");
                    dispatch({ type: 'RESET_APP' });
                    window.location.href = '/';
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [session.id, dispatch, player.id]);

    // --- PREVIEW VIEW (Get Ready) ---
    // Ensure we check for 'preview' state specifically
    if (session.settings?.question_state === 'preview') {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center space-y-8 animate-fade-in">
                <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-2xl bg-indigo-600 animate-pulse">
                    <Loader2 className="w-12 h-12 text-white animate-spin" />
                </div>
                <div>
                    <h1 className="text-4xl font-black mb-4">Gör dig redo!</h1>
                    <p className="text-slate-400 text-xl max-w-2xl mx-auto">{question.question}</p>
                </div>
            </div>
        );
    }

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
                    if (confidence === 'medium') points += 200; // Tror
                    else if (confidence === 'high') points += 300; // Vet
                    else points += 100; // Gissar (Bonus even for guessing correctly)
                }
            } else {
                // Wrong Answer Logic
                if (session.settings.gamificationMode === 'hybris') {
                    if (confidence === 'medium') points -= 100; // Tror penalty
                    else if (confidence === 'high') points -= 300; // Vet penalty
                    // Gissar has 0 penalty
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

    // --- ANSWER REVEALED VIEW (Teacher shows correct answer) ---
    if (showAnswer) {
        const isCorrect = selectedOption === question.correctAnswerIndex;

        // CASE 1: Student answered
        if (hasAnswered) {
            return (
                <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center space-y-8 animate-fade-in">
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl ${isCorrect ? 'bg-green-500' : 'bg-red-500'}`}>
                        {isCorrect ? <Check className="w-16 h-16 text-white" /> : <X className="w-16 h-16 text-white" />}
                    </div>

                    <div>
                        <h1 className="text-4xl font-black mb-2">{isCorrect ? 'Rätt svar!' : 'Tyvärr, fel svar.'}</h1>
                        <p className="text-slate-400 text-xl">
                            {isCorrect ? `+${earnedPoints} poäng` : 'Inga poäng denna gång'}
                        </p>
                    </div>

                    <div className="bg-slate-800 px-6 py-4 rounded-xl border border-slate-700">
                        <span className="text-slate-400 uppercase text-xs font-bold tracking-wider">Din totala poäng</span>
                        <div className="text-3xl font-black text-white">{player.score || 0}</div>
                    </div>

                    <div className="flex gap-2 items-center bg-black/30 px-4 py-2 rounded-lg mt-8">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                        <span className="text-sm font-mono text-indigo-300">Väntar på nästa fråga...</span>
                    </div>
                </div>
            );
        }

        // CASE 2: Student did NOT answer (Missed Question)
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center space-y-8 animate-fade-in">
                <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-2xl bg-orange-500">
                    <Frown className="w-16 h-16 text-white" />
                </div>

                <div>
                    <h1 className="text-4xl font-black mb-2">Missad fråga!</h1>
                    <p className="text-slate-400 text-xl">
                        Du hann inte svara i tid
                    </p>
                </div>

                <div className="bg-slate-800 px-6 py-4 rounded-xl border border-slate-700">
                    <span className="text-slate-400 uppercase text-xs font-bold tracking-wider">Det rätta svaret var</span>
                    <div className="text-3xl font-black text-white mt-2 flex items-center justify-center gap-3">
                        <span className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-black text-white shadow-lg bg-gradient-to-br ${gradients[question.correctAnswerIndex % 4]}`}>
                            {letters[question.correctAnswerIndex]}
                        </span>
                        <span>{question.options[question.correctAnswerIndex]}</span>
                    </div>
                </div>

                <div className="bg-slate-800 px-6 py-4 rounded-xl border border-slate-700">
                    <span className="text-slate-400 uppercase text-xs font-bold tracking-wider">Din totala poäng</span>
                    <div className="text-3xl font-black text-white">{player.score || 0}</div>
                </div>

                <div className="flex gap-2 items-center bg-black/30 px-4 py-2 rounded-lg mt-8">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    <span className="text-sm font-mono text-indigo-300">Väntar på nästa fråga...</span>
                </div>
            </div>
        );
    }

    // --- QUESTION VIEW (Answering) ---
    return (
        <div className="min-h-screen bg-slate-900 flex flex-col p-4 relative overflow-hidden">
            {/* Timer Bar (Top Center) - Only if enabled */}
            {session.settings.timerEnabled && (
                <div className="absolute top-0 left-0 w-full h-2 bg-slate-800 z-50">
                    <div
                        className={`h-full shadow-[0_0_10px_rgba(99,102,241,0.5)] ${session.settings.question_state === 'answering' ? 'transition-all duration-1000 ease-linear' : 'transition-none'} ${(timeLeft / session.settings.timerDuration) > 0.5 ? 'bg-green-500' :
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

                {/* Hybris Controls */}
                {session.settings.gamificationMode === 'hybris' && !hasAnswered && (
                    <div className="flex justify-center gap-2 mb-6 animate-fade-in">
                        <button
                            onClick={() => setConfidence('low')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all border-2 ${confidence === 'low' ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg scale-105' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                        >
                            Gissar (+100)
                        </button>
                        <button
                            onClick={() => setConfidence('medium')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all border-2 ${confidence === 'medium' ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg scale-105' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                        >
                            Tror (+200)
                        </button>
                        <button
                            onClick={() => setConfidence('high')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all border-2 ${confidence === 'high' ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg scale-105' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                        >
                            Vet (+300)
                        </button>
                    </div>
                )}

                {/* Options Grid - Styled like Teacher View (Desktop Match) */}
                <div className="grid grid-cols-2 gap-2 w-full fixed bottom-0 left-0 h-[50vh] md:relative md:h-auto md:gap-4 md:p-0 z-40 bg-slate-900 md:bg-transparent">
                    {question.options.map((opt, idx) => {
                        const isSelected = selectedOption === idx;
                        const isOther = hasAnswered && !isSelected;

                        // Base styling
                        let containerClass = "bg-slate-800";
                        let opacityClass = "opacity-100";

                        if (hasAnswered) {
                            if (isSelected) {
                                containerClass = "bg-slate-800 ring-4 ring-white scale-[1.02] z-10";
                            } else {
                                opacityClass = "opacity-50 grayscale scale-95";
                            }
                        }

                        return (
                            <button
                                key={idx}
                                onClick={() => handleAnswer(idx)}
                                disabled={isSending || hasAnswered}
                                className={`
                                    relative overflow-hidden rounded-2xl p-1 transition-all duration-200
                                    ${containerClass} ${opacityClass}
                                    ${!hasAnswered ? 'active:scale-95 md:hover:scale-[1.02]' : ''}
                                    shadow-xl group
                                `}
                            >
                                <div className="bg-slate-900/90 backdrop-blur-sm h-full w-full rounded-xl p-4 md:p-6 flex flex-col md:flex-row items-center justify-center md:justify-start gap-2 md:gap-4 relative z-10 text-center md:text-left">
                                    <div className={`
                                        w-10 h-10 md:w-12 md:h-12 rounded-full flex-shrink-0 flex items-center justify-center text-lg md:text-xl font-black text-white shadow-lg 
                                        bg-gradient-to-br ${gradients[idx % 4]}
                                        absolute top-2 left-3 md:static
                                    `}>
                                        {letters[idx]}
                                    </div>
                                    <span className="text-xl md:text-2xl font-bold text-white leading-tight w-full mt-8 md:mt-0">{opt}</span>
                                </div>
                                {/* Border gradient background */}
                                <div className={`absolute inset-0 bg-gradient-to-r ${gradients[idx % 4]} opacity-20`} />
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}