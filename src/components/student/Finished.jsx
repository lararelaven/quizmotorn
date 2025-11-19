'use client';
import React from 'react';
import { Trophy, Star, Home, ArrowLeft } from 'lucide-react';

export default function StudentFinished({ player, dispatch }) {

    // En enkel algoritm för att ge feedback baserat på poäng
    const getFeedback = () => {
        if (player.score > 2000) return { text: "LEGENDARISK!", color: "text-yellow-400" };
        if (player.score > 1000) return { text: "GRYMT JOBBAT!", color: "text-indigo-400" };
        if (player.score > 0) return { text: "BRA KÄMPAT!", color: "text-green-400" };
        return { text: "BÄTTRE LYCKA NÄSTA GÅNG!", color: "text-slate-400" };
    };

    const feedback = getFeedback();

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center animate-fade-in overflow-hidden relative">
            {/* Konfetti-ish bakgrund */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-yellow-500 rounded-full animate-ping"></div>
                <div className="absolute top-1/3 right-1/3 w-3 h-3 bg-indigo-500 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
                <div className="absolute bottom-1/4 left-1/2 w-2 h-2 bg-pink-500 rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
            </div>

            <div className="z-10 space-y-8 max-w-md w-full">
                <div className="relative inline-block">
                    <Trophy className="w-32 h-32 text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
                    <Star className="w-8 h-8 text-white absolute -top-2 -right-2 animate-spin-slow" />
                </div>

                <div>
                    <h2 className={`text-2xl font-black tracking-widest mb-2 ${feedback.color}`}>{feedback.text}</h2>
                    <h1 className="text-6xl font-black mb-2">{player.score}</h1>
                    <p className="text-slate-400 font-mono uppercase text-sm">Poäng</p>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10">
                    <p className="text-slate-300 mb-4">Spelet är slut. Tack för att du var med!</p>
                    <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 w-full animate-pulse"></div>
                    </div>
                </div>

                <button
                    onClick={() => dispatch({ type: 'RESET_APP' })}
                    className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 border border-white/10"
                >
                    <Home className="w-5 h-5" /> Tillbaka till Start
                </button>
            </div>
        </div>
    );
}