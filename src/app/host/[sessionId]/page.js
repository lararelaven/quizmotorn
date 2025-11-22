'use client';
import React, { useReducer, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { gameReducer, initialState } from '@/lib/gameReducer';
import TeacherLobby from '@/components/teacher/Lobby';
import TeacherLiveGame from '@/components/teacher/LiveGame';
import TeacherJeopardy from '@/components/teacher/JeopardyGame';
import TeacherSoloShare from '@/components/teacher/TeacherSoloShare';
import { Loader2 } from 'lucide-react';

export default function HostGamePage() {
    const params = useParams();
    const router = useRouter();
    const sessionId = params.sessionId; // UUID
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [state, dispatch] = useReducer(gameReducer, initialState);

    useEffect(() => {
        const fetchSession = async () => {
            if (!sessionId) return;

            try {
                console.log("Fetching session for ID:", sessionId);
                const { data: sessionData, error: sessionError } = await supabase
                    .from('sessions')
                    .select('*, quiz:quiz_id(*)')
                    .eq('id', sessionId)
                    .single();

                if (sessionError || !sessionData) {
                    console.error("Session fetch error:", sessionError);
                    throw new Error("Kunde inte hitta sessionen");
                }

                console.log("Session loaded:", sessionData);

                if (sessionData.status === 'closed') {
                    console.warn("Session is closed, redirecting to home");
                    router.push('/');
                    return;
                }

                const quizData = sessionData.settings?.quizDataSnapshot || sessionData.quiz_snapshot || sessionData.quiz;

                if (!quizData) {
                    throw new Error("Quiz-data saknas");
                }

                const fullSession = { ...sessionData, quizData };

                let targetView = 'teacher_lobby';
                if (sessionData.status === 'active') targetView = 'teacher_game';
                if (sessionData.status === 'finished') targetView = 'teacher_game';

                dispatch({
                    type: 'RESTORE_TEACHER_SESSION',
                    payload: { session: fullSession, view: targetView }
                });

                setLoading(false);

            } catch (err) {
                console.error("Error fetching session:", err);
                setError(err.message);
                setLoading(false);
            }
        };

        fetchSession();
    }, [sessionId, router]);

    useEffect(() => {
        if (!sessionId) return;

        const channel = supabase
            .channel('host_session_status')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
                (payload) => {
                    if (payload.new.status === 'closed') {
                        router.push('/');
                    }
                }
            )
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [sessionId, router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                <span className="ml-4 text-xl font-mono">Laddar session...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
                <h1 className="text-3xl font-bold text-red-500 mb-4">Ett fel uppstod</h1>
                <p className="text-slate-300 mb-8">{error}</p>
                <button
                    onClick={() => router.push('/')}
                    className="px-6 py-3 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                >
                    Tillbaka till Start
                </button>
            </div>
        );
    }

    const renderContent = () => {
        switch (state.view) {
            case 'teacher_lobby':
                return <TeacherLobby session={state.session} dispatch={dispatch} />;
            case 'teacher_game':
                if (state.session.settings.gameMode === 'jeopardy') {
                    return <TeacherJeopardy session={state.session} dispatch={dispatch} />;
                }
                return <TeacherLiveGame session={state.session} dispatch={dispatch} />;
            case 'teacher_solo_share':
                return <TeacherSoloShare session={state.session} dispatch={dispatch} />;
            case 'teacher_dashboard':
                router.push('/');
                return null;
            default:
                return <TeacherLobby session={state.session} dispatch={dispatch} />;
        }
    };

    return (
        <div className="font-sans bg-slate-900 min-h-screen text-slate-100">
            {renderContent()}
        </div>
    );
}
