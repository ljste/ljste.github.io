const outputElement = document.getElementById("terminal-output");
const commandInput = document.getElementById("command");
const cursorElement = document.getElementById("cursor");
const terminalElement = document.querySelector('.terminal');
const promptText = "C:\\Users\\visitor>";
const startupBanner = `Microsoft Windows [Version 10.0.26100.3476]
(c) Microsoft Corporation. All rights reserved.

Welcome to lucas's portfolio.
Type 'help' for commands.`;

const themes = {
    'default': {
        '--bg-color': '#000000',
        '--text-color': '#FFFFFF',
        '--link-color': '#AAAAAA',
        '--link-hover-color': '#FFFFFF',
        '--cursor-color': '#FFFFFF',
        '--prompt-color': '#FFFFFF'
    },
    'retro': {
        '--bg-color': '#1a1a1a',
        '--text-color': '#ffb000',
        '--link-color': '#33ff33',
        '--link-hover-color': '#77ff77',
        '--cursor-color': '#ffb000',
        '--prompt-color': '#ffb000'
    },
    'matrix': {
        '--bg-color': '#000000',
        '--text-color': '#00FF00',
        '--link-color': '#00AA00',
        '--link-hover-color': '#33FF33',
        '--cursor-color': '#00FF00',
        '--prompt-color': '#00FF00'
    },
    'light': {
        '--bg-color': '#F0F0F0',
        '--text-color': '#333333',
        '--link-color': '#0000FF',
        '--link-hover-color': '#0000AA',
        '--cursor-color': '#333333',
        '--prompt-color': '#333333'
    },
     'nord': {
        '--bg-color': '#2E3440',
        '--text-color': '#D8DEE9',
        '--link-color': '#88C0D0',
        '--link-hover-color': '#EBCB8B',
        '--cursor-color': '#D8DEE9',
        '--prompt-color': '#A3BE8C'
    }
};

const projectsData = {
  'rustproxy': {
    name: 'rustproxy',
    url: 'https://github.com/ljste/rustproxy',
    shortDesc: 'Lightweight configurable async TCP proxy (Rust).'
  },
  'stowaway': {
    name: 'stowaway',
    url: 'https://github.com/ljste/stowaway',
    shortDesc: 'CLI wrapper for syscall/network sandboxing (Rust).'
  },
  'gonuke': {
    name: 'gonuke',
    url: 'https://github.com/ljste/gonuke',
    shortDesc: 'CLI process nuker based on regex matching (Go).'
  },
  '3d-portfolio': {
    name: '3d-portfolio',
    url: 'https://ljste.github.io/3d-portfolio/',
    shortDesc: 'Try to hack into my laptop (three.js).'
  }
};

const availableCommands = ['help', 'clear', 'resume', 'contact', 'projects', 'about', 'theme'];
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
    const caretPositionIndex = commandInput.selectionStart ?? commandInput.value.length;
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

const applyTheme = (themeName) => {
    const themeSettings = themes[themeName];
    if (!themeSettings) return false;

    const root = document.documentElement;
    Object.keys(themeSettings).forEach(key => {
        root.style.setProperty(key, themeSettings[key]);
    });
    console.log(`Applied theme: ${themeName}`);
    return true;
};

const handleThemeCommand = (args) => {
    const themeArg = args[0]?.toLowerCase();

    if (!themeArg) {
        appendLine();
        appendLine("Available themes:");
        Object.keys(themes).forEach(tName => {
            appendLine(`  --${tName}`);
        });
        appendLine("\nUsage: theme --<themename>");
        appendLine();
        return;
    }

    if (!themeArg.startsWith('--')) {
        appendLine(`\nInvalid theme format. Use '--<themename>', e.g., 'theme --retro'.\n`);
        return;
    }

    const themeName = themeArg.substring(2);

    if (applyTheme(themeName)) {
        appendLine(`\nTheme set to '${themeName}'.\n`);
    } else {
        appendLine(`\nError: Theme '--${themeName}' not found. Type 'theme' to list available themes.\n`);
    }
};

const handleProjectsCommand = (args) => {
    if (args.length > 0) {
         appendLine("\nUsage: 'projects' lists all projects.");
         appendLine("To open a specific project, use: 'project open <projectname>'.\n");
         return;
    }
    appendLine();
    appendLine("My Projects:");
    Object.values(projectsData).forEach(proj => {
        appendLine(`  * ${proj.name.padEnd(15)} - ${proj.shortDesc}`);
    });
    appendLine("\nType 'project open <projectname>' to open a project link in a new tab.");
    appendLine();
};

