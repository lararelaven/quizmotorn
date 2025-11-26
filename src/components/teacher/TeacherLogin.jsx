'use client';
import React, { useState } from 'react';
import { Mail, Key, Loader2, AlertCircle } from 'lucide-react';
// Använd @-alias för att importera från roten/src oavsett var filen ligger
import { supabase } from '@/lib/supabase';

export default function TeacherLogin({ dispatch }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [infoMsg, setInfoMsg] = useState(null);

    const handleAuth = async (e) => {
        e.preventDefault();
        setErrorMsg(null);
        setInfoMsg(null);

        if (!email || !password) {
            setErrorMsg("Fyll i både e-post och lösenord");
            return;
        }

        setLoading(true);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                setInfoMsg("Konto skapat! Kolla din mejl för bekräftelselänk.");
                setIsSignUp(false);
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            }
        } catch (error) {
            setErrorMsg(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    // Skicka tillbaka användaren till startsidan efter inloggning
                    redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
                }
            });
            if (error) throw error;
        } catch (error) {
            setErrorMsg(error.message);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-slate-900 to-black flex items-center justify-center p-4">
            <div className="bg-white/10 backdrop-blur-xl p-8 rounded-3xl shadow-2xl max-w-md w-full text-center border border-white/10 animate-fade-in">
                <h2 className="text-3xl font-bold text-white mb-6">
                    {isSignUp ? 'Skapa konto' : 'Logga in'}
                </h2>

                {errorMsg && (
                    <div className="mb-6 p-3 bg-red-500/20 border border-red-500/50 rounded-xl flex items-center gap-2 text-red-200 text-sm text-left animate-in fade-in slide-in-from-top-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {errorMsg}
                    </div>
                )}

                {infoMsg && (
                    <div className="mb-6 p-3 bg-green-500/20 border border-green-500/50 rounded-xl flex items-center gap-2 text-green-200 text-sm text-left animate-in fade-in slide-in-from-top-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full shrink-0" />
                        {infoMsg}
                    </div>
                )}

                <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full py-3 px-6 bg-white text-slate-900 rounded-xl flex items-center justify-center gap-3 hover:bg-indigo-50 transition-colors mb-6 font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
                    {loading ? 'Vänta...' : (isSignUp ? 'Registrera med Google' : 'Logga in med Google')}
                </button>

                <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/20"></div></div>
                    <div className="relative flex justify-center text-sm"><span className="px-3 text-indigo-200 bg-slate-900/50 backdrop-blur-xl rounded-full">Eller med e-post</span></div>
                </div>

                <form onSubmit={handleAuth} className="space-y-4 text-left">
                    <div>
                        <label className="block text-xs font-bold text-indigo-200 uppercase mb-1 ml-1 flex items-center gap-1"><Mail className="w-3 h-3" /> E-post</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full p-3 bg-slate-950/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-white placeholder-white/20 transition-all"
                            placeholder="namn@skola.se"
                            disabled={loading}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-indigo-200 uppercase mb-1 ml-1 flex items-center gap-1"><Key className="w-3 h-3" /> Lösenord</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-3 bg-slate-950/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-white placeholder-white/20 transition-all"
                            placeholder="••••••••"
                            disabled={loading}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold debug-hover transition-all shadow-lg hover:shadow-indigo-500/50 mt-2 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                        {isSignUp ? 'Skapa konto' : 'Logga in'}
                    </button>
                </form>

                <div className="mt-6 text-sm text-indigo-200">
                    {isSignUp ? 'Har du redan ett konto?' : 'Har du inget konto?'}
                    <button
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setEmail('');
                            setPassword('');
                            setErrorMsg(null);
                            setInfoMsg(null);
                        }}
                        className="ml-2 text-white font-bold hover:underline hover:text-indigo-100 transition-colors"
                        disabled={loading}
                    >
                        {isSignUp ? 'Logga in' : 'Skapa ett här'}
                    </button>
                </div>

                <button onClick={() => dispatch({ type: 'SET_VIEW', payload: 'landing' })} className="mt-8 text-white/40 hover:text-white text-sm font-medium transition-colors">← Tillbaka till start</button>
            </div>
        </div>
    );
}
