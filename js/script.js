const outputElement = document.getElementById('terminal-output');
const commandInput = document.getElementById('command');
const promptText = "C:\\Users\\visitor>";
const startupBanner = `Microsoft Windows [Version 10.0.26100.3476]
(c) Microsoft Corporation. All rights reserved.

Welcome to lucas's portfolio.
Type 'help' for commands.`;

function initTerminal() {
  outputElement.innerHTML = "";
  appendLine(startupBanner);
}

function appendLine(text = "") {
  const lineElement = document.createElement("div");
  lineElement.innerText = text;
  outputElement.appendChild(lineElement);
}

function appendHTMLLine(html = "") {
  const lineElement = document.createElement("div");
  lineElement.innerHTML = html;
  outputElement.appendChild(lineElement);
}

function appendCommandLine(cmd) {
  const lineElement = document.createElement("div");
  const promptSpan = document.createElement("span");
  promptSpan.classList.add("prompt");
  promptSpan.innerText = promptText;
  const commandSpan = document.createElement("span");
  commandSpan.innerText = cmd;
  lineElement.appendChild(promptSpan);
  lineElement.appendChild(commandSpan);
  outputElement.appendChild(lineElement);
}

function processCommand(cmd) {
  switch (cmd.toLowerCase()) {
    case "clear":
      initTerminal();
      break;
    case "help":
      appendLine("help  - Show available commands");
      appendLine("clear - Reset the terminal to its startup view");
      appendLine("resume - Downloads resume");
      appendLine("contact - Returns contact information");
      appendLine("projects - Lists projects");
      break;
    case "resume":
      appendHTMLLine('Download my resume: <a href="downloads/resume.pdf" download>resume.pdf</a>');
      break;
    case "contact":
      appendHTMLLine('Email: <a href="mailto:lsteinme@villanova.edu" target="_blank">lsteinme@villanova.edu</a>');
      appendHTMLLine('LinkedIn: <a href="https://www.linkedin.com/in/lsteinm/" target="_blank">linkedin.com/in/lsteinm</a>');
      break;
    case "projects":
      appendHTMLLine('<a href="https://github.com/ljste/rustproxy" target="_blank">rustproxy</a>: A lightweight configurable async TCP proxy written in Rust.');
      appendHTMLLine('<a href="https://github.com/ljste/stowaway" target="_blank">stowaway</a>: Rust CLI wrapper that limits syscalls and tightens network rules when running a subprocess.');
      appendHTMLLine('<a href="https://github.com/ljste/gonuke" target="_blank">gonuke</a>: CLI nuker to search for and force-kill processes matching a regex.');
      break;
    default:
      if (cmd) {
        appendLine(`'${cmd}' is not recognized as an internal or external command,`);
        appendLine("operable program or batch file.");
        appendLine("");
      }
  }
}

initTerminal();

commandInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    const cmd = commandInput.value;
    appendCommandLine(cmd);
    processCommand(cmd.trim());
    commandInput.value = "";
    outputElement.scrollTop = outputElement.scrollHeight;
  }
});
