const outputElement = document.getElementById("terminal-output");
const commandForm = document.getElementById("command-form");
const commandInput = document.getElementById("command");
const cursorElement = document.getElementById("cursor");
const terminalElement = document.getElementById("terminal");

const promptText = "C:\\Users\\visitor>";
const commandHistory = [];
let historyIndex = 0;
let currentCommand = "";

const themes = {
  default: {
    "--bg-color": "#000000",
    "--text-color": "#ffffff",
    "--muted-color": "#aaaaaa",
    "--link-color": "#aaaaaa",
    "--link-hover-color": "#ffffff",
    "--cursor-color": "#ffffff",
    "--prompt-color": "#ffffff",
  },
  matrix: {
    "--bg-color": "#000000",
    "--text-color": "#00ff00",
    "--muted-color": "#00aa00",
    "--link-color": "#00cc00",
    "--link-hover-color": "#66ff66",
    "--cursor-color": "#00ff00",
    "--prompt-color": "#00ff00",
  },
  amber: {
    "--bg-color": "#120d00",
    "--text-color": "#ffb000",
    "--muted-color": "#b97f00",
    "--link-color": "#ffc247",
    "--link-hover-color": "#ffe1a0",
    "--cursor-color": "#ffb000",
    "--prompt-color": "#ffb000",
  },
  light: {
    "--bg-color": "#f0f0f0",
    "--text-color": "#252525",
    "--muted-color": "#666666",
    "--link-color": "#0000cc",
    "--link-hover-color": "#000078",
    "--cursor-color": "#252525",
    "--prompt-color": "#252525",
  },
};

const commandDescriptions = {
  help: "Show available commands",
  about: "Read a short introduction",
  experience: "View engineering experience",
  work: "View selected professional work",
  projects: "List open-source projects",
  project: "Open a project (project open <name>)",
  research: "View published research",
  skills: "View languages and tools",
  open: "Open a link (open <name>)",
  resume: "Open my resume",
  contact: "Show contact links",
  github: "Open my GitHub profile",
  theme: "Change theme (theme --matrix)",
  clear: "Clear the terminal",
};

const availableCommands = Object.keys(commandDescriptions);

const externalLinks = {
  github: {
    label: "GitHub",
    url: "https://github.com/ljste",
  },
  linkedin: {
    label: "LinkedIn",
    url: "https://www.linkedin.com/in/lsteinm/",
  },
  resume: {
    label: "resume.pdf",
    url: "downloads/resume.pdf",
  },
  textmaddie: {
    label: "Text Maddie",
    url: "https://www.textmaddie.com/",
  },
  studiortf: {
    label: "Studio RTF",
    url: "https://studiortf.com/",
  },
};

const fallbackProjects = [
  {
    id: "stowaway",
    name: "stowaway",
    year: "2025",
    stack: "Rust",
    description: "Runs commands in a disposable HOME with deny-by-default macOS filesystem controls.",
    url: "https://github.com/ljste/stowaway",
  },
  {
    id: "gonuke",
    name: "gonuke",
    year: "2025",
    stack: "Go",
    description: "Finds and terminates matching processes with dry runs, signals, and confirmations.",
    url: "https://github.com/ljste/gonuke",
  },
  {
    id: "rustproxy",
    name: "rustproxy",
    year: "2025",
    stack: "Rust · Tokio",
    description: "Async TCP proxy with bidirectional hex dumps, file logging, and byte totals.",
    url: "https://github.com/ljste/rustproxy",
  },
  {
    id: "rocket-league-automation",
    name: "Rocket League Automation",
    year: "2024",
    stack: "Python",
    description: "Desktop automation experiment using pixel detection and simulated input.",
    url: "https://github.com/ljste/Rocket-League-Script",
    aliases: ["rocket-league", "rocketleague", "rl-automation"],
  },
];

let projects = [...fallbackProjects];

const appendLine = (text = "", className = "") => {
  const line = document.createElement("div");
  line.className = `output-line${className ? ` ${className}` : ""}`;
  line.textContent = text;
  outputElement.append(line);
  return line;
};

