# Contributing to Workmate

First off, thank you for considering contributing to Workmate! It's people like you that make Workmate such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

**Bug Report Template:**
- **Description**: Clear description of the bug
- **Steps to Reproduce**: Detailed steps to reproduce the behavior
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Environment**:
  - OS: [e.g., macOS 14.1, Windows 11, Ubuntu 22.04]
  - Workmate Version: [e.g., 0.1.0]
  - OpenCode Version: [run `opencode --version`]
  - LLM Provider: [e.g., OpenRouter, Anthropic]
- **Screenshots**: If applicable
- **Logs**: Relevant error messages or logs

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Clear title and description**
- **Use case**: Why would this enhancement be useful?
- **Expected behavior**: How should it work?
- **Alternatives**: Alternative solutions you've considered
- **Additional context**: Screenshots, mockups, or examples

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Follow the development setup** (see below)
3. **Make your changes** following our coding standards
4. **Test your changes** thoroughly
5. **Update documentation** if needed
6. **Write meaningful commit messages**
7. **Submit a pull request**

## Development Setup

### Prerequisites

- **Rust** (1.83+): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Bun** (recommended) or Node.js (18+): `curl -fsSL https://bun.sh/install | bash`
- **OpenCode**: `curl -fsSL https://opencode.ai/install | bash`
- **Git**: Standard version control

### Setup Instructions

1. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/workmate.git
   cd workmate
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Run in development mode**
   ```bash
   bun run tauri dev
   ```

4. **Verify the build**
   ```bash
   # Check TypeScript
   bunx tsc --noEmit
   
   # Check Rust
   cd src-tauri && cargo check
   ```

## Coding Standards

### TypeScript/React

- **Use TypeScript** for all new code
- **Follow React best practices**: Use functional components and hooks
- **Component structure**:
  ```tsx
  // Imports
  import { ... } from "...";
  
  // Types
  interface ComponentProps {
    ...
  }
  
  // Component
  export function Component({ prop }: ComponentProps) {
    // Hooks
    const [state, setState] = useState(...);
    
    // Callbacks
    const handleEvent = useCallback(() => {
      ...
    }, [deps]);
    
    // Render
    return (...);
  }
  ```
- **Use meaningful names**: Components in PascalCase, functions in camelCase
- **Extract reusable logic** to custom hooks
- **Keep components focused**: Single responsibility principle

### Rust

- **Follow Rust conventions**: Use `rustfmt` and `clippy`
  ```bash
  cargo fmt
  cargo clippy
  ```
- **Write async functions** for Tauri commands
- **Handle errors properly**: Use `Result<T, String>` for commands
- **Document public APIs**: Use doc comments (`///`)
- **Keep commands simple**: Business logic should be in separate functions

### Git Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(chat): add streaming message support

Implement real-time message streaming using SSE events from OpenCode server.
This improves the user experience by showing responses as they're generated.

Closes #123
```

```
fix(permissions): correct SDK method name for permission responses

The OpenCode SDK uses postSessionIdPermissionsPermissionId instead of
respondToPermission. Updated the hook to use the correct method.
```

## Project Structure

```
workmate/
├── src/                      # Frontend source
│   ├── components/          # React components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility functions
│   ├── stores/             # Zustand state stores
│   └── types/              # TypeScript type definitions
├── src-tauri/               # Tauri backend
│   └── src/                # Rust source files
├── .github/                 # GitHub templates and workflows
└── public/                  # Static assets
```

## Testing

### Frontend Testing
```bash
# Type checking
bunx tsc --noEmit

# Run tests (when implemented)
bun test
```

### Backend Testing
```bash
cd src-tauri

# Check compilation
cargo check

# Run tests
cargo test

# Check linting
cargo clippy
```

## Documentation

- **Update README.md** if you change functionality
- **Add JSDoc comments** for complex functions
- **Document Rust APIs** with doc comments (`///`)
- **Update CHANGELOG.md** for notable changes

## Release Process

Maintainers handle releases. The process:

1. Update version in `package.json` and `src-tauri/Cargo.toml`
2. Update CHANGELOG.md
3. Create a git tag: `git tag -a v0.2.0 -m "Release v0.2.0"`
4. Push tag: `git push origin v0.2.0`
5. GitHub Actions builds and creates the release

## Getting Help

- **Questions?** Open a [GitHub Discussion](https://github.com/yourusername/workmate/discussions)
- **Issues?** Check [existing issues](https://github.com/yourusername/workmate/issues) first
- **Chat?** Join our community (link TBD)

## Recognition

Contributors are recognized in:
- GitHub contributors page
- Release notes for significant contributions
- Special thanks in README for major features

Thank you for contributing to Workmate! 🎉
