# Agent Lee: Your Personal AI Assistant

Agent Lee is a voice-activated, multimodal AI assistant built with Next.js and powered by Google's Gemini models through Genkit. He's designed to be a sharp, culturally-aware, and highly capable digital companion, ready to assist with tasks using vision, web search, and group conversation memory.

## ✨ Key Features

- **🎙️ Voice Activation**: Engage in natural, spoken conversations.
- **👁️ Vision Capabilities**: Ask questions about what you're seeing through your camera feed.
- **🌐 Web Search**: Get up-to-date information on any topic from the web.
- **📅 Calendar Management**: List and create calendar events with simple voice commands.
- **👥 Group Conversation Memory**: Tracks conversations between multiple speakers using a Firestore backend, allowing for context-aware responses in a group setting.
- **😎 Dynamic Personality**: A unique and engaging personality that avoids repetitive, robotic responses.

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (with App Router)
- **AI/Backend**: [Genkit](https://firebase.google.com/docs/genkit) for orchestrating AI flows with Google Gemini models.
- **Database**: [Firebase Firestore](https://firebase.google.com/docs/firestore) for group conversation memory.
- **UI**: [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/)
- **Components**: [ShadCN UI](https://ui.shadcn.com/)

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- An active [Firebase Project](https://firebase.google.com/)
- A Google Cloud project with the [AI Platform API enabled](https://console.cloud.google.com/apis/library/aiplatform.googleapis.com) to get a Gemini API Key.

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/4citeB4U/AgentLee.git
    cd AgentLee
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up your Firebase project:**
    - In your Firebase project console, go to **Build > Authentication** and enable it.
    - Go to **Build > Firestore Database** and create a new database. Start in **Test Mode** for initial development (you can secure it with proper rules later).

4.  **Create your environment file:**
    - Rename the `.env.example` file (if present) to `.env`.
    - Go to your Firebase project settings and find your web app's configuration credentials.
    - Populate the `.env` file with your Firebase and Google AI credentials:
      ```env
      # Firebase Configuration
      NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
      NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
      NEXT_PUBLIC_FIREBASE_APP_ID=1:...:web:...

      # Google AI (Gemini) API Key
      GEMINI_API_KEY=AIza...
      ```

5.  **Run the development server:**
    The application runs two servers: one for the Next.js frontend and one for the Genkit AI flows.

    - **Terminal 1: Start the Next.js app:**
      ```bash
      npm run dev
      ```
    - **Terminal 2: Start the Genkit flows:**
      ```bash
      npm run genkit:watch
      ```

6.  **Open the app:**
    Open [http://localhost:3000](http://localhost:3000) (or your configured port) in your browser to see the result. You will need to grant camera and microphone permissions to interact with Agent Lee.