const appendLinkLine = (prefix, label, url, suffix = "") => {
  const line = appendLine();
  line.append(document.createTextNode(prefix));

  const link = document.createElement("a");
  link.className = "output-link";
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  line.append(link);

  if (suffix) line.append(document.createTextNode(suffix));
  return line;
};

const appendCommandLine = (command) => {
  const line = document.createElement("div");
  line.className = "command-line";

  const prompt = document.createElement("span");
  prompt.className = "prompt";
  prompt.textContent = promptText;

  line.append(prompt, document.createTextNode(command));
  outputElement.append(line);
};

const renderStartup = () => {
  outputElement.replaceChildren();
  appendLine("Microsoft Windows [Version 10.0.26100.3476]");
  appendLine("(c) Microsoft Corporation. All rights reserved.");
  appendLine();
  appendCommandLine("whoami");
  appendLine("Lucas Steinmetz — software engineer", "section-label");
  appendLine();
  appendLine("I build software across systems, security, product engineering, and applied AI.");
  appendLine("CS + Cybersecurity at Villanova University. Local AI enthusiast.");
  appendLine();
  appendLine("Type 'help' for commands.");
  appendLinkLine("GitHub:   ", "github.com/ljste", "https://github.com/ljste");
  appendLinkLine("LinkedIn: ", "linkedin.com/in/lsteinm", "https://www.linkedin.com/in/lsteinm/");
  appendLine();
};

const scrollToBottom = () => {
  requestAnimationFrame(() => {
    outputElement.scrollTop = outputElement.scrollHeight;
  });
};

const measureTextWidth = (text) => {
  const canvas = measureTextWidth.canvas || (measureTextWidth.canvas = document.createElement("canvas"));
  const context = canvas.getContext("2d");
  if (!context) return text.length * 8;
  context.font = window.getComputedStyle(commandInput).font;
  return Math.ceil(context.measureText(text).width) + 1;
};

const updateCursorPosition = () => {
  const caretIndex = commandInput.selectionStart ?? commandInput.value.length;
  const textBeforeCaret = commandInput.value.slice(0, caretIndex);
  cursorElement.style.left = `${measureTextWidth(textBeforeCaret)}px`;
};

const applyTheme = (name) => {
  const theme = themes[name];
  if (!theme) return false;
  Object.entries(theme).forEach(([property, value]) => {
    document.documentElement.style.setProperty(property, value);
  });
  return true;
};

const openExternal = (url, label) => {
  window.open(url, "_blank", "noopener,noreferrer");
  appendLine(`Opening ${label}...`);
};

const printHelp = () => {
  appendLine();
  appendLine("AVAILABLE COMMANDS", "section-label");
  appendLine("==================");
  availableCommands.forEach((command) => {
    appendLine(`  ${command.padEnd(12)} ${commandDescriptions[command]}`);
  });
  appendLine();
};

const printAbout = () => {
  appendLine();
  appendLine("ABOUT", "section-label");
  appendLine("=====");
  appendLine("I'm Lucas Steinmetz, a software engineer and Computer Science student with a");
  appendLine("Cybersecurity minor at Villanova University (B.S. expected May 2027).");
  appendLine();
  appendLine("My work spans aerospace, institutional software, systems programming, cloud");
  appendLine("security, web products, and applied AI. I'm also a local AI enthusiast who");
  appendLine("enjoys running models and experimenting with useful on-device workflows.");
  appendLine();
};

const printExperience = () => {
  appendLine();
  appendLine("ENGINEERING EXPERIENCE", "section-label");
  appendLine("======================");
  appendLine("Lockheed Martin Space");
  appendLine("  Software Engineering Intern");
  appendLine("  Software engineering within Lockheed Martin's Space business.", "muted-line");
  appendLine();
  appendLine("Dicastery for Communication · Vatican City                 Aug–Dec 2025");
  appendLine("  Software Engineering Intern");
  appendLine("  Software engineering for the Vatican's communications organization.", "muted-line");
  appendLine();
  appendLine("The Cigna Group                                                2025");
  appendLine("  DevSecOps Engineer Intern");
  appendLine("  Worked with Azure RBAC, Active Directory, Terraform, and cloud hardening.", "muted-line");
  appendLine();
  appendLine("Studio RTF");
  appendLine("  Artisan");
  appendLine("  Engineering across agents, apps, systems, and interfaces.", "muted-line");
  appendLine();
  appendLine("Type 'work' for selected product work or 'resume' for the full history.");
  appendLine();
};

