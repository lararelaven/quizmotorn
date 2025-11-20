'use client';
import React, { useEffect, useState } from 'react';
import { Users, Play, QrCode, Copy, ArrowLeft, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function TeacherLobby({ session, dispatch }) {
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!session?.id) return;

        const fetchExistingPlayers = async () => {
            const { data } = await supabase
                .from('players')
                .select('*')
                .eq('session_id', session.id);

            if (data) {
                data.forEach(player => {
                    dispatch({ type: 'ADD_PLAYER', payload: player });
                });
            }
        };
        fetchExistingPlayers();

        const channel = supabase
            .channel(`lobby_players_${session.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'players',
                    filter: `session_id=eq.${session.id}`,
                },
                (payload) => {
                    dispatch({ type: 'ADD_PLAYER', payload: payload.new });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [session.id, dispatch]);

    const handleStartGame = async () => {
        await supabase
            .from('sessions')
            .update({ status: 'active', current_question_index: 0 })
            .eq('id', session.id);

        dispatch({ type: 'START_GAME' });
    };

    const handleCopyLink = () => {
        const url = `${window.location.origin}?pin=${session.pin_code}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const displayUrl = typeof window !== 'undefined' ? window.location.host : 'quizmotorn.se';
    const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}?pin=${session.pin_code}` : `https://${displayUrl}?pin=${session.pin_code}`;
    // Använd API för att generera QR-kod
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}&color=0f172a`;

    return (
        <div className="min-h-screen bg-[#0f172a] text-white flex flex-col relative overflow-hidden font-sans">

            <div className="flex justify-between items-start p-8 z-10">

                <div className="space-y-4">
                    <button
                        onClick={() => dispatch({ type: 'SET_VIEW', payload: 'teacher_dashboard' })}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4 text-sm font-bold"
                    >
                        <ArrowLeft className="w-4 h-4" /> Tillbaka
                    </button>

                    <div>
                        <div className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Gå med på:</div>
                        <div className="text-2xl font-bold text-indigo-400 mb-4 flex items-center gap-2">
                            {displayUrl}
                            <button
                                onClick={handleCopyLink}
                                className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg transition-colors"
                                title="Kopiera direktlänk"
                            >
                                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
                            </button>
                        </div>

                        <div className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Med kod:</div>
                        <div className="text-7xl md:text-9xl font-black tracking-widest text-white drop-shadow-xl font-mono">
                            {/* HÄR ÄR RÄTT VARIABEL: pin_code */}
                            {session.pin_code}
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-2xl rotate-2 hover:rotate-0 transition-transform duration-300">
                    {/* Riktig QR Kod */}
                    <img src={qrCodeUrl} alt="QR Code" className="w-32 h-32 md:w-48 md:h-48 object-contain" />
                </div>
            </div>

            <main className="flex-1 flex flex-col items-center justify-center p-8 w-full max-w-7xl mx-auto z-10">
                {(!session.players || session.players.length === 0) ? (
                    <div className="text-center animate-pulse opacity-50">
                        <div className="flex justify-center mb-4">
                            <Users className="w-24 h-24 md:w-32 md:h-32 text-slate-600" />
                        </div>
                        <h2 className="text-2xl md:text-4xl font-bold text-slate-500">Väntar på deltagare...</h2>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-4 justify-center w-full">
                        {session.players.map((p, i) => (
                            <div key={p.id || i} className="bg-slate-800 border-b-4 border-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-lg md:text-2xl shadow-lg animate-in fade-in zoom-in duration-300">
                                {p.name}
                            </div>
                        ))}
                    </div>
                )}
            </main>

            <footer className="bg-slate-900/80 backdrop-blur-md border-t border-white/5 p-6 flex justify-between items-center sticky bottom-0 z-20">
                <div className="flex items-center gap-3 text-slate-300">
                    <Users className="w-6 h-6" />
                    <span className="text-xl font-bold">{session.players?.length || 0} anslutna</span>
                    <button
                        onClick={() => {
                            const fetchExistingPlayers = async () => {
                                const { data } = await supabase
                                    .from('players')
                                    .select('*')
                                    .eq('session_id', session.id);
                                if (data) {
                                    data.forEach(player => {
                                        dispatch({ type: 'ADD_PLAYER', payload: player });
                                    });
                                }
                            };
                            fetchExistingPlayers();
                        }}
                        className="ml-2 p-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors"
                        title="Uppdatera lista"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-refresh-cw"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></svg>
                    </button>
                </div>

                <button
                    onClick={handleStartGame}
                    disabled={(session.players?.length || 0) === 0}
                    className="bg-green-600 text-white px-8 py-4 rounded-xl font-black text-2xl shadow-lg hover:bg-green-500 hover:scale-105 hover:shadow-green-500/20 transition-all flex items-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
                >
                    Starta Quiz <Play className="w-6 h-6 fill-current" />
                </button>
            </footer>

        </div>
    );
}
