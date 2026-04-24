/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { auth, signIn, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, Send, Sparkles, Calendar, User as UserIcon, LogOut, ChevronRight, CheckCircle2 } from 'lucide-react';
import { chatWithRitmo } from './services/gemini';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
interface RitualMessage {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: any;
}

interface UserProfile {
  userId: string;
  name: string;
  cronotype?: string;
  energyLevels?: { morning: number; afternoon: number; evening: number };
  onboardingComplete: boolean;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<RitualMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'plan' | 'profile'>('chat');
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch/Create Profile
        const profileDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (profileDoc.exists()) {
          setProfile(profileDoc.data() as UserProfile);
        } else {
          const newProfile = {
            userId: currentUser.uid,
            name: currentUser.displayName?.split(' ')[0] || 'Amigo',
            onboardingComplete: false,
          };
          await setDoc(doc(db, 'users', currentUser.uid), newProfile);
          setProfile(newProfile);
        }

        // Listen for messages
        const msgsQuery = query(collection(db, 'users', currentUser.uid, 'messages'), orderBy('timestamp', 'asc'));
        const unsubscribeMsgs = onSnapshot(msgsQuery, (snapshot) => {
          const newMsgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RitualMessage));
          setMessages(newMsgs);
        });
        
        return () => unsubscribeMsgs();
      } else {
        setProfile(null);
        setMessages([]);
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !user || !profile) return;

    const userText = inputText;
    setInputText('');
    setIsTyping(true);

    try {
      // 1. Add user message to Firestore
      await addDoc(collection(db, 'users', user.uid, 'messages'), {
        text: userText,
        sender: 'user',
        timestamp: serverTimestamp(),
      });

      // 2. Prepare context for Gemini
      const history = messages.slice(-10).map(m => ({
        role: m.sender,
        content: m.text
      }));
      history.push({ role: 'user', content: userText });

      // 3. Call Ritmo
      const ritmoResponse = await chatWithRitmo(history, profile);

      // 4. Add assistant message to Firestore
      await addDoc(collection(db, 'users', user.uid, 'messages'), {
        text: ritmoResponse,
        sender: 'assistant',
        timestamp: serverTimestamp(),
      });

      // 5. Update profile asynchronously
      const updatedProfile = await import('./services/gemini').then(m => 
        m.extractProfileUpdates([...history, { role: 'assistant', content: ritmoResponse }], profile)
      );
      if (updatedProfile && JSON.stringify(updatedProfile) !== JSON.stringify(profile)) {
        const finalProfile = { ...profile, ...updatedProfile, userId: user.uid };
        await setDoc(doc(db, 'users', user.uid), finalProfile);
        setProfile(finalProfile);
      }

    } catch (error) {
      console.error("Message Error:", error);
    } finally {
      setIsTyping(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#F8FAFC]">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-indigo-600"
        >
          <Sparkles size={48} />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#F8FAFC] p-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full space-y-8"
        >
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto text-white mb-4 shadow-xl shadow-indigo-200">
            <Sparkles size={40} />
          </div>
          <h1 className="text-5xl font-display font-bold text-slate-900 tracking-tight">Ritmo</h1>
          <p className="text-slate-500 text-lg">
            Seu assistente pessoal inteligente para uma rotina equilibrada e produtiva.
          </p>
          <button
            onClick={signIn}
            className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] font-bold transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-200"
          >
            <LogIn size={20} />
            Entrar com Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col lg:flex-row bg-[#F8FAFC]">
      {/* Sidebar / Desktop Nav */}
      <nav className="fixed bottom-0 lg:relative lg:h-full w-full lg:w-24 bg-white border-t lg:border-t-0 lg:border-r border-slate-100 p-4 flex lg:flex-col items-center justify-between z-50">
        <div className="hidden lg:flex w-12 h-12 bg-indigo-600 rounded-2xl items-center justify-center text-white mb-8 shadow-lg shadow-indigo-100">
          <Sparkles size={24} />
        </div>
        
        <div className="flex lg:flex-col gap-8 w-full justify-around lg:justify-center items-center">
          <NavButton active={activeTab === 'chat'} icon={<Send size={24} />} onClick={() => setActiveTab('chat')} />
          <NavButton active={activeTab === 'plan'} icon={<Calendar size={24} />} onClick={() => setActiveTab('plan')} />
          <NavButton active={activeTab === 'profile'} icon={<UserIcon size={24} />} onClick={() => setActiveTab('profile')} />
        </div>

        <button 
          onClick={() => auth.signOut()}
          className="hidden lg:flex p-3 text-slate-300 hover:text-red-500 transition-colors"
        >
          <LogOut size={24} />
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-hidden flex flex-col relative pb-20 lg:pb-0">
        <header className="p-8 pb-4 bg-[#F8FAFC]/80 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between border-b border-slate-100">
          <div>
            <h2 className="text-3xl font-display font-bold text-slate-900 tracking-tight">
              {activeTab === 'chat' && 'Conversar com Ritmo'}
              {activeTab === 'plan' && 'Plano de Hoje'}
              {activeTab === 'profile' && 'Perfil Dinâmico'}
            </h2>
            <p className="text-sm font-medium text-slate-400">Olá, {profile?.name} • Otimizando seu ritmo</p>
          </div>
          <div className="lg:hidden">
             <button onClick={() => auth.signOut()} className="p-2 text-slate-400"><LogOut size={20} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-6" ref={scrollRef}>
          {activeTab === 'chat' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.length === 0 && (
                <div className="text-center py-20 space-y-6">
                  <div className="w-20 h-20 bg-indigo-50 rounded-[2rem] flex items-center justify-center mx-auto text-indigo-500 shadow-sm">
                     <Sparkles size={40} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-display font-bold text-slate-900">Como está seu ritmo hoje?</h3>
                    <p className="text-slate-500 max-w-sm mx-auto text-lg">Mande uma mensagem para ajustarmos seu plano ou registrar como você está se sentindo.</p>
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex flex-col max-w-[85%]",
                    m.sender === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  <div className={cn(
                    "px-5 py-4 rounded-[1.5rem]",
                    m.sender === 'user' 
                      ? "bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-100" 
                      : "bg-white border border-slate-100 text-slate-800 shadow-sm rounded-tl-none"
                  )}>
                    <div className="prose prose-sm prose-slate max-w-none">
                      <ReactMarkdown>
                        {m.text}
                      </ReactMarkdown>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-300 mt-2 uppercase tracking-widest pl-1">
                    {m.timestamp?.toDate ? m.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sincronizando...'}
                  </span>
                </motion.div>
              ))}
              {isTyping && (
                <div className="flex gap-1.5 items-center text-indigo-200 ml-4 py-2">
                   <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-2 h-2 bg-indigo-400 rounded-full" />
                   <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} className="w-2 h-2 bg-indigo-400 rounded-full" />
                   <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} className="w-2 h-2 bg-indigo-400 rounded-full" />
                </div>
              )}
            </div>
          )}

          {activeTab === 'plan' && <DailyPlanView profile={profile} />}
          {activeTab === 'profile' && <ProfileView profile={profile} />}
        </div>

        {activeTab === 'chat' && (
          <div className="p-8 pt-0">
            <form 
              onSubmit={handleSendMessage}
              className="max-w-4xl mx-auto relative group"
            >
              <div className="absolute inset-0 bg-indigo-500/5 blur-2xl rounded-3xl -z-10 group-focus-within:bg-indigo-500/10 transition-all"></div>
              <input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Falar com Ritmo..."
                className="w-full bg-white border border-slate-100 rounded-[1.75rem] py-5 pl-8 pr-16 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 shadow-xl shadow-slate-200/50 text-slate-700 placeholder:text-slate-300"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="absolute right-3 top-3 h-12 w-12 bg-indigo-600 rounded-[1.25rem] text-white flex items-center justify-center hover:bg-slate-900 disabled:opacity-50 transition-all shadow-lg"
              >
                <ChevronRight size={24} />
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

function NavButton({ active, icon, onClick }: { active: boolean; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "p-4 rounded-2xl transition-all",
        active ? "bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100" : "text-slate-300 hover:text-slate-500 hover:bg-slate-50"
      )}
    >
      {icon}
    </button>
  );
}

