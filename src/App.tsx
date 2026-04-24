/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { auth, signIn, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
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
      <div className="h-screen w-full flex items-center justify-center bg-[#FDFCF9]">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-orange-500"
        >
          <Sparkles size={48} />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#FDFCF9] p-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full space-y-8"
        >
          <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto text-orange-500 mb-4">
            <Sparkles size={40} />
          </div>
          <h1 className="text-5xl font-display font-bold text-neutral-900 tracking-tight">Ritmo</h1>
          <p className="text-neutral-500 text-lg">
            Seu assistente empático para uma rotina que realmente funciona.
          </p>
          <button
            onClick={signIn}
            className="w-full py-4 px-6 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-semibold transition-all flex items-center justify-center gap-3 shadow-lg shadow-orange-200"
          >
            <LogIn size={20} />
            Entrar com Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col lg:flex-row bg-[#FDFCF9]">
      {/* Sidebar / Desktop Nav */}
      <nav className="fixed bottom-0 lg:relative lg:h-full w-full lg:w-24 bg-white border-t lg:border-t-0 lg:border-r border-neutral-100 p-4 flex lg:flex-col items-center justify-between z-50">
        <div className="hidden lg:flex w-12 h-12 bg-orange-500 rounded-2xl items-center justify-center text-white mb-8">
          <Sparkles size={24} />
        </div>
        
        <div className="flex lg:flex-col gap-8 w-full justify-around lg:justify-center items-center">
          <NavButton active={activeTab === 'chat'} icon={<Send size={24} />} onClick={() => setActiveTab('chat')} />
          <NavButton active={activeTab === 'plan'} icon={<Calendar size={24} />} onClick={() => setActiveTab('plan')} />
          <NavButton active={activeTab === 'profile'} icon={<UserIcon size={24} />} onClick={() => setActiveTab('profile')} />
        </div>

        <button 
          onClick={() => auth.signOut()}
          className="hidden lg:flex p-3 text-neutral-400 hover:text-red-500 transition-colors"
        >
          <LogOut size={24} />
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-hidden flex flex-col relative pb-20 lg:pb-0">
        <header className="p-6 bg-[#FDFCF9]/80 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between border-b border-neutral-100">
          <div>
            <h2 className="text-2xl font-display font-bold text-neutral-900">
              {activeTab === 'chat' && 'Conversar com Ritmo'}
              {activeTab === 'plan' && 'Seu Plano de Hoje'}
              {activeTab === 'profile' && 'Seu Perfil Dinâmico'}
            </h2>
            <p className="text-sm text-neutral-400">Olá, {profile?.name} ✨</p>
          </div>
          <div className="lg:hidden">
             <button onClick={() => auth.signOut()} className="p-2 text-neutral-400"><LogOut size={20} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4" ref={scrollRef}>
          {activeTab === 'chat' && (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.length === 0 && (
                <div className="text-center py-12 space-y-4">
                  <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto text-orange-400">
                     <Sparkles size={32} />
                  </div>
                  <h3 className="text-xl font-display font-bold">Comece sua jornada</h3>
                  <p className="text-neutral-500">Me conte como foi seu dia ou peça ajuda para organizar o amanhã.</p>
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
                    "px-4 py-3 rounded-2xl",
                    m.sender === 'user' 
                      ? "bg-orange-500 text-white rounded-tr-none" 
                      : "bg-white border border-neutral-100 text-neutral-800 shadow-sm rounded-tl-none"
                  )}>
                    <ReactMarkdown className="prose prose-sm prose-neutral max-w-none">
                      {m.text}
                    </ReactMarkdown>
                  </div>
                  <span className="text-[10px] text-neutral-300 mt-1 uppercase tracking-wider">
                    {m.timestamp?.toDate ? m.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Agora'}
                  </span>
                </motion.div>
              ))}
              {isTyping && (
                <div className="flex gap-1 items-center text-neutral-300 ml-2">
                   <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-neutral-300 rounded-full" />
                   <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-neutral-300 rounded-full" />
                   <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-neutral-300 rounded-full" />
                </div>
              )}
            </div>
          )}

          {activeTab === 'plan' && <DailyPlanView profile={profile} />}
          {activeTab === 'profile' && <ProfileView profile={profile} />}
        </div>

        {activeTab === 'chat' && (
          <div className="p-6 pt-0">
            <form 
              onSubmit={handleSendMessage}
              className="max-w-3xl mx-auto relative"
            >
              <input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Mande uma mensagem..."
                className="w-full bg-white border border-neutral-200 rounded-2xl py-4 pl-6 pr-14 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-sm"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="absolute right-2 top-2 h-10 w-10 bg-orange-500 rounded-xl text-white flex items-center justify-center hover:bg-orange-600 disabled:opacity-50 transition-all"
              >
                <ChevronRight size={20} />
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
        "p-3 rounded-2xl transition-all",
        active ? "bg-orange-50 text-orange-500 shadow-sm" : "text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50"
      )}
    >
      {icon}
    </button>
  );
}

