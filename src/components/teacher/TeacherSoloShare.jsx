// --- FILNAMN START: src/components/teacher/TeacherSoloShare.jsx ---
'use client';
import React from 'react';
import { BookOpen } from 'lucide-react';

export default function TeacherSoloShare({ session, dispatch }) {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white p-8 rounded-2xl shadow-xl border border-slate-100 text-center">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6"><BookOpen className="w-8 h-8" /></div>
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Redo för självstudier!</h2>
                <p className="text-slate-500 mb-8">Dela denna länk.</p>
                <div className="bg-slate-100 p-4 rounded-lg font-mono text-slate-600 break-all border border-slate-200 mb-6 select-all">https://quizmotorn.se/solo/{session.pin}</div>
                <div className="flex gap-4 justify-center"><button onClick={() => alert("Kopierad!")} className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold">Kopiera Länk</button><button onClick={() => dispatch({ type: 'RESET_APP' })} className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-lg font-bold">Dashboard</button></div>
            </div>
        </div>
    );
};
// --- FILNAMN SLUT: src/components/teacher/TeacherSoloShare.jsx ---