const printWork = () => {
  appendLine();
  appendLine("SELECTED PROFESSIONAL WORK", "section-label");
  appendLine("==========================");
  appendLine("Text Maddie");
  appendLine("  Product engineering for an AI agent that reaches leads and customers through");
  appendLine("  iMessage, handles follow-up, and books directly into calendars.");
  appendLinkLine("  Website: ", "textmaddie.com", externalLinks.textmaddie.url);
  appendLine();
  appendLine("Studio RTF");
  appendLine("  Building tailored agents, apps, systems, and interfaces for client workflows.");
  appendLine("  The client portfolio books more than $4M in revenue each month.");
  appendLinkLine("  Website: ", "studiortf.com", externalLinks.studiortf.url);
  appendLine();
};

const printProjects = () => {
  appendLine();
  appendLine("OPEN-SOURCE PROJECTS", "section-label");
  appendLine("====================");

  projects.forEach((project) => {
    appendLinkLine("  ", project.name, project.url, `  [${project.year} · ${project.stack}]`);
    appendLine(`    ${project.description}`);
  });

  appendLine();
  appendLine("Open one with 'project open <name>' or browse everything with 'github'.");
  appendLine();
};

const findProject = (query) => {
  const normalized = query.toLowerCase();
  return projects.find((project) => (
    project.id === normalized
    || project.name.toLowerCase() === normalized
    || project.aliases?.includes(normalized)
  ));
};

const handleProject = (args) => {
  if (args[0]?.toLowerCase() !== "open" || !args.slice(1).length) {
    appendLine();
    appendLine("Usage: project open <name>");
    appendLine("Example: project open stowaway");
    appendLine();
    return;
  }

  const project = findProject(args.slice(1).join("-"));
  appendLine();
  if (!project) {
    appendLine(`Project '${args.slice(1).join(" ")}' was not found.`);
    appendLine("Type 'projects' to list project names.");
  } else {
    openExternal(project.url, project.name);
  }
  appendLine();
};

const printResearch = () => {
  appendLine();
  appendLine("RESEARCH", "section-label");
  appendLine("========");
  appendLine("Predicting Mortality and Functional Status Scores of Traumatic Brain Injury");
  appendLine("Patients using Supervised Machine Learning");
  appendLine("  Published by IEEE · Presented at IEEE CCWC 2025");
  appendLine("  Evaluated 18 supervised-learning models on a clinical dataset of 300");
  appendLine("  pediatric TBI patients to predict mortality and functional outcomes.");
  appendLine();
};

const printSkills = () => {
  appendLine();
  appendLine("SKILLS", "section-label");
  appendLine("======");
  appendLine("  Languages      Python · Java · Go · Rust · TypeScript · JavaScript · SQL · C# · C++");
  appendLine("  Product        React · Node.js · FastAPI · Flask · Django");
  appendLine("  Cloud/Security AWS · Azure · GCP · Docker · Terraform · CI/CD · IAM");
  appendLine("  Data           PostgreSQL · SQLite · Pandas · scikit-learn · Tableau");
  appendLine("  AI             Agents · RAG · local models · vector databases · AI safety");
  appendLine();
};

const printContact = () => {
  appendLine();
  appendLine("CONTACT", "section-label");
  appendLine("=======");
  appendLinkLine("  Email:    ", "lsteinme@villanova.edu", "mailto:lsteinme@villanova.edu");
  appendLinkLine("  GitHub:   ", "github.com/ljste", "https://github.com/ljste");
  appendLinkLine("  LinkedIn: ", "linkedin.com/in/lsteinm", "https://www.linkedin.com/in/lsteinm/");
  appendLine();
};

