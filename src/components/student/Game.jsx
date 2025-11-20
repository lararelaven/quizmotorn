'use client';
import React, { useState } from 'react';
import { Check, Loader2, Trophy, Frown } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function StudentGame({ session, player, dispatch }) {
    const questionIndex = session?.current_question_index ?? 0;

    // Safety check: Om quizData saknas (kanske inte laddat än)
    if (!session?.quizData?.questions) {
        return <div className="text-white text-center p-10">Laddar quizdata...</div>;
    }

    const question = session.quizData.questions[questionIndex];

    const [hasAnswered, setHasAnswered] = useState(false);
    const [selectedOption, setSelectedOption] = useState(null);
    const [isSending, setIsSending] = useState(false);

    // Om läraren uppdaterat index, återställ state (ny fråga)
    // (Enklast att hantera med key={questionIndex} i render, eller en useEffect)
    React.useEffect(() => {
        setHasAnswered(false);
        setSelectedOption(null);
        setIsSending(false);
    }, [questionIndex]);

    const handleAnswer = async (optionIndex) => {
        if (hasAnswered || isSending) return;

        setIsSending(true);
        setSelectedOption(optionIndex);

        try {
            // 1. Hämta nuvarande svar
            let currentAnswers = player.answers || {};

            // 2. Lägg till nytt svar
            currentAnswers[questionIndex] = optionIndex;

            // 3. Beräkna poäng (om vi vill göra det direkt här)
            const isCorrect = optionIndex === question.correctAnswerIndex;
            const points = isCorrect ? (session.settings.scoreMode === 'speed' ? 1000 : 100) : 0;
            // (Obs: I en riktig app görs poängräkning säkrast på servern eller i en Postgres Function, men detta duger för nu)
            const newScore = (player.score || 0) + points;

            // 4. Skicka till DB
            const { error } = await supabase
                .from('players')
                .update({
                    answers: currentAnswers,
                    score: newScore
                    // Vi kan lägga till 'last_answered_index': questionIndex för bättre sync
                })
                .eq('id', player.id);

            if (error) throw error;

            setHasAnswered(true);
            dispatch({ type: 'UPDATE_PLAYER_SCORE', payload: newScore });

        } catch (err) {
            console.error("Kunde inte spara svar:", err);
            setIsSending(false); // Låt dem försöka igen
        }
    };

    // FÄRGER & UI
    const colors = [
        'bg-pink-500 hover:bg-pink-600 border-pink-700',
        'bg-blue-500 hover:bg-blue-600 border-blue-700',
        'bg-yellow-500 hover:bg-yellow-600 border-yellow-700',
        'bg-purple-500 hover:bg-purple-600 border-purple-700'
    ];
    const letters = ['A', 'B', 'C', 'D'];

    if (!question) return <div className="text-white text-center p-10">Laddar fråga...</div>;

    if (hasAnswered) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center space-y-6 animate-fade-in">
                <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center border-4 border-indigo-500 shadow-xl">
                    <Check className="w-12 h-12 text-indigo-400" />
                </div>
                <h1 className="text-3xl font-black">Svar skickat!</h1>
                <p className="text-slate-400 text-lg">Vänta på resultatet...</p>
                <div className="flex gap-2 items-center bg-black/30 px-4 py-2 rounded-lg">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    <span className="text-sm font-mono">Synkar med läraren</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col p-4">
            <div className="flex justify-between items-center mb-6 text-slate-400 font-bold font-mono text-sm">
                <span>FRÅGA {questionIndex + 1}</span>
                <span>{player.name}</span>
            </div>

            <div className="flex-1 flex flex-col justify-center gap-4 max-w-md mx-auto w-full">
                {question.options.map((opt, idx) => (
                    <button
                        key={idx}
                        onClick={() => handleAnswer(idx)}
                        disabled={isSending}
                        className={`
                            relative overflow-hidden w-full p-6 rounded-2xl 
                            text-left transition-all transform active:scale-95 
                            shadow-lg border-b-4 ${colors[idx % 4]}
                            ${isSending && selectedOption !== idx ? 'opacity-50' : ''}
                        `}
                    >
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center font-black text-xl">
                                {letters[idx]}
                            </div>
                            <span className="text-2xl font-bold leading-tight">{opt}</span>
                        </div>
                        {/* Shine effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 skew-x-12 opacity-0 hover:opacity-100 transition-opacity" />
                    </button>
                ))}
            </div>
        </div>
    );
}