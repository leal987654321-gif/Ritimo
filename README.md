# Ritmo - Assistente Pessoal Inteligente

Este aplicativo foi desenvolvido para ajudar a otimizar sua rotina diária usando IA (Gemini) e Firebase.

## Configuração para GitHub e Vercel

Se você deseja hospedar este projeto no Vercel ou sincronizar com o GitHub, siga estas etapas para que tudo funcione "automaticamente":

### 1. Variáveis de Ambiente (Secrets)

Você precisa adicionar a seguinte chave nas configurações do seu projeto no Vercel (Environment Variables) ou no GitHub Actions (Secrets):

- `GEMINI_API_KEY`: Sua chave da API do Google AI Studio.

### 2. Configuração do Firebase

O arquivo `firebase-applet-config.json` contém as chaves públicas do Firebase necessárias para o funcionamento do banco de dados e autenticação. Se você estiver usando um projeto Firebase próprio, certifique-se de atualizar este arquivo com suas credenciais.

### 3. Problemas Comuns (O App não abre?)

Se o aplicativo ficar preso na tela de carregamento ou mostrar um erro:
- **Cookies de Terceiros:** O Firebase Authentication (Google Login) exige que cookies de terceiros estejam habilitados, especialmente dentro de iFrames (como na prévia do AI Studio).
- **IndexedDB:** Em alguns navegadores em modo anônimo, o IndexedDB pode estar bloqueado. O app agora usa `sessionPersistence` para tentar contornar isso.

## Tecnologias
- React + Vite
- Firebase (Auth & Firestore)
- Gemini API (Google AI)
- Tailwind CSS
- Framer Motion
