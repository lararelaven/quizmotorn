'use client';
import React, { useState, useEffect } from 'react';
import { Check, Loader2, Trophy, Frown, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import StudentFinished from './Finished';

// Constants for answer options
const letters = ['A', 'B', 'C', 'D'];
const gradients = [
    'from-pink-500 to-rose-500',
    'from-blue-500 to-cyan-500',
    'from-amber-500 to-orange-500',
    'from-purple-500 to-indigo-500'
];

export default function StudentGame({ session, player, dispatch }) {
    const questionIndex = session?.current_question_index ?? 0;

    // Safety check
    if (!session?.quizData?.questions) {
        return <div className="text-white text-center p-10">Laddar quizdata...</div>;
    }

    // Check if quiz is finished (questionIndex out of bounds OR status is finished)
    if (questionIndex >= session.quizData.questions.length || session.status === 'finished') {
        return <StudentFinished player={player} dispatch={dispatch} />;
    }

    const question = session.quizData.questions[questionIndex];
    const showAnswer = session.settings?.showAnswer || false;

    const [hasAnswered, setHasAnswered] = useState(false);
    const [selectedOption, setSelectedOption] = useState(null);
    const [isSending, setIsSending] = useState(false);
    const [timeLeft, setTimeLeft] = useState(session.settings.timerEnabled ? session.settings.timerDuration : null);
    const [earnedPoints, setEarnedPoints] = useState(0);

    // Reset state on new question
    useEffect(() => {
        setHasAnswered(false);
        setSelectedOption(null);
        setIsSending(false);
        setEarnedPoints(0);
        if (session.settings.timerEnabled) {
            setTimeLeft(session.settings.timerDuration);
        }
    }, [questionIndex, session.settings.timerEnabled, session.settings.timerDuration]);

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

    // Realtime subscription
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
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [session.id, dispatch]);

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
                if (session.settings.timerEnabled && session.settings.scoreMode === 'speed' && session.settings.question_start_time) {
                    const now = Date.now();
                    const startTime = session.settings.question_start_time;
                    const duration = (session.settings.timerDuration || 30) * 1000;
                    const elapsed = Math.max(0, now - startTime);

                    // Linjär poängminskning: 1000 -> 100
                    const percentageLeft = Math.max(0, (duration - elapsed) / duration);
                    points = Math.round(100 + (900 * percentageLeft));
                } else {
                    // Om ingen timer eller "enkelt" läge -> Alltid 1000 poäng
                    points = 1000;
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

    // --- WAITING VIEW (Answered, but teacher hasn't revealed yet) ---
    if (hasAnswered) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center space-y-8 animate-fade-in">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl font-black text-white shadow-lg bg-gradient-to-br ${gradients[selectedOption % 4]}`}>
                    {letters[selectedOption]}
                </div>

                <div>
                    <h1 className="text-3xl font-black mb-2">Du svarade {letters[selectedOption]}</h1>
                    <p className="text-slate-400 text-lg">Vänta på resultatet...</p>
                </div>

                <div className="flex gap-2 items-center bg-black/30 px-4 py-2 rounded-lg">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    <span className="text-sm font-mono text-indigo-300">Synkar med läraren</span>
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

            <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full">
                <h2 className="text-2xl font-bold text-white text-center mb-8">{question.question}</h2>

                <div className="grid grid-cols-2 gap-4 w-full">
                    {question.options.map((opt, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleAnswer(idx)}
                            disabled={isSending}
                            className={`
                                relative overflow-hidden rounded-2xl p-1 transition-all duration-200
                                ${isSending && selectedOption !== idx ? 'opacity-50 grayscale' : 'hover:scale-[1.02] active:scale-95'}
                                bg-slate-800
                            `}
                        >
                            <div className="bg-slate-900/90 backdrop-blur-sm h-full w-full rounded-xl p-4 md:p-6 flex items-center gap-3 md:gap-4 relative z-10 text-left">
                                <div className={`hidden md:flex w-10 h-10 rounded-full flex-shrink-0 items-center justify-center text-lg font-black text-white shadow-lg bg-gradient-to-br ${gradients[idx % 4]}`}>
                                    {letters[idx]}
                                </div>
                                <span className="text-base md:text-lg font-bold text-white leading-tight w-full">{opt}</span>
                            </div>
                            {/* Border gradient background */}
                            <div className={`absolute inset-0 bg-gradient-to-r ${gradients[idx % 4]} opacity-20`} />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}