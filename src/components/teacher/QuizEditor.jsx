'use client';
import React, { useState, useRef } from 'react';
import {
    ArrowLeft, Save, Trash2, ImageIcon, Upload, Plus, MinusCircle, Tag, AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function QuizEditor({ quizToEdit, categories, dispatch }) {
    const [quiz, setQuiz] = useState(quizToEdit ? JSON.parse(JSON.stringify(quizToEdit)) : { title: "Nytt Quiz", category: categories?.[0] || "Allmänt", questions: [] });
    const fileInputRefs = useRef([]);
    const [saving, setSaving] = useState(false);
    const [editorError, setEditorError] = useState(null); // Ny state för felmeddelanden istället för alert

    const handleQuestionChange = (idx, field, value) => {
        const updatedQuestions = [...quiz.questions];
        updatedQuestions[idx][field] = value;
        setQuiz({ ...quiz, questions: updatedQuestions });
    };

    const handleOptionChange = (qIdx, optIdx, value) => {
        const updatedQuestions = [...quiz.questions];
        updatedQuestions[qIdx].options[optIdx] = value;
        setQuiz({ ...quiz, questions: updatedQuestions });
    };

    const addOption = (qIdx) => {
        const updatedQuestions = [...quiz.questions];
        updatedQuestions[qIdx].options.push("Nytt alternativ");
        setQuiz({ ...quiz, questions: updatedQuestions });
    };

    const removeOption = (qIdx, optIdx) => {
        const updatedQuestions = [...quiz.questions];
        if (updatedQuestions[qIdx].options.length <= 2) {
            // alert("Minst 2 alternativ krävs."); -> Ignorera bara
            return;
        }
        updatedQuestions[qIdx].options.splice(optIdx, 1);
        if (updatedQuestions[qIdx].correctAnswerIndex >= optIdx) {
            updatedQuestions[qIdx].correctAnswerIndex = Math.max(0, updatedQuestions[qIdx].correctAnswerIndex - 1);
        }
        setQuiz({ ...quiz, questions: updatedQuestions });
    };

    const handleImageUpload = (qIdx, e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            handleQuestionChange(qIdx, 'image', reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setEditorError(null);
        if (!quiz.title.trim()) { setEditorError("Titel saknas!"); return; }
        if (quiz.questions.length === 0) { setEditorError("Lägg till minst en fråga."); return; }

        setSaving(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Du måste vara inloggad");

            const quizPayload = {
                title: quiz.title,
                category: quiz.category,
                questions: quiz.questions,
                creator_id: user.id,
                ...(quiz.id && { id: quiz.id })
            };

            const { data, error } = await supabase
                .from('quizzes')
                .upsert(quizPayload)
                .select()
                .single();

            if (error) throw error;

            dispatch({ type: 'SAVE_EDITED_QUIZ', payload: data });
            // alert("Quiz sparat!"); -> Borta, vi byter bara vy
            dispatch({ type: 'SET_VIEW', payload: 'teacher_dashboard' });

        } catch (err) {
            setEditorError("Kunde inte spara: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-slate-900 to-black pb-12 text-white">
            <header className="bg-white/5 backdrop-blur-md border-b border-white/10 px-6 py-4 sticky top-0 z-10 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button onClick={() => dispatch({ type: 'SET_VIEW', payload: 'teacher_dashboard' })} className="p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-colors cursor-pointer"><ArrowLeft className="w-6 h-6" /></button>
                    <h1 className="font-bold text-xl">Redigera Quiz</h1>
                </div>
                <div className="flex items-center gap-4">
                     {editorError && <div className="text-red-400 text-sm font-bold flex items-center gap-2 bg-red-500/10 px-3 py-1 rounded border border-red-500/20"><AlertCircle className="w-4 h-4"/>{editorError}</div>}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-500 flex items-center gap-2 shadow-lg shadow-green-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        <Save className="w-4 h-4" /> {saving ? 'Sparar...' : 'Spara'}
                    </button>
                </div>
            </header>
            <main className="max-w-4xl mx-auto p-6 space-y-8">
                <div className="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-sm space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-indigo-300 mb-2">Quiz Titel</label>
                        <input
                            type="text"
                            value={quiz.title}
                            onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
                            className="w-full p-3 bg-slate-950/50 border border-white/10 rounded-xl font-bold text-xl focus:ring-2 focus:ring-indigo-500 outline-none text-white placeholder-white/20"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-indigo-300 mb-2">Kategori</label>
                        <div className="relative">
                            <select
                                value={quiz.category || (categories && categories[0]) || "Allmänt"}
                                onChange={(e) => setQuiz({ ...quiz, category: e.target.value })}
                                className="w-full p-3 bg-slate-950/50 border border-white/10 rounded-xl text-white appearance-none focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                            >
                                {categories && categories.map(cat => (
                                    <option key={cat} value={cat} className="bg-slate-900">{cat}</option>
                                ))}
                            </select>
                            <Tag className="absolute right-4 top-3.5 w-5 h-5 text-indigo-400 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {quiz.questions.map((q, qIdx) => (
                    <div key={qIdx} className="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-sm relative group hover:bg-white/10 transition-colors">
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => {
                                const updated = [...quiz.questions];
                                updated.splice(qIdx, 1);
                                setQuiz({ ...quiz, questions: updated });
                            }} className="text-red-400 hover:text-red-300 p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors cursor-pointer"><Trash2 className="w-5 h-5" /></button>
                        </div>

                        <div className="flex items-center gap-2 mb-4">
                            <span className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-xs font-mono font-bold shadow-lg shadow-indigo-500/30">FRÅGA {qIdx + 1}</span>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Fråga</label>
                            <input
                                type="text"
                                value={q.question}
                                onChange={(e) => handleQuestionChange(qIdx, 'question', e.target.value)}
                                className="w-full p-3 bg-slate-950/50 border border-white/10 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none text-white"
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Bild (Länk eller Ladda upp)</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="https://..."
                                    value={q.image || ''}
                                    onChange={(e) => handleQuestionChange(qIdx, 'image', e.target.value)}
                                    className="flex-1 p-3 bg-slate-950/50 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                                <input type="file" accept="image/*" className="hidden" ref={el => fileInputRefs.current[qIdx] = el} onChange={(e) => handleImageUpload(qIdx, e)} />
                                <button onClick={() => fileInputRefs.current[qIdx].click()} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-500 flex items-center gap-2 transition-colors cursor-pointer"><Upload className="w-4 h-4" /> Ladda upp</button>
                            </div>
                            {q.image && <img src={q.image} alt="Preview" className="mt-4 h-32 rounded-xl border border-white/10 object-contain bg-black/40" />}
                        </div>

                        <div className="mb-6">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Svarsalternativ (Markera rätt svar)</label>
                            <div className="space-y-3">
                                {q.options.map((opt, optIdx) => (
                                    <div key={optIdx} className="flex items-center gap-3">
                                        <div className="relative flex items-center">
                                            <input
                                                type="radio"
                                                name={`correct-${qIdx}`}
                                                checked={q.correctAnswerIndex === optIdx}
                                                onChange={() => handleQuestionChange(qIdx, 'correctAnswerIndex', optIdx)}
                                                className="w-6 h-6 text-green-500 bg-transparent border-2 border-white/30 focus:ring-green-500 focus:ring-offset-0 cursor-pointer"
                                            />
                                        </div>
                                        <input
                                            type="text"
                                            value={opt}
                                            onChange={(e) => handleOptionChange(qIdx, optIdx, e.target.value)}
                                            className={`flex-1 p-3 border rounded-xl text-sm bg-slate-950/50 text-white outline-none focus:ring-2 ${q.correctAnswerIndex === optIdx ? 'border-green-500 ring-1 ring-green-500/50' : 'border-white/10 focus:ring-indigo-500'}`}
                                        />
                                        <button onClick={() => removeOption(qIdx, optIdx)} className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer"><MinusCircle className="w-6 h-6" /></button>
                                    </div>
                                ))}
                                <button onClick={() => addOption(qIdx)} className="text-sm text-indigo-400 font-bold hover:text-indigo-300 flex items-center gap-1 mt-2 px-2 py-1 rounded hover:bg-white/5 transition-colors cursor-pointer"><Plus className="w-4 h-4" /> Lägg till alternativ</button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Fördjupning / Förklaring</label>
                            <textarea
                                value={q.explanation || ''}
                                onChange={(e) => handleQuestionChange(qIdx, 'explanation', e.target.value)}
                                className="w-full p-3 bg-slate-950/50 border border-white/10 rounded-xl text-sm h-24 focus:ring-2 focus:ring-indigo-500 outline-none text-white placeholder-white/20"
                            />
                        </div>
                    </div>
                ))}

                <button
                    onClick={() => { const newQ = { question: "Ny fråga?", options: ["Alt 1", "Alt 2"], correctAnswerIndex: 0, explanation: "" }; setQuiz({ ...quiz, questions: [...quiz.questions, newQ] }); }}
                    className="w-full py-4 border-2 border-dashed border-white/20 rounded-2xl text-slate-400 font-bold hover:border-indigo-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                    <Plus className="w-6 h-6" /> Lägg till Fråga
                </button>
            </main>
        </div>
    );
}
