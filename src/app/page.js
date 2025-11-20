'use client';
import React, { useReducer, useEffect } from 'react'; // Lade till useEffect
import { gameReducer, initialState } from '@/lib/gameReducer';
import { supabase } from '@/lib/supabase'; // Importera Supabase

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
  );

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