// src/components/student/Login.jsx

'use client';
import React, { useState } from 'react';
import { Shuffle, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { generateRandomName } from '../../lib/utils';

export default function StudentLogin({ dispatch }) {
    const [pin, setPin] = useState(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            return params.get('pin') || '';
        }
        return '';
    });
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleJoin = async () => {
        if (!pin) { setError("Ange en PIN-kod"); return; }

        setLoading(true);
        setError('');

        try {
            // 1. Hitta sessionen i Supabase via PIN
            const { data: session, error: sessionError } = await supabase
                .from('sessions')
                .select('*, quiz:quiz_id(*)') // Hämta all sessionsdata
                .eq('pin_code', pin)
                .single();

            if (sessionError || !session) {
                throw new Error("Hittade ingen session med den koden. Kontrollera koden.");
            }

            if (session.status !== 'lobby') {
                throw new Error("Spelet har redan startat eller är avslutat.");
            }

            // 2. Bestäm namn
            let finalName = name.trim();
            if (session.settings?.forceRandomNames || !finalName) {
                finalName = generateRandomName();
            }

            // 3. Lägg till spelare i databasen - Minimal insert
            const { data: player, error: playerError } = await supabase
                .from('players')
                .insert([{
                    session_id: session.id,
                    name: finalName,
                }])
                .select()
                .single();

            if (playerError) throw playerError;

            // 4. Lyckat! Skicka både session- och spelardata till reducern
            dispatch({
                type: 'STUDENT_JOIN_SESSION',
                payload: { session, player }
            });


        } catch (err) {
            console.error("Student Join Error:", err);
            setError(err.message || "Ett oväntat fel uppstod. Försök igen.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen bg-gradient-to-b from-pink-500 to-orange-400 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-2xl space-y-6 animate-fade-in">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black text-slate-800">Quizmotorn</h1>
                    <p className="text-slate-400 font-bold">Elev</p>
                </div>

                {/* PIN Input */}
                <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">GAME PIN</label>
                    <input
                        type="tel"
                        placeholder="000000"
                        value={pin}
                        onChange={e => { setPin(e.target.value); setError(''); }}
                        className="w-full text-center text-4xl tracking-widest p-4 bg-slate-100 rounded-xl border-2 border-slate-200 focus:border-pink-500 focus:outline-none font-mono text-slate-900 font-bold placeholder-slate-300"
                        disabled={loading}
                    />
                </div>

                {/* Namn Input */}
                <div className="relative">
                    <label className="block text-sm font-bold text-slate-600 mb-2">Ditt Namn</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Namn..."
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="flex-1 p-4 bg-slate-100 rounded-xl border-2 border-slate-200 focus:border-pink-500 focus:outline-none font-bold text-lg placeholder-slate-400"
                            disabled={loading}
                        />
                        <button
                            onClick={() => setName(generateRandomName())}
                            disabled={loading}
                            className="p-4 bg-pink-100 text-pink-600 border-2 border-pink-200 rounded-xl hover:bg-pink-200 active:scale-95 transition-transform disabled:opacity-50 cursor-pointer"
                            title="Slumpa namn"
                        >
                            <Shuffle className="w-6 h-6" />
                        </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 italic">
                        Om läraren valt "Slumpade namn" kommer ditt namn ändras automatiskt.
                    </p>
                </div>

                {/* Felmeddelande */}
                {error && (
                    <div className="bg-red-100 border border-red-200 text-red-600 p-3 rounded-xl text-sm font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                        <AlertCircle className="w-4 h-4" /> {error}
                    </div>
                )}

                {/* Join Button */}
                <button
                    onClick={handleJoin}
                    disabled={loading}
                    className="w-full py-4 bg-black text-white rounded-xl font-bold text-xl shadow-lg hover:bg-slate-800 transition-all active:scale-95 mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Gå med!"}
                </button>

                <button
                    onClick={() => dispatch({ type: 'SET_VIEW', payload: 'landing' })}
                    className="w-full mt-2 text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
                    disabled={loading}
                >
                    Avbryt
                </button>
            </div>
        </div>
    );
}
