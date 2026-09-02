const projectTable = document.getElementById("project-table");
const projectCount = document.getElementById("archive-count");
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const navLinks = [...document.querySelectorAll(".site-nav a[href^='#']")];

let projects = [];
let activeFilter = "all";

const createTextElement = (tag, className, value) => {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = value;
  return element;
};

const createProjectRow = (project) => {
  const link = document.createElement("a");
  link.className = "project-row";
  link.href = project.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.dataset.categories = project.categories.join(" ");
  link.setAttribute("aria-label", `Open ${project.name}`);

  link.append(
    createTextElement("span", "project-name", project.name),
    createTextElement("span", "project-year", project.year),
    createTextElement("span", "project-stack", project.stack),
    createTextElement("span", "project-description", project.description),
    createTextElement("span", "project-arrow", "↗"),
  );

  return link;
};

const projectHeader = () => {
  const header = document.createElement("div");
  header.className = "project-header";
  header.setAttribute("aria-hidden", "true");
  ["Project", "Year", "Stack", "What it does", ""].forEach((label) => {
    header.append(createTextElement("span", "", label));
  });
  return header;
};

const visibleProjects = () => projects.filter((project) => (
  activeFilter === "all" || project.categories.includes(activeFilter)
));

const renderProjects = () => {
  if (!projectTable || !projectCount) return;

  const visible = visibleProjects();
  projectTable.replaceChildren(projectHeader());

  if (visible.length === 0) {
    projectTable.append(createTextElement("p", "project-empty", "No projects in this category yet."));
  } else {
    const fragment = document.createDocumentFragment();
    visible.forEach((project) => fragment.append(createProjectRow(project)));
    projectTable.append(fragment);
  }

  projectCount.textContent = `${visible.length} ${visible.length === 1 ? "project" : "projects"}`;
};

const setFilter = (filter) => {
  activeFilter = filter;
  filterButtons.forEach((button) => {
    const isActive = button.dataset.filter === filter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  renderProjects();
};

const showProjectError = () => {
  if (!projectTable || !projectCount) return;
  projectTable.replaceChildren(projectHeader());
  projectTable.append(createTextElement(
    "p",
    "project-error",
    "The project archive could not be loaded. The GitHub link below has the complete public list.",
  ));
  projectCount.textContent = "Archive unavailable";
};

const loadProjects = async () => {
  if (!projectTable) return;

  try {
    const response = await fetch("data/projects.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`Project data returned ${response.status}`);

    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Project data is not a list");

    projects = data;
    renderProjects();
  } catch (error) {
    console.error("Unable to load project archive:", error);
    showProjectError();
  }
};

const trackCurrentSection = () => {
  if (!("IntersectionObserver" in window)) return;

  const linksBySection = new Map(navLinks.map((link) => [link.hash.slice(1), link]));
  const sections = [
    document.getElementById("top"),
    ...[...linksBySection.keys()].map((id) => document.getElementById(id)),
  ].filter(Boolean);

  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (!visible) return;
    const currentHash = visible.target.id === "top" ? null : `#${visible.target.id}`;
    navLinks.forEach((link) => {
      const isCurrent = link.hash === currentHash;
      link.classList.toggle("is-current", isCurrent);
      if (isCurrent) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }, {
    rootMargin: "-25% 0px -60%",
    threshold: [0, 0.2, 0.5],
  });

  sections.forEach((section) => observer.observe(section));
};

filterButtons.forEach((button) => {
  button.addEventListener("click", () => setFilter(button.dataset.filter));
});

loadProjects();
trackCurrentSection();