function DailyPlanView({ profile }: { profile: UserProfile | null }) {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Manhã */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">01 • Manhã</span>
            <div className="h-px flex-1 bg-slate-100"></div>
          </div>
          <PlanItemSmall time="09:00" task="Despertar Suave" accent="amber" done />
          <PlanItemSmall time="11:30" task="Brunch Nutritivo" />
        </div>

        {/* Tarde */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">02 • Tarde</span>
            <div className="h-px flex-1 bg-slate-100"></div>
          </div>
          <div className="ritmo-card p-4 bg-indigo-600 text-white shadow-lg shadow-indigo-100">
            <div className="flex justify-between items-center mb-1">
              <p className="text-[10px] font-bold opacity-70">14:00 - 17:00</p>
              <span className="text-[8px] bg-white/20 px-1.5 py-0.5 rounded uppercase font-bold">Foco Total</span>
            </div>
            <h4 className="font-bold">Deep Work: Projeto X</h4>
            <p className="text-[10px] opacity-80 mt-1">Otimização e Documentação.</p>
          </div>
          <PlanItemSmall time="17:30" task="Movimento Consciente" accent="emerald" />
        </div>

        {/* Noite */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">03 • Noite</span>
            <div className="h-px flex-1 bg-slate-100"></div>
          </div>
          <PlanItemSmall time="20:00" task="Fluxo Criativo" accent="indigo" />
          <div className="ritmo-card p-4 bg-slate-900 text-white">
            <p className="text-[10px] font-bold opacity-50">23:30</p>
            <h4 className="font-bold italic">Desconexão Digital</h4>
            <p className="text-[10px] opacity-60 mt-1">Leitura e luz baixa.</p>
          </div>
        </div>
      </div>

      <div className="ritmo-card p-4 bg-white flex items-center gap-4 py-4 px-6 border-slate-100 shadow-xl shadow-slate-200/50">
         <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 flex-shrink-0">
            <Sparkles size={20} />
         </div>
         <p className="text-sm text-slate-600 italic">
           "Esse plano parece realista para você hoje, {profile?.name}? Queremos ajustar algum bloco?"
         </p>
      </div>
    </div>
  );
}

function PlanItemSmall({ time, task, accent, done }: { time: string; task: string; accent?: string; done?: boolean }) {
  const accentClasses = {
    amber: "border-l-amber-400",
    emerald: "border-l-emerald-400",
    indigo: "border-l-indigo-400",
    none: "border-l-slate-200"
  };

  return (
    <div className={cn(
      "ritmo-card p-4 border-l-4 shadow-sm",
      accent ? accentClasses[accent as keyof typeof accentClasses] : accentClasses.none,
      done && "opacity-60"
    )}>
      <p className="text-[10px] font-bold text-slate-400">{time}</p>
      <h4 className={cn("font-bold text-sm", done && "line-through")}>{task}</h4>
    </div>
  );
}

function ProfileView({ profile }: { profile: UserProfile | null }) {
  if (!profile) return null;
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatsCard label="Seu Cronotipo" value={profile.cronotype === 'morning' ? 'Cotovia' : profile.cronotype === 'night' ? 'Coruja' : 'Humano'} icon={profile.cronotype === 'night' ? '🦉' : '☀️'} color="bg-amber-50" textColor="text-amber-700" />
        <StatsCard label="Foco Atual" value="Resiliência Espelhada" icon="🛡️" color="bg-indigo-50" textColor="text-indigo-700" />
      </div>

      <div className="ritmo-card p-8">
         <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-display font-bold text-slate-900">DNA de Rotina</h3>
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest px-2 py-1 bg-indigo-50 rounded-full">Atualizado agora</span>
         </div>
         <div className="flex flex-wrap gap-3">
            {['Focado pela manhã', 'Café às 10h', 'Evita trânsito', 'Adora ler', 'Pico de energia às 20h', 'Desconexão tardia'].map(tag => (
              <span key={tag} className="px-4 py-2 bg-slate-50 rounded-2xl text-sm font-semibold text-slate-600 border border-slate-100">
                {tag}
              </span>
            ))}
         </div>
      </div>

      <div className="p-8 text-center text-slate-400 text-sm italic">
        Continuo mapeando seu ritmo pessoal a cada interação. Sua evolução é gradual. 📈
      </div>
    </div>
  );
}

function StatsCard({ label, value, icon, color, textColor }: { label: string; value: string; icon: string, color: string, textColor: string }) {
  return (
    <div className={cn("ritmo-card p-8 flex items-center justify-between", color)}>
      <div>
        <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-2", textColor)}>{label}</p>
        <p className="text-2xl font-display font-bold text-slate-900">{value}</p>
      </div>
      <span className="text-4xl filter drop-shadow-sm">{icon}</span>
    </div>
  );
}
