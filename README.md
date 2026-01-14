# Workmate

<div align="center">

**Your AI Work Companion - Open Source Alternative to Anthropic's Cowork**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-1.83-orange.svg)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB.svg)](https://tauri.app/)

[Features](#features) • [Installation](#installation) • [Usage](#usage) • [Architecture](#architecture) • [Contributing](#contributing)

</div>

---

## Overview

Workmate is a powerful desktop application that brings AI assistance to your local development workflow. Built as an open-source alternative to [Anthropic's Cowork](https://claude.com/blog/cowork-research-preview), Workmate lets you work with AI on local files - like having an AI colleague that can read, edit, and create files on your computer.

### Key Features

- **🤖 AI-Powered File Operations** - Read, edit, and create files with AI assistance
- **🔒 Permission System** - User-friendly permission dialogs for all file operations
- **📁 Multi-Folder Support** - Work with multiple project folders simultaneously
- **💬 Conversational Interface** - Natural chat interface powered by AI Elements
- **🔌 Multiple LLM Providers** - Support for OpenRouter, Anthropic, OpenAI, Google, and Ollama
- **🎨 Beautiful UI** - Modern design with Tailwind CSS v4 and shadcn/ui
- **🖥️ Cross-Platform** - Built with Tauri for native performance on macOS, Windows, and Linux
- **🔧 OpenCode Integration** - Powered by the OpenCode agent framework

## Prerequisites

Before you begin, ensure you have the following installed:

- **[OpenCode](https://opencode.ai)** - The AI agent that powers Workmate
  ```bash
  curl -fsSL https://opencode.ai/install | bash
  ```

- **[Rust](https://rustup.rs/)** - For building the Tauri backend
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```

- **[Bun](https://bun.sh/)** or **[Node.js](https://nodejs.org/)** - For the frontend
  ```bash
  # Using Bun (recommended)
  curl -fsSL https://bun.sh/install | bash
  
  # Or using Node.js (npm/yarn)
  # Download from https://nodejs.org/
  ```

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/workmate.git
   cd workmate
   ```

2. **Install dependencies**
   ```bash
   # Using Bun (recommended)
   bun install
   
   # Or using npm
   npm install
   ```

3. **Configure your LLM provider**
   
   Workmate supports multiple LLM providers. You'll need an API key for at least one:
   
   - **OpenRouter**: https://openrouter.ai/keys
   - **Anthropic**: https://console.anthropic.com/
   - **OpenAI**: https://platform.openai.com/api-keys
   - **Google**: https://aistudio.google.com/app/apikey
   - **Ollama**: Install locally from https://ollama.ai/

## Usage

### Development Mode

Run Workmate in development mode with hot-reload:

```bash
# Using Bun
bun run tauri dev

# Using npm
npm run tauri dev
```

### Production Build

Build Workmate for production:

```bash
# Using Bun
bun run tauri build

# Using npm
npm run tauri build
```

The compiled application will be in `src-tauri/target/release/`.

### Getting Started

1. **Launch Workmate** - Start the application
2. **Add a Folder** - Click the settings icon and add your project folder
3. **Configure LLM** - Select your preferred LLM provider and enter your API key
4. **Start Chatting** - Ask the AI to help with your code!

### Example Prompts

- "Read the README.md file and summarize it"
- "Create a new component called Button in src/components/"
- "Refactor the authentication logic in auth.ts"
- "Find all TODO comments in the codebase"

## Architecture

Workmate is built with a modern, cross-platform architecture:

### Tech Stack

**Frontend:**
- **React** - UI framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool
- **Tailwind CSS v4** - Utility-first styling
- **shadcn/ui** - Beautiful UI components
- **AI Elements** - Vercel's AI UI components
- **Zustand** - State management

**Backend:**
- **Tauri 2.x** - Native desktop framework (Rust)
- **OpenCode SDK** - AI agent communication
- **tokio** - Async runtime

### Project Structure

```
workmate/
├── src/                      # Frontend source
│   ├── components/          # React components
│   │   ├── ai-elements/    # AI UI components
│   │   ├── chat/           # Chat interface
│   │   ├── permissions/    # Permission dialogs
│   │   ├── settings/       # Settings UI
│   │   ├── sidebar/        # Sidebar navigation
│   │   └── ui/             # shadcn/ui components
│   ├── hooks/              # React hooks
│   ├── lib/                # Utilities
│   ├── stores/             # Zustand stores
│   ├── types/              # TypeScript types
│   └── App.tsx             # Main app component
├── src-tauri/               # Tauri backend
│   ├── src/
│   │   ├── commands.rs     # Tauri commands
│   │   ├── lib.rs          # Main library
│   │   └── main.rs         # Entry point
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
└── public/                  # Static assets
```

### How It Works

1. **Tauri Backend** spawns an OpenCode server process when you add a folder
2. **OpenCode SDK** communicates with the server via HTTP and Server-Sent Events (SSE)
3. **React Frontend** provides the chat interface and permission dialogs
4. **OpenCode Agent** processes your requests and performs file operations
5. **Permission System** asks for your approval before any file changes

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on:

- Setting up your development environment
- Code style guidelines
- Submitting pull requests
- Reporting bugs and requesting features

## Roadmap

- [x] Core chat interface
- [x] Multi-provider LLM support
- [x] Permission system
- [x] Folder management
- [ ] Session persistence
- [ ] Streaming responses
- [ ] File diff preview
- [ ] MCP server configuration UI
- [ ] Browser automation integration
- [ ] Plugins system

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by [Anthropic's Cowork](https://claude.com/blog/cowork-research-preview)
- Built with [OpenCode](https://opencode.ai)
- UI components from [shadcn/ui](https://ui.shadcn.com)
- AI Elements from [Vercel](https://vercel.com/blog/ai-sdk-3-1)

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/workmate/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/workmate/discussions)

---

<div align="center">
Made with ❤️ by the Workmate community
</div>
