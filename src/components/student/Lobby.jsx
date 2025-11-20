'use client';
import React, { useEffect } from 'react';
import { Loader2, User, Trophy, Music } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function StudentLobby({ currentPlayer, dispatch }) {

    useEffect(() => {
        if (!currentPlayer?.session_id) return;

        // 1. Lyssna på om spelet startar (session update)
        const sessionChannel = supabase
            .channel('student_session_listener')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'sessions',
                    filter: `id=eq.${currentPlayer.session_id}`,
                },
                (payload) => {
                    if (payload.new.status === 'active') {
                        // Startskottet har gått!
                        dispatch({ type: 'STUDENT_START_GAME', payload: payload.new });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(sessionChannel);
        };
    }, [currentPlayer, dispatch]);

    return (
        <div className="min-h-screen bg-indigo-600 flex flex-col items-center justify-center p-6 text-white relative overflow-hidden">
            {/* Animerad bakgrund */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
                <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full mix-blend-overlay filter blur-3xl animate-pulse"></div>
                <div className="absolute bottom-10 right-10 w-64 h-64 bg-purple-500 rounded-full mix-blend-overlay filter blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            <div className="z-10 text-center space-y-8 animate-fade-in">
                <div className="w-24 h-24 bg-white/20 backdrop-blur-lg rounded-full flex items-center justify-center mx-auto shadow-2xl border border-white/10">
                    <User className="w-12 h-12 text-white" />
                </div>

                <div className="space-y-2">
                    <h2 className="text-xl font-medium text-indigo-200">Välkommen</h2>
                    <h1 className="text-4xl font-black tracking-tight">{currentPlayer?.name || "Spelare"}</h1>
                </div>

                <div className="bg-black/20 backdrop-blur-md rounded-2xl p-6 border border-white/10 max-w-xs mx-auto">
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-300" />
                        <span className="font-bold text-lg">Väntar på läraren...</span>
                    </div>
                    <p className="text-sm text-indigo-200">Håll skärmen vaken, spelet börjar snart!</p>
                </div>

                <div className="flex justify-center gap-4 opacity-50">
                    <Trophy className="w-6 h-6 animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <Music className="w-6 h-6 animate-bounce" style={{ animationDelay: '0.5s' }} />
                </div>
            </div>
        </div>
    );
}