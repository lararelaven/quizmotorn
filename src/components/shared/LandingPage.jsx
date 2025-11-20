'use client';
import React from 'react';
import { Gamepad2, Monitor, Smartphone } from 'lucide-react';

export default function LandingPage({ dispatch }) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-slate-900 to-black flex flex-col items-center justify-center p-6">
            <div className="text-center mb-12 animate-fade-in">
                <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-3xl shadow-2xl mb-6 rotate-3 hover:rotate-6 transition-transform duration-500">
                    <Gamepad2 className="w-12 h-12 text-white" />
                </div>
                <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-indigo-200 tracking-tight mb-4 drop-shadow-sm">Quizmotorn</h1>
                <p className="text-indigo-300 text-2xl font-medium tracking-wide">Framtidens klassrumsquiz</p>
            </div>
            <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl hover:bg-white/10 transition-all cursor-pointer group shadow-2xl hover:shadow-indigo-500/10" onClick={() => dispatch({ type: 'SET_VIEW', payload: 'teacher_auth' })}>
                    <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-indigo-500/30"><Monitor className="w-8 h-8 text-white" /></div>
                    <h2 className="text-4xl font-bold text-white mb-2">För Lärare</h2>
                    <p className="text-indigo-200 text-lg">Skapa och styr quiz med AI-kraft.</p>
                </div>
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl hover:bg-white/10 transition-all cursor-pointer group shadow-2xl hover:shadow-pink-500/10" onClick={() => dispatch({ type: 'SET_VIEW', payload: 'student_login' })}>
                    <div className="w-16 h-16 bg-pink-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-pink-500/30"><Smartphone className="w-8 h-8 text-white" /></div>
                    <h2 className="text-4xl font-bold text-white mb-2">För Elever</h2>
                    <p className="text-pink-200 text-lg">Anslut snabbt med PIN-kod.</p>
                </div>
            </div>
        </div>
    );
}