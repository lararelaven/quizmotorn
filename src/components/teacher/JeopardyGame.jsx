// --- FILNAMN START: src/components/teacher/JeopardyGame.jsx ---
'use client';
import React, { useState } from 'react';
import {
    RotateCw, AlertTriangle, Zap, CheckCircle, XCircle
} from 'lucide-react';
import { JEOPARDY_COLORS } from '../../lib/constants';
import MathRenderer from '../MathRenderer';

export default function TeacherJeopardy({ session, dispatch }) {
    const [activeQuestion, setActiveQuestion] = useState(null);
    const [showAnswer, setShowAnswer] = useState(false);
    const [resultState, setResultState] = useState(null);
    const currentTeamIdx = session.jeopardyState.currentTeamTurn;
    const currentTeam = session.jeopardyState.teams[currentTeamIdx];
    const currentModifier = activeQuestion !== null ? session.jeopardyState.questionModifiers[activeQuestion] : 'normal';

    const handleGridClick = (index) => {
        if (session.jeopardyState.completedQuestions.includes(index)) return;
        setActiveQuestion(index); setShowAnswer(false); setResultState(null);
    };

    const handleOptionClick = (optionIndex) => {
        if (resultState !== null) return;
        const question = session.quizData.questions[activeQuestion];
        const isCorrect = optionIndex === question.correctAnswerIndex;
        setResultState(isCorrect ? 'correct' : 'wrong');
        setShowAnswer(true);
        let points = currentModifier === 'gamble' ? (isCorrect ? 300 : -300) : (currentModifier === 'double' && isCorrect ? 200 : (isCorrect ? 100 : 0));
        setTimeout(() => {
            dispatch({ type: 'JEOPARDY_AWARD_POINTS', payload: { teamIndex: currentTeamIdx, points: points } });
            setTimeout(() => {
                dispatch({ type: 'JEOPARDY_COMPLETE_QUESTION', payload: { index: activeQuestion } });
                setActiveQuestion(null); setResultState(null);
            }, 2000);
        }, 1000);
    };

    const handleManualClose = () => {
        if (activeQuestion !== null) {
            dispatch({ type: 'JEOPARDY_COMPLETE_QUESTION', payload: { index: activeQuestion } });
            setActiveQuestion(null);
        }
    }

    return (
        <div className="h-screen bg-slate-900 text-white flex flex-col overflow-hidden">
            <div className="bg-white text-slate-900 p-4 shadow-lg flex justify-between items-center z-10">
                <h2 className="font-bold text-xl">{session.quizData.title}</h2>
                <div className="flex items-center gap-4">
                    <div className="text-sm font-bold text-slate-500 flex items-center gap-2"><RotateCw className="w-4 h-4" /> Turas om: <span className="text-indigo-600 uppercase bg-indigo-50 px-2 py-1 rounded">{currentTeam.name}</span></div>
                    <button onClick={() => dispatch({ type: 'RESET_APP' })} className="px-4 py-1 border border-slate-300 rounded hover:bg-slate-100 text-sm font-bold">Avsluta</button>
                </div>
            </div>
            <div className="flex-1 p-6 overflow-y-auto relative">
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-6">
                    {session.jeopardyState.teams.map((team, idx) => (
                        <div key={idx} className={`bg-white rounded-lg p-3 shadow flex flex-col justify-between min-h-[100px] transition-all border-4 ${currentTeamIdx === idx ? 'border-indigo-600 ring-4 ring-indigo-600/20 scale-105 z-10' : 'border-transparent opacity-80'}`}>
                            <div>
                                <div className="text-xs font-bold text-slate-500 uppercase mb-1 truncate flex justify-between">
                                    {team.name}
                                    {currentTeamIdx === idx && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>}
                                </div>
                                <div className="text-3xl font-black text-slate-800">{team.score}p</div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4 max-w-6xl mx-auto">
                    {session.quizData.questions.map((q, idx) => {
                        const isCompleted = session.jeopardyState.completedQuestions.includes(idx);
                        const colorClass = JEOPARDY_COLORS[idx % JEOPARDY_COLORS.length];
                        return (
                            <button key={idx} onClick={() => handleGridClick(idx)} disabled={isCompleted} className={`aspect-square rounded-2xl shadow-lg flex items-center justify-center text-4xl font-black transition-all transform relative overflow-hidden ${isCompleted ? 'bg-slate-800 text-slate-600 cursor-not-allowed shadow-inner' : `${colorClass} hover:scale-105 hover:shadow-xl active:scale-95 cursor-pointer`}`}>
                                {idx + 1}
                                {isCompleted && <div className="absolute inset-0 bg-black/20" />}
                            </button>
                        );
                    })}
                </div>
            </div>
            {activeQuestion !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-6">
                    <div className="bg-white text-slate-900 w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] relative">
                        <div className="absolute top-0 left-0 right-0 h-2 bg-slate-200">
                            {currentModifier === 'gamble' && <div className="h-full bg-red-500 animate-pulse" />}
                            {currentModifier === 'double' && <div className="h-full bg-yellow-400" />}
                            {currentModifier === 'normal' && <div className="h-full bg-indigo-500" />}
                        </div>
                        <div className="p-8 flex-1 overflow-y-auto flex flex-col">
                            <div className="flex justify-between items-start mb-8">
                                <div className="text-slate-400 font-bold uppercase tracking-widest">Fråga {activeQuestion + 1}</div>
                                <div className="flex gap-2">
                                    {currentModifier === 'gamble' && <span className="px-4 py-1 bg-red-100 text-red-700 rounded-full font-bold flex items-center gap-2 border border-red-200"><AlertTriangle className="w-4 h-4" /> RISK</span>}
                                    {currentModifier === 'double' && <span className="px-4 py-1 bg-yellow-100 text-yellow-700 rounded-full font-bold flex items-center gap-2 border border-yellow-200"><Zap className="w-4 h-4" /> DUBBEL</span>}
                                </div>
                            </div>
                            <h2 className="text-3xl md:text-5xl font-bold mb-12 text-center leading-tight flex-1 flex items-center justify-center">
                                <MathRenderer>{session.quizData.questions[activeQuestion].question}</MathRenderer>
                            </h2>
                            <div className="max-w-4xl mx-auto w-full">
                                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-6 text-center">
                                    <div className="text-sm text-indigo-400 font-bold uppercase mb-1">Det är er tur</div>
                                    <div className="text-2xl font-black text-indigo-900">{currentTeam.name}</div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {session.quizData.questions[activeQuestion].options.map((opt, idx) => (
                                        <button key={idx} onClick={() => handleOptionClick(idx)} disabled={resultState !== null} className={`p-6 border-2 rounded-xl text-lg font-bold transition-all ${resultState !== null ? (idx === session.quizData.questions[activeQuestion].correctAnswerIndex ? "bg-green-500 border-green-600 text-white" : "opacity-30 grayscale") : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50 hover:border-indigo-300"}`}>
                                            <MathRenderer>{opt}</MathRenderer>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {showAnswer && (
                                <div className="mt-6 bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded animate-fade-in">
                                    <div className="flex items-center gap-2 font-bold text-indigo-900 mb-1">
                                        {resultState === 'correct' ? <CheckCircle className="text-green-600" /> : <XCircle className="text-red-500" />}
                                        {resultState === 'correct' ? 'Rätt svar!' : 'Tyvärr fel...'}
                                    </div>
                                    <p className="text-indigo-800">{session.quizData.questions[activeQuestion].explanation}</p>
                                </div>
                            )}
                        </div>
                        <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-between items-center">
                            <div className="text-xs text-slate-400">Poäng delas ut automatiskt.</div>
                            <button onClick={handleManualClose} className="text-slate-500 hover:text-slate-800 font-bold text-sm">Hoppa över</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};