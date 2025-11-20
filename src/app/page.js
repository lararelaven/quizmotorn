'use client';
import React, { useReducer, useEffect } from 'react';
import { gameReducer, initialState } from '@/lib/gameReducer';
import { supabase } from '@/lib/supabase';

// Importera komponenter
import LandingPage from '@/components/shared/LandingPage';
import TeacherLogin from '@/components/teacher/TeacherLogin';
import TeacherDashboard from '@/components/teacher/Dashboard';
import QuizEditor from '@/components/teacher/QuizEditor';
import TeacherLobby from '@/components/teacher/Lobby';
import TeacherLiveGame from '@/components/teacher/LiveGame';
import TeacherJeopardy from '@/components/teacher/JeopardyGame';
import TeacherSoloShare from '@/components/teacher/TeacherSoloShare';
import StudentLogin from '@/components/student/Login';
import StudentLobby from '@/components/student/Lobby';
import StudentGame from '@/components/student/Game';
import StudentFinished from '@/components/student/Finished';

export default function Home() {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  // --- NYTT: Global Auth Lyssnare ---
  useEffect(() => {
    // 0. Kolla URL parametrar (för QR-kod)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('pin')) {
        dispatch({ type: 'SET_VIEW', payload: 'student_login' });
      }
    }

    // 1. Kolla om användaren redan är inloggad vid sidladdning
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        dispatch({
          type: 'LOGIN_TEACHER',
          payload: {
            email: user.email,
            id: user.id,
            name: 'Lärare'
          }
        });
      }
    };
    checkUser();

    // 2. Lyssna på realtids-förändringar (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        dispatch({
          type: 'LOGIN_TEACHER',
          payload: {
            email: session.user.email,
            id: session.user.id,
            name: 'Lärare'
          }
        });
      } else if (event === 'SIGNED_OUT') {
        dispatch({ type: 'SET_VIEW', payload: 'landing' });
        localStorage.removeItem('teacher_session_id');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- NYTT: Spara session vid ändring ---
  useEffect(() => {
    if (state.session?.id && ['teacher_lobby', 'teacher_game'].includes(state.view)) {
      localStorage.setItem('teacher_session_id', state.session.id);
    }
  }, [state.session?.id, state.view]);

  // --- NYTT: Återställ session vid refresh ---
  useEffect(() => {
    const restoreSession = async () => {
      const savedSessionId = localStorage.getItem('teacher_session_id');
      if (!savedSessionId || state.session.id) return; // Redan laddat eller inget att ladda

      console.log("Försöker återställa session:", savedSessionId);

      const { data: sessionData, error } = await supabase
        .from('sessions')
        .select('*, quiz:quiz_id(*)') // Hämta även quiz-data!
        .eq('id', savedSessionId)
        .single();

      if (error || !sessionData) {
        console.error("Kunde inte återställa session:", error);
        localStorage.removeItem('teacher_session_id');
        return;
      }

      // Mappa quiz-data korrekt (samma logik som i StudentLogin)
      // Prioritera snapshot i settings, sen quiz_snapshot, sen joinad quiz
      const quizData = sessionData.settings?.quizDataSnapshot || sessionData.quiz_snapshot || sessionData.quiz;

      if (!quizData) {
        console.error("Ingen quizdata hittades för sessionen");
        return;
      }

      const fullSession = {
        ...sessionData,
        quizData: quizData
      };

      // Bestäm vilken vy vi ska till baserat på status
      let targetView = 'teacher_lobby';
      if (sessionData.status === 'active') targetView = 'teacher_game';
      if (sessionData.status === 'finished') targetView = 'teacher_dashboard';

      dispatch({
        type: 'RESTORE_TEACHER_SESSION',
        payload: {
          session: fullSession,
          view: targetView
        }
      });
    };

    restoreSession();
  }, []);

  const renderView = () => {
    if (state.session.status === 'finished' && ['student_game', 'student_lobby'].includes(state.view)) {
      return <StudentFinished player={state.currentPlayer} dispatch={dispatch} />;
    }

    switch (state.view) {
      case 'landing': return <LandingPage dispatch={dispatch} />;
      case 'teacher_auth': return <TeacherLogin dispatch={dispatch} />;
      case 'teacher_dashboard': return <TeacherDashboard state={state} dispatch={dispatch} />;
      case 'teacher_editor': return <QuizEditor quizToEdit={state.savedQuizzes[state.editingQuizIndex]} categories={state.categories} dispatch={dispatch} />;
      case 'teacher_lobby': return <TeacherLobby session={state.session} dispatch={dispatch} />;
      case 'teacher_game':
        if (state.session.settings.gameMode === 'jeopardy') return <TeacherJeopardy session={state.session} dispatch={dispatch} />;
        return <TeacherLiveGame session={state.session} dispatch={dispatch} />;
      case 'teacher_solo_share': return <TeacherSoloShare session={state.session} dispatch={dispatch} />;
      case 'student_login': return <StudentLogin session={state.session} dispatch={dispatch} />;
      case 'student_lobby': return <StudentLobby currentPlayer={state.currentPlayer} dispatch={dispatch} />;
      case 'student_game': return <StudentGame session={state.session} player={state.currentPlayer} dispatch={dispatch} />;
      default: return <div className="p-10 text-white">Unknown View: {state.view}</div>;
    }
  };

  return (
    <div className="font-sans bg-slate-900 min-h-screen text-slate-100">
      {renderView()}

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes float-up {
            0% { transform: translateY(100px) scale(0.5); opacity: 0; }
            10% { opacity: 1; }
            100% { transform: translateY(-80vh) scale(1.5); opacity: 0; }
        }
        .animate-float-up {
            animation: float-up 3s ease-out forwards;
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  );
}