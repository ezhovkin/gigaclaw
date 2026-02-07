# GigaClaw

Personal Claude assistant via Telegram. Runs agents in isolated containers. Small codebase (~3,000 lines), built to be understood and customized.

## Quick Start

```bash
git clone https://github.com/ezhovkin/gigaclaw.git
cd gigaclaw
claude
```

Then run `/setup`. Claude Code handles everything: dependencies, authentication, container setup, service configuration.

## Philosophy

**Small enough to understand.** One process, a handful of files. No microservices, no message queues, no abstraction layers.

**Secure by isolation.** Agents run in Linux containers (Apple Container on macOS, or Docker). They can only see what's explicitly mounted. Bash access is safe because commands run inside the container, not on your host.

**Built for one user.** This isn't a framework. It's working software for personal use. Fork it and make it yours.

**Customization = code changes.** No configuration sprawl. Want different behavior? Modify the code. The codebase is small enough that this is safe.

**AI-native.** No installation wizard; Claude Code guides setup. No monitoring dashboard; ask Claude what's happening. No debugging tools; describe the problem, Claude fixes it.

**Best harness, best model.** This runs on Claude Agent SDK, which means you're running Claude Code directly. The harness matters. A bad harness makes even smart models seem dumb, a good harness gives them superpowers.

## What It Supports

- **Telegram I/O** - Message Claude from your phone via [grammy](https://grammy.dev/)
- **Isolated group context** - Each group has its own `CLAUDE.md` memory, isolated filesystem, and runs in its own container sandbox
- **Main channel** - Your private chat for admin control; every other group is completely isolated
- **Scheduled tasks** - Recurring jobs (cron/interval/once) that run Claude and can message you back
- **Web access** - Search and fetch content
- **Container isolation** - Agents sandboxed in Apple Container (macOS) or Docker (macOS/Linux)
- **Graceful shutdown** - Proper SIGTERM/SIGINT handling for systemd deployments

## Usage

Talk to your assistant with the trigger word (default: `@Neo`):

```
@Neo send an overview of the sales pipeline every weekday morning at 9am
@Neo review the git history for the past week each Friday and update the README if there's drift
@Neo every Monday at 8am, compile news on AI developments and message me a briefing
```

From the main channel, you can manage groups and tasks:

```
@Neo list all scheduled tasks across groups
@Neo pause the Monday briefing task
@Neo join the Family Chat group
```

## Customizing

Just tell Claude Code what you want:

- "Change the trigger word to @Bob"
- "Make responses shorter and more direct"
- "Add a custom greeting when I say good morning"

Or run `/customize` for guided changes.

## Requirements

- macOS or Linux
- Node.js 20+
- [Claude Code](https://claude.ai/download)
- [Apple Container](https://github.com/apple/container) (macOS) or [Docker](https://docker.com/products/docker-desktop) (macOS/Linux)

## Architecture

```
Telegram (grammy) --> SQLite --> Container (Claude Agent SDK) --> Response
                                     |
                        IPC (filesystem JSON) --> Host process
```

Single Node.js process. Agents execute in isolated Linux containers with mounted directories. IPC via filesystem. No daemons, no queues, no complexity.

Key files:

- `src/index.ts` - Entry point, Telegram connection, graceful shutdown
- `src/message-router.ts` - Message routing, context assembly
- `src/container-runner.ts` - Spawns agent containers with volume mounts
- `src/task-scheduler.ts` - Runs scheduled tasks (cron/interval/once)
- `src/ipc-watcher.ts` - Processes IPC messages/tasks from containers
- `src/db.ts` - SQLite operations
- `src/mount-security.ts` - Mount allowlist validation
- `groups/*/CLAUDE.md` - Per-group memory

## FAQ

**Why Apple Container instead of Docker?**

On macOS, Apple Container is lightweight, fast, and optimized for Apple silicon. Docker is also fully supported. On Linux, Docker is used automatically.

**Is this secure?**

Agents run in containers, not behind application-level permission checks. They can only access explicitly mounted directories. The codebase is small enough to audit. See [docs/SECURITY.md](docs/SECURITY.md) for the full security model.

**How do I debug issues?**

Ask Claude Code. "Why isn't the scheduler running?" "What's in the recent logs?" "Why did this message not get a response?" Or run `/debug`.

## Acknowledgments

GigaClaw is inspired by and forked from [NanoClaw](https://github.com/gavrielc/nanoclaw) by [@gavrielc](https://github.com/gavrielc). The original project demonstrated that a personal Claude assistant can be small, secure, and fully understandable. GigaClaw builds on that foundation with Telegram integration and continued development.

## License

MIT