function DailyPlanView({ profile }: { profile: UserProfile | null }) {
  // Mocking current plan for now, in a real app would fetch from Firestore /users/{id}/plans
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="ritmo-card p-8 bg-gradient-to-br from-orange-50 to-white">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-orange-500 shadow-sm">
            <Calendar size={24} />
          </div>
          <div>
            <h3 className="text-xl font-display font-bold">Plano de 24 de Abril</h3>
            <p className="text-neutral-500">Objetivo: Foco e Bem-estar</p>
          </div>
        </div>
        
        <div className="space-y-6">
          <PlanItem time="07:00" task="Acordar e luz natural" done />
          <PlanItem time="08:30" task="Bloco de Trabalho Focado (Deep Work)" current />
          <PlanItem time="12:30" task="Almoço Sem Telas" />
          <PlanItem time="17:00" task="Pequena caminhada" />
          <PlanItem time="21:30" task="Ritual de Sono" />
        </div>
      </div>
      
      <p className="text-center text-neutral-400 text-sm italic">
        "O sucesso é a soma de pequenos esforços, repetidos dia após dia."
      </p>
    </div>
  );
}

function PlanItem({ time, task, done, current }: { time: string; task: string; done?: boolean; current?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-4 p-4 rounded-2xl transition-all",
      current ? "bg-white shadow-md border border-orange-100" : "opacity-80"
    )}>
      <div className="text-sm font-mono text-neutral-400 w-12">{time}</div>
      <div className={cn("flex-1 font-medium", done && "line-through text-neutral-300")}>{task}</div>
      {done ? <CheckCircle2 className="text-green-500" /> : current ? <Sparkles className="text-orange-500" /> : <div className="w-6 h-6 rounded-full border-2 border-neutral-100" />}
    </div>
  );
}

function ProfileView({ profile }: { profile: UserProfile | null }) {
  if (!profile) return null;
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatsCard label="Cronotipo" value={profile.cronotype || 'Aprendendo...'} icon="🌙" />
        <StatsCard label="Energia" value="Otimista" icon="⚡" />
      </div>

      <div className="ritmo-card p-6 space-y-4">
         <h3 className="text-lg font-bold">O que sei sobre você</h3>
         <div className="flex flex-wrap gap-2">
            {['Focado pela manhã', 'Café às 10h', 'Evita trânsito', 'Adora ler'].map(tag => (
              <span key={tag} className="px-3 py-1 bg-neutral-100 rounded-full text-sm text-neutral-600">
                {tag}
              </span>
            ))}
         </div>
      </div>

      <div className="p-6 text-center text-neutral-400">
        Continuo aprendendo seu ritmo a cada conversa. 📈
      </div>
    </div>
  );
}

function StatsCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="ritmo-card p-6 flex items-center justify-between">
      <div>
        <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1 font-semibold">{label}</p>
        <p className="text-xl font-display font-bold">{value}</p>
      </div>
      <span className="text-2xl">{icon}</span>
    </div>
  );
}
