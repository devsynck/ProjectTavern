# 🌌 Project Tavern: AI-Driven Roleplay Interface

A high-fidelity, multimodal roleplay interface designed for the next generation of LLM-driven storytelling. Create complex narratives, manage detailed character profiles, and engage in immersive conversations within a premium glass-morphic environment.

![1](https://github.com/user-attachments/assets/a4cdca0e-868b-4dcd-9074-586f10e59f76)
![2](https://github.com/user-attachments/assets/a43645bf-bb83-41a6-99f5-29d3b33e1b8b)
![3](https://github.com/user-attachments/assets/63a6815e-f362-4734-bab6-88acb8e1891f)




---

## ✨ Key Features

### 🏺 Character Library & Profile Management
*   **Persistent Storage**: Powered by IndexedDB, the Tavern bypasses the 5MB limits of standard local storage. Manage extensive character libraries and infinite message histories with stability.
*   **Spec V2 Character Support**: Seamlessly import characters from Tavern V2 `.png` cards or `.json` files.
*   **Profile Editor**: Design high-fidelity **AI Characters** (NPCs) or **User Personas**.
*   **Auto-Identity Alignment**: The Tavern automatically applies your most recently used User Persona when a new conversation begins.

### 🖼️ High-Fidelity Image Generation
*   **ComfyUI Integration**: Includes a built-in proxy for ComfyUI. Generate stable, high-fidelity character portraits and scene imagery directly within the chat.
*   **Automated Prompting**: LLM-driven generation of visual character descriptions to ensure structural consistency across all portraits.
*   **Persistent Image Storage**: Generated images are automatically saved to your local database as Base64 assets.

### 🗣️ Voice & Message Engine
*   **Universal API Proxy**: Robust support for OpenAI-compatible APIs (Z.ai, OpenRouter, local Llama.cpp).
*   **Text-to-Speech (TTS)**: High-fidelity voice output via **Kokoro-TTS**, ElevenLabs, or standard WebSpeech APIs.
*   **Dynamic Styling**: Immersive storytelling with automatic italicized narration and bold-face dialogue.

---

## 🛠️ Installation Guide

### 1. Prerequisites
Ensure your local machine has the following requirements:
*   **Node.js** (v18.0 or higher)
*   **npm** (comes with Node)
*   *Recommended*: A local LLM server (Llama.cpp, KoboldCPP) or a ComfyUI installation for image generation.

### 2. Clone the Repository
```bash
git clone https://github.com/your-username/project-tavern.git
cd project-tavern
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run the Application
```bash
npm run dev
```
Access the application at [http://localhost:3000](http://localhost:3000).

---

## 📦 Containerization (Docker)

For those who wish to run Project Tavern within an isolated container, Docker compose and standalone options are available.

### Deploy via Docker Compose (Recommended)
This is the simplest method to setup Project Tavern and its dependencies.

1.  **Start Deployment**:
    ```bash
    docker compose up -d --build
    ```
2.  **Access the Interface**: The application will be available at [http://localhost:3000](http://localhost:3000).

### Build Standalone Docker Image
If you prefer to build the container manually:

1.  **Build the Image**:
    ```bash
    docker build -t project-tavern .
    ```
2.  **Run the Container**:
    ```bash
    docker run -p 3000:3000 --name project-tavern project-tavern
    ```

---

## ⚙️ Configuration

1.  **Settings**: Configure your AI model providers (OpenAI, OpenRouter, etc.) and ComfyUI endpoints.
2.  **Persistence**: All character profiles and chat histories (IndexedDB) are saved to your browser's persistent storage.
3.  **Voice Settings**: WebSpeech is available natively; Kokoro-TTS and other providers require external API nodes (configurable in Settings).

---

## 📜 Technical Stack

*   **Framework**: Next.js 16 (App Router & Turbopack)
*   **Language**: TypeScript
*   **Database**: IndexedDB
*   **Styling**: Vanilla CSS (Glassmorphism & Theme Support)
*   **Icons**: Lucide React

---

## ⚖️ License
Distributed under the MIT License. Use responsibly.

---

## 🍵 Support the Project

If Project Tavern has added value to your workflow, consider supporting the project. Your contributions ensure the continued development of this interface.

[![Support Project Tavern](https://img.shields.io/badge/Donate-BITCOIN-orange?style=for-the-badge&logo=bitcoin)](bitcoin:bc1qpexehwqnm4huxztxn0kk33a2ps8gxj3rlef7xf)

**BTC Address:** `bc1qpexehwqnm4huxztxn0kk33a2ps8gxj3rlef7xf`

---

> *"Great stories start with a single prompt. Every message a memory, every silence a scene."*
