'use client';
import React, { useEffect } from 'react';
import { Users, Play, QrCode, Copy, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function TeacherLobby({ session, dispatch }) {
    // Lyssna på nya spelare i realtid
    useEffect(() => {
        if (!session?.id) return;

        // 1. Hämta befintliga spelare direkt (om man laddar om sidan)
        const fetchExistingPlayers = async () => {
            const { data } = await supabase
                .from('players')
                .select('*')
                .eq('session_id', session.id);
            
            if (data) {
                // Vi antar att reducer har en action för att sätta hela listan
                // Eller så lägger vi till dem en och en. Enklast här är att loopa.
                data.forEach(player => {
                     dispatch({ type: 'ADD_PLAYER', payload: player });
                });
            }
        };
        fetchExistingPlayers();

        // 2. Prenumerera på NYA spelare
        const channel = supabase
            .channel('lobby_players')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'players',
                    filter: `session_id=eq.${session.id}`,
                },
                (payload) => {
                    console.log("Ny spelare!", payload.new);
                    dispatch({ type: 'ADD_PLAYER', payload: payload.new });
                }
            )
            .subscribe();

        // Städa upp när vi lämnar vyn
        return () => {
            supabase.removeChannel(channel);
        };
    }, [session.id, dispatch]);

    const handleStartGame = async () => {
        // Uppdatera status i DB till 'active'
        await supabase
            .from('sessions')
            .update({ status: 'active', current_question_index: 0 })
            .eq('id', session.id);

        dispatch({ type: 'START_GAME' });
    };

    // Generera URL för QR-kod (placeholder-logik)
    const joinUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}?pin=${session.pin_code}`;

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col">
            {/* Header med PIN */}
            <header className="bg-indigo-600 p-6 flex justify-between items-center shadow-2xl z-10">
                <div className="flex items-center gap-4">
                     <button onClick={() => dispatch({ type: 'SET_VIEW', payload: 'teacher_dashboard' })} className="p-2 hover:bg-white/10 rounded-full transition-colors"><ArrowLeft className="w-6 h-6" /></button>
                    <div>
                        <div className="text-indigo-200 text-xs font-bold uppercase tracking-wider">Game PIN</div>
                        <div className="text-4xl font-black tracking-widest text-white drop-shadow-md font-mono">{session.pin_code}</div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="bg-black/20 px-6 py-3 rounded-xl flex flex-col items-center">
                        <span className="text-2xl font-bold">{session.players?.length || 0}</span>
                        <span className="text-[10px] font-bold uppercase text-indigo-200">Spelare</span>
                    </div>
                    <button 
                        onClick={handleStartGame}
                        disabled={(session.players?.length || 0) === 0}
                        className="bg-white text-indigo-600 px-8 py-4 rounded-xl font-black text-xl shadow-lg hover:bg-indigo-50 hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                        STARTA <Play className="w-6 h-6 fill-current" />
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-8 flex gap-8 overflow-hidden">
                {/* Spelarlista */}
                <div className="flex-1 bg-slate-800/50 rounded-3xl border border-white/10 p-8 overflow-y-auto">
                    {(!session.players || session.players.length === 0) ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 animate-pulse">
                            <Users className="w-16 h-16 mb-4 opacity-50" />
                            <p className="text-xl font-medium">Väntar på spelare...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 content-start">
                            {session.players.map((p, i) => (
                                <div key={p.id || i} className="bg-indigo-500 text-white p-4 rounded-xl font-bold text-center shadow-lg animate-fade-in transform hover:scale-105 transition-transform cursor-default border border-white/10">
                                    {p.name}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Info / QR Panel (Höger sida) */}
                <div className="w-80 bg-white rounded-3xl p-6 text-slate-900 flex flex-col shadow-2xl">
                    <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                         <div className="bg-slate-100 p-4 rounded-2xl border-2 border-slate-200">
                            <QrCode className="w-32 h-32 text-slate-900" />
                         </div>
                         <div className="text-center">
                            <p className="text-slate-500 text-sm font-bold mb-1">Gå med på</p>
                            <p className="text-2xl font-black text-indigo-600">play.quiz.se</p>
                         </div>
                    </div>
                    <div className="pt-6 border-t border-slate-100">
                        <button onClick={() => navigator.clipboard.writeText(joinUrl)} className="w-full py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-bold text-slate-600 flex items-center justify-center gap-2 transition-colors">
                            <Copy className="w-4 h-4" /> Kopiera Länk
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}