const handleProjectCommand = (args) => {
    if (args.length < 2 || args[0].toLowerCase() !== 'open') {
        appendLine("\nUsage: project open <projectname>");
        appendLine("Example: project open rustproxy");
        appendLine("Type 'projects' to see the list of available project names.\n");
        return;
    }

    const projectName = args[1].toLowerCase();
    const project = projectsData[projectName];

    if (project && project.url) {
        appendLine(`\nOpening '${projectName}' in a new tab...`);
        window.open(project.url, '_blank');
        appendLine();
    } else {
        appendLine(`\nError: Project '${projectName}' not found or has no URL.`);
        appendLine("Type 'projects' to see the list of available project names.\n");
    }
};

const processCommand = (cmd) => {
    appendCommandLine(cmd);

    const parts = cmd.trim().split(' ');
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (commandName) {
        case "clear":
            outputElement.innerHTML = "";
            appendLine(startupBanner);
            break;

        case "help":
            appendLine();
            appendLine("Available commands:");
            availableCommands.forEach(c => {
                let description = "";
                switch(c) {
                    case 'help': description = "Show available commands"; break;
                    case 'clear': description = "Clear the terminal screen"; break;
                    case 'resume': description = "View my resume"; break;
                    case 'contact': description = "Show contact information"; break;
                    case 'projects': description = "List summary of notable projects"; break;
                    case 'project': description = "Open a specific project (e.g., project open rustproxy)"; break;
                    case 'about': description = "Show information about me"; break;
                    case 'theme': description = "Change terminal theme (e.g., theme --retro)"; break;
                    default: description = "No description available.";
                }
                appendLine(`  ${c.padEnd(10)} - ${description}`);
            });
            appendLine();
            break;

        case "resume":
            appendLine();
            const resumeUrl = "downloads/resume.pdf";
            window.open(resumeUrl, "_blank", "noopener,noreferrer");
            appendLine(`  Opening resume.pdf in a new tab...`);
            appendLine();
            break;

        case "contact":
            appendLine();
            appendHTMLLine('  Email: <a href="mailto:lsteinme@villanova.edu" class="output-link" target="_blank">lsteinme@villanova.edu</a>');
            appendHTMLLine('  LinkedIn: <a href="https://www.linkedin.com/in/lsteinm/" class="output-link" target="_blank">linkedin.com/in/lsteinm</a>');
            appendHTMLLine('  GitHub: <a href="https://github.com/ljste" class="output-link" target="_blank">github.com/ljste</a>');
            appendLine();
            break;

        case "projects":
            handleProjectsCommand(args);
            break;

        case "project":
            handleProjectCommand(args);
            break;

        case "about":
            appendLine();
            appendLine("╔════════════════════════════════════════════╗");
            appendLine("║                  About Me                  ║");
            appendLine("╠════════════════════════════════════════════╣");
            appendLine("║ CS + Cybersecurity @ Villanova             ║");
            appendLine("║ Tech explorer & builder                    ║");
            appendLine("║ Builds PCs, reverse engineers games        ║");
            appendLine("║ Creates CLI tools & automation scripts     ║");
            appendLine("║ Enjoys golf, squash, learning new tech     ║");
            appendLine("║ Currently exploring: AI, Rust, Wasm        ║");
            appendLine("║ Type 'projects' or 'contact' for more      ║");
            appendLine("╚════════════════════════════════════════════╝");
            appendLine();
            break;

        case "theme":
            handleThemeCommand(args);
            break;

        case "":
            break;

        default:
            appendLine();
            appendLine(`'${commandName}' is not recognized as an internal or external command,`);
            appendLine("operable program or batch file.");
            appendLine("Type 'help' for a list of available commands.");
            appendLine();
    }
    scrollToBottom();
};

