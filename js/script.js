const outputElement = document.getElementById("terminal-output");
const commandInput = document.getElementById("command");
const cursorElement = document.getElementById("cursor");
const terminalElement = document.querySelector('.terminal');
const promptText = "C:\\Users\\visitor>";
const startupBanner = `Microsoft Windows [Version 10.0.26100.3476]
(c) Microsoft Corporation. All rights reserved.

Welcome to lucas's portfolio.
Type 'help' for commands.`;
const availableCommands = ['help', 'clear', 'resume', 'contact', 'projects', 'about'];
let commandHistory = [];
let historyIndex = 0;
let currentCommand = '';
const measureTextWidth = (text, element) => {
    const canvas = measureTextWidth.canvas || (measureTextWidth.canvas = document.createElement("canvas"));
    const context = canvas.getContext("2d");
    if (!context) {
        console.warn("Canvas context not available for text measurement.");
        return text.length * 8;
    }
    const font = window.getComputedStyle(element).font;
    context.font = font;
    const metrics = context.measureText(text);
    return Math.ceil(metrics.width) + 1;
};
const updateCursorPosition = () => {
    if (!cursorElement || !commandInput) return;
    const caretPositionIndex = commandInput.selectionStart;
    const textBeforeCaret = commandInput.value.substring(0, caretPositionIndex);
    const textWidth = measureTextWidth(textBeforeCaret, commandInput);
    requestAnimationFrame(() => {
        cursorElement.style.left = `${textWidth}px`;

        if (document.activeElement === commandInput) {
            cursorElement.style.visibility = 'visible';
        } else {
            cursorElement.style.visibility = 'hidden';
        }
    });
};
const scrollToBottom = () => {
    requestAnimationFrame(() => {
        if (outputElement) {
            outputElement.scrollTop = outputElement.scrollHeight;
        }
    });
};
const initTerminal = () => {
    if (!outputElement || !commandInput) {
        console.error("Terminal initialization failed: Required DOM elements not found.");
        return;
    }
    outputElement.innerHTML = "";
    appendLine(startupBanner);
    historyIndex = commandHistory.length;
    currentCommand = '';
    commandInput.value = "";
    updateCursorPosition();
    commandInput.focus();
    scrollToBottom();
};
const appendLine = (text = "") => {
    const lineElement = document.createElement("div");
    lineElement.textContent = text;
    outputElement.appendChild(lineElement);
};
const appendHTMLLine = (html = "") => {
    const lineElement = document.createElement("div");
    lineElement.innerHTML = html;
    outputElement.appendChild(lineElement);
};
const appendCommandLine = (cmd) => {
    const lineElement = document.createElement("div");
    const promptSpan = document.createElement("span");
    promptSpan.classList.add("prompt");
    promptSpan.textContent = promptText;
    const commandSpan = document.createElement("span");
    commandSpan.textContent = cmd;
    lineElement.appendChild(promptSpan);
    lineElement.appendChild(commandSpan);
    outputElement.appendChild(lineElement);
};
const processCommand = (cmd) => {
    appendCommandLine(cmd);
    switch (cmd.toLowerCase().trim()) {
        case "clear":
            outputElement.innerHTML = "";
            appendLine(startupBanner);
            break;
        case "help":
            appendLine();
            appendLine("Available commands:");
            appendLine("  help      - Show available commands");
            appendLine("  clear     - Clear the terminal screen");
            appendLine("  resume    - Download my resume");
            appendLine("  contact   - Show contact information");
            appendLine("  projects  - List my notable projects");
            appendLine("  about     - Show information about me");
            appendLine();
            break;
        case "resume":
            appendLine();
            appendHTMLLine('  Download my resume: <a href="downloads/resume.pdf" class="output-link" download>resume.pdf</a>');
            appendLine();
            break;
        case "contact":
            appendLine();
            appendHTMLLine('  Email: <a href="mailto:lsteinme@villanova.edu" class="output-link" target="_blank">lsteinme@villanova.edu</a>');
            appendHTMLLine('  LinkedIn: <a href="https://www.linkedin.com/in/lsteinm/" class="output-link" target="_blank">linkedin.com/in/lsteinm</a>');
            appendLine();
            break;
        case "projects":
            appendLine();
            appendLine("  My Projects:");
            appendHTMLLine('  * <a href="https://github.com/ljste/rustproxy" class="output-link" target="_blank">rustproxy</a>:    Lightweight configurable async TCP proxy (Rust).');
            appendHTMLLine('  * <a href="https://github.com/ljste/stowaway" class="output-link" target="_blank">stowaway</a>:     CLI wrapper for syscall/network sandboxing (Rust).');
            appendHTMLLine('  * <a href="https://github.com/ljste/gonuke" class="output-link" target="_blank">gonuke</a>:       CLI process nuker based on regex matching (Go).');
            appendHTMLLine('  * <a href="https://ljste.github.io/3d-portfolio/" class="output-link" target="_blank">3D Portfolio</a>: Try to hack into my laptop (three.js).' );
            appendLine();
            break;
        case "about":
            appendLine();
            appendLine("╔════════════════════════════════════════════╗");
            appendLine("║                  About Me                  ║");
            appendLine("╠════════════════════════════════════════════╣");
            appendLine("║ CS + Cybersecurity @ Villanova             ║");
            appendLine("║ Tech explorer                              ║");
            appendLine("║ Builds PCs, reverse engineers games        ║");
            appendLine("║ Creates personal tools for fun             ║");
            appendLine("║ Golf & squash enthusiast                   ║");
            appendLine("║ Building with AI, parsers, 3D UIs          ║");
            appendLine("║ Type 'projects' for more                   ║");
            appendLine("╚════════════════════════════════════════════╝");
            appendLine();
            break;
        case "":
            break;

        default:
            appendLine();
            appendLine(`'${cmd}' is not recognized as an internal or external command,`);
            appendLine("operable program or batch file.");
            appendLine();
    }
    scrollToBottom();
};
commandInput.addEventListener("keydown", (e) => {
    const currentInput = commandInput.value;
    if (e.key === "Enter") {
        e.preventDefault();
        const cmd = currentInput.trim();
        processCommand(cmd);
        if (cmd && (commandHistory.length === 0 || cmd !== commandHistory[commandHistory.length - 1])) {
            commandHistory.push(cmd);
        }
        historyIndex = commandHistory.length;
        currentCommand = '';
        commandInput.value = "";
    }
    else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (commandHistory.length > 0 && historyIndex > 0) {
            if (historyIndex === commandHistory.length) {
                currentCommand = currentInput;
            }
            historyIndex--;
            commandInput.value = commandHistory[historyIndex];
            commandInput.setSelectionRange(commandInput.value.length, commandInput.value.length);
        }
    } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex < commandHistory.length) {
            historyIndex++;
            if (historyIndex === commandHistory.length) {
                commandInput.value = currentCommand;
            } else {
                commandInput.value = commandHistory[historyIndex];
            }
            commandInput.setSelectionRange(commandInput.value.length, commandInput.value.length);
        }
    }
    else if (e.key === "Tab") {
        e.preventDefault();
        const partialCmd = currentInput.toLowerCase().trimStart();
        if (!partialCmd) return;
        const matches = availableCommands.filter(cmd => cmd.startsWith(partialCmd));
        if (matches.length === 1) {
            commandInput.value = matches[0];
            commandInput.setSelectionRange(commandInput.value.length, commandInput.value.length);
        } else if (matches.length > 1) {
            let commonPrefix = matches[0];
            for (let i = 1; i < matches.length; i++) {
                while (!matches[i].startsWith(commonPrefix)) {
                    if (commonPrefix.length === 0) break;
                    commonPrefix = commonPrefix.substring(0, commonPrefix.length - 1);
                }
            }
            if (commonPrefix.length > partialCmd.length) {
                commandInput.value = commonPrefix;
                commandInput.setSelectionRange(commandInput.value.length, commandInput.value.length);
            }
        }
    }
    else {
        if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
            historyIndex = commandHistory.length;
        }
    }
});
commandInput.addEventListener("input", () => {
    historyIndex = commandHistory.length;
    updateCursorPosition();
});
document.addEventListener('selectionchange', () => {
    if (document.activeElement === commandInput) {
        updateCursorPosition();
    }
});
commandInput.addEventListener("focus", () => {
    updateCursorPosition();
});
commandInput.addEventListener("blur", () => {
    requestAnimationFrame(() => {
        if (cursorElement) {
            cursorElement.style.visibility = 'hidden';
        }
    });
});
terminalElement.addEventListener('click', (event) => {
    const targetIsInteractive = event.target === commandInput || event.target.closest('a');
    if (!targetIsInteractive) {
        commandInput.focus();
    }
});
document.addEventListener('DOMContentLoaded', initTerminal);