const handleTheme = (args) => {
  const requested = args[0]?.replace(/^--/, "").toLowerCase();
  if (!requested) {
    appendLine();
    appendLine(`Themes: ${Object.keys(themes).map((name) => `--${name}`).join(", ")}`);
    appendLine("Usage: theme --matrix");
    appendLine();
    return;
  }

  appendLine();
  appendLine(applyTheme(requested)
    ? `Theme set to '${requested}'.`
    : `Theme '${requested}' was not found. Type 'theme' to list options.`);
  appendLine();
};

const handleOpen = (args) => {
  const target = args[0]?.toLowerCase();
  appendLine();

  if (!target) {
    appendLine(`Open targets: ${Object.keys(externalLinks).join(", ")}`);
    appendLine("Usage: open textmaddie");
  } else if (!externalLinks[target]) {
    appendLine(`Open target '${target}' was not found.`);
    appendLine(`Available targets: ${Object.keys(externalLinks).join(", ")}`);
  } else {
    openExternal(externalLinks[target].url, externalLinks[target].label);
  }

  appendLine();
};

const loadProjects = async () => {
  try {
    const response = await fetch("data/projects.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`Project data returned ${response.status}`);
    const projectData = await response.json();
    if (!Array.isArray(projectData) || projectData.length === 0) {
      throw new Error("Project data was empty");
    }
    projects = projectData;
  } catch (error) {
    console.warn("Using embedded project data:", error);
  }
};

const processCommand = (rawCommand) => {
  const command = rawCommand.trim();
  appendCommandLine(command);

  const [commandName = "", ...args] = command.split(/\s+/);

  switch (commandName.toLowerCase()) {
    case "":
      break;
    case "help":
      printHelp();
      break;
    case "about":
      printAbout();
      break;
    case "experience":
      printExperience();
      break;
    case "work":
      printWork();
      break;
    case "projects":
      printProjects();
      break;
    case "project":
      handleProject(args);
      break;
    case "research":
      printResearch();
      break;
    case "skills":
      printSkills();
      break;
    case "open":
      handleOpen(args);
      break;
    case "contact":
      printContact();
      break;
    case "resume":
      appendLine();
      openExternal("downloads/resume.pdf", "resume.pdf");
      appendLine();
      break;
    case "github":
      appendLine();
      openExternal("https://github.com/ljste", "GitHub");
      appendLine();
      break;
    case "theme":
      handleTheme(args);
      break;
    case "clear":
      renderStartup();
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

const completeCommand = () => {
  const value = commandInput.value;
  const normalized = value.toLowerCase().trimStart();
  if (!normalized || normalized.includes(" ")) return;

  const matches = availableCommands.filter((command) => command.startsWith(normalized));
  if (matches.length === 1) {
    commandInput.value = matches[0];
    commandInput.setSelectionRange(matches[0].length, matches[0].length);
  }
};

commandForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const command = commandInput.value;
  processCommand(command);

  if (command.trim() && commandHistory.at(-1) !== command.trim()) {
    commandHistory.push(command.trim());
  }

  historyIndex = commandHistory.length;
  currentCommand = "";
  commandInput.value = "";
  updateCursorPosition();
});

commandInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (historyIndex === commandHistory.length) currentCommand = commandInput.value;
    if (historyIndex > 0) historyIndex -= 1;
    commandInput.value = commandHistory[historyIndex] ?? "";
    commandInput.setSelectionRange(commandInput.value.length, commandInput.value.length);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    if (historyIndex < commandHistory.length) historyIndex += 1;
    commandInput.value = historyIndex === commandHistory.length
      ? currentCommand
      : (commandHistory[historyIndex] ?? "");
    commandInput.setSelectionRange(commandInput.value.length, commandInput.value.length);
  } else if (event.key === "Tab") {
    event.preventDefault();
    completeCommand();
  }

  updateCursorPosition();
});

commandInput.addEventListener("input", updateCursorPosition);
commandInput.addEventListener("click", updateCursorPosition);
commandInput.addEventListener("keyup", updateCursorPosition);
window.addEventListener("resize", updateCursorPosition);

terminalElement.addEventListener("click", (event) => {
  if (!event.target.closest("a, button, input")) commandInput.focus();
});

renderStartup();
applyTheme("default");
loadProjects();
historyIndex = commandHistory.length;
updateCursorPosition();
