# devman

A small terminal-based CLI for managing local development servers.

`devman` scans active listening processes and highlights common developer services (Node, Python, Ruby, Java, etc.). It provides a compact interactive view with process name, port, memory, CPU, uptime, and an easy keybinding for killing a selected process.

## Features

- Scans for local development server processes
- Filters out system/background processes
- Displays interactive list with port, PID, CPU, memory, and uptime
- Navigate with arrow keys
- Kill selected process with `k`
- Refresh view with `r`
- Quit with `q`

## Install

From the project root:

```bash
npm install
```

## Run

```bash
npm start
```

Or run the installed binary directly if the package is linked globally:

```bash
devman
```

Or add an alias to your shell config (`~/.zshrc` / `~/.bashrc`) to run it directly from anywhere:

```bash
alias devman='node APP_PATH/devman/devman.js'
```

Then reload your shell:

```bash
source ~/.zshrc
```

## Platform support

Designed for macOS and Linux. Uses platform-specific commands to inspect processes and listening ports.

## Notes

- The CLI requires a TTY terminal.
- Killing processes may require elevated permissions for some PIDs.
- The package has no runtime dependencies.
