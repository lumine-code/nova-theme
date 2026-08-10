const path = require("path");

describe("nova-theme", () => {
  afterEach(async () => {
    await lumine.packages.deactivatePackage("nova-day-ui");
    await lumine.packages.deactivatePackage("nova-day-syntax");
    await lumine.packages.deactivatePackage("nova-theme");
  });

  it("registers its light and dark themes as a pack", async () => {
    await lumine.packages.activatePackage("nova-theme");

    const themePack = lumine.themes.getThemePacks().find(({ name }) => name === "Nova");

    expect(themePack.light).toEqual(["nova-day-ui", "nova-day-syntax"]);
    expect(themePack.dark).toEqual(["nova-night-ui", "nova-night-syntax"]);
  });

  it("inherits unchanged One styles and keeps its own overrides", async () => {
    await lumine.packages.activatePackage("nova-theme");

    const uiPaths = lumine.packages.getLoadedPackage("nova-day-ui").getStylesheetPaths();
    const syntaxPaths = lumine.packages.getLoadedPackage("nova-day-syntax").getStylesheetPaths();
    const uiPathByName = new Map(uiPaths.map((stylePath) => [path.basename(stylePath), stylePath]));
    const syntaxPathByName = new Map(
      syntaxPaths.map((stylePath) => [path.basename(stylePath), stylePath]),
    );

    expect(uiPathByName.get("02-badges.css")).toContain("one-theme");
    expect(uiPathByName.get("03-buttons.css")).toContain("one-theme");
    expect(uiPathByName.get("overrides.css")).toContain("nova-theme");
    expect(uiPathByName.has("config.css")).toBe(false);
    expect(syntaxPathByName.get("04-base.css")).toContain("one-theme");
    expect(syntaxPathByName.get("variables.css")).toContain("nova-theme");
    expect(syntaxPathByName.get("overrides.css")).toContain("nova-theme");

    expect(uiPaths.indexOf(uiPathByName.get("03-buttons.css"))).toBeLessThan(
      uiPaths.indexOf(uiPathByName.get("overrides.css")),
    );
    expect(syntaxPaths.indexOf(syntaxPathByName.get("04-base.css"))).toBeLessThan(
      syntaxPaths.indexOf(syntaxPathByName.get("overrides.css")),
    );

    await lumine.packages.activatePackage("nova-day-ui");
    await lumine.packages.activatePackage("nova-day-syntax");
    expect(lumine.themes.stylesheetElementForId(uiPathByName.get("03-buttons.css"))).not.toBeNull();
    expect(lumine.themes.stylesheetElementForId(uiPathByName.get("overrides.css"))).not.toBeNull();
  });

  it("renders Search Panel as a rounded bottom card", async () => {
    await lumine.packages.activatePackage("nova-theme");
    await lumine.packages.activatePackage("nova-day-ui");

    const panel = document.createElement("lumine-panel");
    panel.className = "bottom tool-panel panel-bottom";
    const searchPanel = document.createElement("div");
    searchPanel.className = "search-panel search-panel-project";
    panel.appendChild(searchPanel);
    jasmine.attachToDOM(panel);

    const style = getComputedStyle(panel);
    expect(style.marginRight).toBe("6px");
    expect(style.marginBottom).toBe("6px");
    expect(style.marginLeft).toBe("6px");
    expect(style.borderRadius).toBe("9px");
    expect(style.overflow).toBe("hidden");
  });
});
