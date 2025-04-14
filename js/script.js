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
