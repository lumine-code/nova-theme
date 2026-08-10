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

  // These backgrounds are translucent, so they must land on the tile and
  // nothing else. Keyed on `.inline-block` they also caught the layout blocks a
  // tile nests inside itself, and the two layers composited into a second,
  // darker rectangle inset by the tile's padding.
  it("treats only the stamped tile as a status-bar tile", async () => {
    await lumine.packages.activatePackage("nova-theme");
    await lumine.packages.activatePackage("nova-day-ui");

    const statusBar = document.createElement("div");
    statusBar.className = "status-bar";
    const panel = document.createElement("div");
    panel.className = "status-bar-left";
    const tile = document.createElement("div");
    tile.className = "status-bar-item";
    const nested = document.createElement("a");
    nested.className = "inline-block";
    tile.appendChild(nested);
    panel.appendChild(tile);
    statusBar.appendChild(panel);
    jasmine.attachToDOM(statusBar);

    expect(getComputedStyle(tile).borderRadius).toBe("6px");
    expect(getComputedStyle(tile).marginTop).toBe("4px");
    expect(getComputedStyle(tile).marginBottom).toBe("4px");

    expect(getComputedStyle(nested).borderRadius).toBe("0px");
    expect(getComputedStyle(nested).marginTop).toBe("0px");
    expect(getComputedStyle(nested).marginBottom).toBe("0px");
  });

  // Both strips frame the window with the same pill, so the two insets are one
  // number and cannot drift apart.
  it("gives a title-bar control tile the same inset pill as a status-bar tile", async () => {
    await lumine.packages.activatePackage("nova-theme");
    await lumine.packages.activatePackage("nova-day-ui");

    const titleBar = document.createElement("div");
    titleBar.className = "title-bar";
    const controlTiles = document.createElement("div");
    controlTiles.className = "control-tiles";
    controlTiles.style.height = "32px";
    const tile = document.createElement("button");
    tile.className = "title-bar-item";
    controlTiles.appendChild(tile);
    titleBar.appendChild(controlTiles);
    jasmine.attachToDOM(titleBar);

    const style = getComputedStyle(tile);
    expect(style.height).toBe("24px");
    expect(style.marginTop).toBe("4px");
    expect(style.marginBottom).toBe("4px");
    expect(style.borderRadius).toBe("6px");
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
