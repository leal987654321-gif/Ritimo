import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAi() {
  if (!aiInstance) {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "undefined") {
        console.warn("GEMINI_API_KEY is missing. AI features will be disabled.");
        return null;
      }
      aiInstance = new GoogleGenAI({ apiKey });
    } catch (e) {
      console.error("Failed to initialize GoogleGenAI:", e);
      return null;
    }
  }
  return aiInstance;
}

export const RITMO_SYSTEM_INSTRUCTION = `
Você é "Ritmo", um assistente pessoal inteligente, empático e altamente adaptativo. Seu objetivo principal é ajudar o usuário a construir e manter uma rotina diária que realmente funcione para a vida dele, melhorando gradualmente sua energia, produtividade, saúde e bem-estar.

Você aprende com o usuário ao longo do tempo. Toda conversa adiciona conhecimento ao seu "perfil dinâmico" da pessoa.

### Regras fundamentais:
- Seja sempre amigável, motivador sem ser chato ou forçado, direto e honesto.
- Use linguagem natural, como um coach pessoal brasileiro que entende a realidade do dia a dia (trânsito, família, trabalho, imprevistos, preguiça, etc.).
- Responda de forma clara, organizada e acionável. Use emojis com moderação para facilitar a leitura.
- Priorize o que é realista para o usuário.

### O que você deve saber e aprender sobre o usuário (Perfil Dinâmico):
- Cronotipo (acorda cedo ou é noturno?)
- Nível de energia ao longo do dia
- Tarefas que ele adora, odeia ou procrastina
- Prioridades de vida
- Restrições
- Hábitos atuais
- Feedback sobre o que funcionou ou não

### Formato recomendado para o Plano Diário (quando solicitado ou necessário):
- **Visão geral do dia** (tom positivo + objetivo principal)
- **Horários sugeridos** (em blocos: manhã, tarde, noite)
- **Tarefas principais**
- **Dicas de ajuste**

No final do plano, sempre pergunte se parece realista e como a pessoa se sente.

### Contexto Atual do Usuário:
{{USER_PROFILE}}

Responda sempre em Português do Brasil.
`;

export async function chatWithRitmo(messages: { role: string; content: string }[], userProfile: any) {
  const systemInstruction = RITMO_SYSTEM_INSTRUCTION.replace('{{USER_PROFILE}}', JSON.stringify(userProfile, null, 2));
  
  const contents = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));

  const ai = getAi();
  if (!ai) return "O sistema de IA não está configurado. Por favor, adicione a GEMINI_API_KEY.";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
      },
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Desculpe, tive um probleminha técnico aqui. Pode repetir? 😅";
  }
}

export async function extractProfileUpdates(messages: { role: string; content: string }[], currentProfile: any) {
  const ai = getAi();
  if (!ai) return currentProfile;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Com base nesta conversa recente: ${JSON.stringify(messages.slice(-5))}, e no perfil atual: ${JSON.stringify(currentProfile)}, identifique se houve alguma atualização ou nova informação sobre o usuário (cronotipo, energia, prioridades, restrições, hábitos). Retorne o perfil COMPLETO E ATUALIZADO se houver mudanças significativas, ou o mesmo perfil se nada mudou.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            cronotype: { type: Type.STRING },
            energyLevels: {
              type: Type.OBJECT,
              properties: {
                morning: { type: Type.INTEGER },
                afternoon: { type: Type.INTEGER },
                evening: { type: Type.INTEGER }
              }
            },
            priorities: { type: Type.ARRAY, items: { type: Type.STRING } },
            restrictions: { type: Type.ARRAY, items: { type: Type.STRING } },
            habits: { type: Type.ARRAY, items: { type: Type.STRING } },
            onboardingComplete: { type: Type.BOOLEAN }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Profile extraction error:", error);
    return currentProfile;
  }
}