const initTerminal = () => {
    if (!outputElement || !commandInput) {
        console.error("Terminal initialization failed: Required DOM elements not found.");
        return;
    }
    outputElement.innerHTML = "";
    appendLine(startupBanner);
    applyTheme('default');
    historyIndex = commandHistory.length;
    currentCommand = '';
    commandInput.value = "";
    updateCursorPosition();
    commandInput.focus();
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
    }
    else if (e.key === "ArrowDown") {
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

        const commandParts = currentInput.trim().split(" ");
        const isCompletingCommand = commandParts.length <= 1 && !currentInput.endsWith(" ");
        const isCompletingProjectOpen = commandParts.length === 2 && commandParts[0].toLowerCase() === "project" && commandParts[1].toLowerCase() === "open";
        const isCompletingTheme = commandParts.length === 1 && commandParts[0].toLowerCase() === "theme";


        if (isCompletingCommand || (currentInput.endsWith(" ") && (isCompletingTheme || isCompletingProjectOpen))) {
            const currentPartial = isCompletingCommand ? commandParts[0].toLowerCase() : "";
             const commandsToSuggest = availableCommands;

            let matches = commandsToSuggest.filter(cmd => cmd.startsWith(currentPartial));

             if (matches.length === 1) {
                 commandInput.value = matches[0] + (matches[0] === 'theme' || matches[0] === 'project' ? ' ' : '');
                  commandInput.setSelectionRange(commandInput.value.length, commandInput.value.length);
             } else if (matches.length > 1 ) {
                  let commonPrefix = matches[0];
                  for (let i = 1; i < matches.length; i++) {
                      while (!matches[i].startsWith(commonPrefix)) {
                          if (commonPrefix.length === 0) break;
                          commonPrefix = commonPrefix.substring(0, commonPrefix.length - 1);
                      }
                  }
                  if (commonPrefix.length > currentPartial.length) {
                      commandInput.value = commonPrefix;
                      commandInput.setSelectionRange(commandInput.value.length, commandInput.value.length);
                  }
             }
        } else if (commandParts.length >= 2 && commandParts[0].toLowerCase() === "theme") {
             const partialTheme = commandParts[1].toLowerCase().startsWith('--') ? commandParts[1].toLowerCase() : '--' + commandParts[1].toLowerCase();
             const themeNames = Object.keys(themes).map(t => `--${t}`);
             let matches = themeNames.filter(name => name.startsWith(partialTheme));

             if (matches.length === 1) {
                 commandInput.value = `theme ${matches[0]}`;
                 commandInput.setSelectionRange(commandInput.value.length, commandInput.value.length);
             } else if (matches.length > 1) {
                  let commonPrefix = matches[0];
                  for (let i = 1; i < matches.length; i++) {
                        while (!matches[i].startsWith(commonPrefix)) {
                             if (commonPrefix.length <= 2) { commonPrefix = '--'; break; }
                             commonPrefix = commonPrefix.substring(0, commonPrefix.length - 1);
                        }
                  }
                   if (commonPrefix.length > partialTheme.length) {
                        commandInput.value = `theme ${commonPrefix}`;
                        commandInput.setSelectionRange(commandInput.value.length, commandInput.value.length);
                   } else if (commonPrefix === '--' && partialTheme === '--') {
                          commandInput.value = `theme --`;
                          commandInput.setSelectionRange(commandInput.value.length, commandInput.value.length);
                   }
             }
        }
         else if (commandParts.length >= 3 && commandParts[0].toLowerCase() === "project" && commandParts[1].toLowerCase() === "open") {
             const partialProjectName = commandParts[2].toLowerCase();
             const projectNames = Object.keys(projectsData);
             let matches = projectNames.filter(name => name.startsWith(partialProjectName));

             if (matches.length === 1) {
                 commandInput.value = `project open ${matches[0]}`;
                 commandInput.setSelectionRange(commandInput.value.length, commandInput.value.length);
             } else if (matches.length > 1) {
                  let commonPrefix = matches[0];
                  for (let i = 1; i < matches.length; i++) {
                        while (!matches[i].startsWith(commonPrefix)) {
                             if (commonPrefix.length === 0) break;
                             commonPrefix = commonPrefix.substring(0, commonPrefix.length - 1);
                        }
                  }
                   if (commonPrefix.length > partialProjectName.length) {
                        commandInput.value = `project open ${commonPrefix}`;
                        commandInput.setSelectionRange(commandInput.value.length, commandInput.value.length);
                   }
             }
        }

    }
    else {
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
         historyIndex = commandHistory.length;
      }
    }
     updateCursorPosition();
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