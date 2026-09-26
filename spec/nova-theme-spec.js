const path = require("path");

function findSharedOneUiPath(uiPaths, legacyBasename) {
  return (
    uiPaths.find((stylePath) => path.basename(stylePath) === "main.css") ??
    uiPaths.find((stylePath) => path.basename(stylePath) === legacyBasename)
  );
}

function colorChannels(color) {
  let match = color.match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
  if (match) return match.slice(1, 4).map(Number);

  match = color.match(/^color\(srgb\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/);
  if (match) {
    return match.slice(1, 4).map((channel) => Math.min(255, Math.max(0, Number(channel) * 255)));
  }

  throw new Error(`Unsupported computed color: ${color}`);
}

function relativeLuminance(color) {
  const [red, green, blue] = colorChannels(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first, second) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function contrastRatioWithAlpha(foreground, background) {
  const foregroundMatch = foreground.match(
    /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/,
  );
  const backgroundChannels = colorChannels(background);
  if (!foregroundMatch) return contrastRatio(foreground, background);

  const foregroundChannels = foregroundMatch.slice(1, 4).map(Number);
  const alpha = foregroundMatch[4] == null ? 1 : Number(foregroundMatch[4]);
  const composited = foregroundChannels.map(
    (channel, index) => channel * alpha + backgroundChannels[index] * (1 - alpha),
  );
  const compositedColor = `rgb(${composited.join(", ")})`;
  return contrastRatio(compositedColor, background);
}

describe("nova-theme", () => {
  afterEach(async () => {
    await lumine.packages.deactivatePackage("nova-day-ui");
    await lumine.packages.deactivatePackage("nova-day-syntax");
    await lumine.packages.deactivatePackage("nova-night-ui");
    await lumine.packages.deactivatePackage("nova-night-syntax");
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
    // These fallbacks keep this repo's CI green until Lumine repins the
    // consolidated one-theme stylesheet.
    const oneUiBadgesPath = findSharedOneUiPath(uiPaths, "02-badges.css");
    const oneUiButtonsPath = findSharedOneUiPath(uiPaths, "03-buttons.css");

    expect(oneUiBadgesPath).toContain("one-theme");
    expect(oneUiButtonsPath).toContain("one-theme");
    expect(uiPathByName.get("overrides.css")).toContain("nova-theme");
    expect(uiPathByName.has("config.css")).toBe(false);
    expect(syntaxPathByName.get("04-base.css")).toContain("one-theme");
    expect(syntaxPathByName.get("variables.css")).toContain("nova-theme");
    expect(syntaxPathByName.get("overrides.css")).toContain("nova-theme");

    expect(uiPaths.indexOf(oneUiButtonsPath)).toBeLessThan(
      uiPaths.indexOf(uiPathByName.get("overrides.css")),
    );
    expect(syntaxPaths.indexOf(syntaxPathByName.get("04-base.css"))).toBeLessThan(
      syntaxPaths.indexOf(syntaxPathByName.get("overrides.css")),
    );

    await lumine.packages.activatePackage("nova-day-ui");
    await lumine.packages.activatePackage("nova-day-syntax");
    expect(lumine.themes.stylesheetElementForId(oneUiButtonsPath)).not.toBeNull();
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

  it("keeps selected and panel-heading buttons on their intended surfaces", async () => {
    await lumine.packages.activatePackage("nova-theme");
    await lumine.packages.activatePackage("nova-day-ui");

    const selected = document.createElement("button");
    selected.className = "btn selected";
    const heading = document.createElement("div");
    heading.className = "panel-heading";
    const headingDefault = document.createElement("button");
    headingDefault.className = "btn";
    const headingSelected = document.createElement("button");
    headingSelected.className = "btn selected";
    const headingPrimary = document.createElement("button");
    headingPrimary.className = "btn btn-primary";
    heading.append(headingDefault, headingSelected, headingPrimary);
    document.body.append(selected, heading);

    try {
      expect(getComputedStyle(selected).color).toBe("rgb(255, 255, 255)");
      expect(getComputedStyle(headingDefault).backgroundColor).toBe("rgb(255, 255, 255)");
      expect(getComputedStyle(headingSelected).backgroundColor).toBe("rgb(79, 88, 214)");
      expect(getComputedStyle(headingSelected).color).toBe("rgb(255, 255, 255)");
      expect(getComputedStyle(headingPrimary).backgroundColor).toBe("rgb(79, 88, 214)");
      expect(getComputedStyle(headingPrimary).color).toBe("rgb(255, 255, 255)");
    } finally {
      selected.remove();
      heading.remove();
    }
  });

  for (const mode of ["day", "night"]) {
    it(`keeps ${mode} semantic controls readable at rest and on hover`, async () => {
      await lumine.packages.activatePackage("nova-theme");
      await lumine.packages.activatePackage(`nova-${mode}-ui`);

      const fixture = document.createElement("div");
      document.body.appendChild(fixture);

      try {
        for (const kind of ["info", "success", "warning", "error"]) {
          const button = document.createElement("button");
          button.className = `btn btn-${kind}`;
          const badge = document.createElement("span");
          badge.className = `badge badge-${kind}`;
          const highlight = document.createElement("span");
          highlight.className = `highlight-${kind}`;
          const hoverProbe = document.createElement("span");
          hoverProbe.style.backgroundColor = `hsl(from var(--background-color-${kind}) h s calc(l + 4))`;
          const activeProbe = document.createElement("span");
          activeProbe.style.backgroundColor = "var(--btn-variant-active-background)";
          const selectedProbe = document.createElement("span");
          selectedProbe.style.backgroundColor = "var(--btn-variant-selected-background)";
          const selectedHoverProbe = document.createElement("span");
          selectedHoverProbe.style.backgroundColor = "var(--btn-variant-selected-hover-background)";
          button.append(activeProbe, selectedProbe, selectedHoverProbe);
          fixture.append(button, badge, highlight, hoverProbe);

          const buttonStyle = getComputedStyle(button);
          const badgeStyle = getComputedStyle(badge);
          const highlightStyle = getComputedStyle(highlight);
          const stateBackgrounds = [
            buttonStyle.backgroundColor,
            getComputedStyle(hoverProbe).backgroundColor,
            getComputedStyle(activeProbe).backgroundColor,
            getComputedStyle(selectedProbe).backgroundColor,
            getComputedStyle(selectedHoverProbe).backgroundColor,
          ];

          expect(badgeStyle.color).toBe(buttonStyle.color);
          expect(highlightStyle.color).toBe(buttonStyle.color);
          expect(
            contrastRatio(highlightStyle.color, highlightStyle.backgroundColor),
          ).toBeGreaterThanOrEqual(4.5);
          for (const background of stateBackgrounds) {
            expect(contrastRatio(buttonStyle.color, background)).toBeGreaterThanOrEqual(4.5);
          }
        }
      } finally {
        fixture.remove();
      }
    });
  }

  it("keeps every custom form control keyboard-visible", async () => {
    await lumine.packages.activatePackage("nova-theme");
    await lumine.packages.activatePackage("nova-day-ui");

    const controls = [
      ["checkbox", "input-checkbox"],
      ["radio", "input-radio"],
      ["checkbox", "input-toggle"],
      ["range", "input-range"],
    ].map(([type, className]) => {
      const control = document.createElement("input");
      control.type = type;
      control.className = className;
      document.body.appendChild(control);
      return control;
    });

    try {
      for (const control of controls) {
        control.focus();
        expect(document.activeElement).toBe(control);
        expect(getComputedStyle(control).boxShadow).not.toBe("none");
      }
    } finally {
      for (const control of controls) control.remove();
    }
  });

  it("gives native fields and editor fields the same rounded corners", async () => {
    await lumine.packages.activatePackage("nova-theme");
    await lumine.packages.activatePackage("nova-day-ui");

    const nativeField = document.createElement("input");
    nativeField.className = "input-text";
    const editorField = document.createElement("lumine-text-editor");
    editorField.setAttribute("mini", "");
    document.body.append(nativeField, editorField);

    try {
      expect(getComputedStyle(nativeField).borderRadius).toBe("9px");
      expect(getComputedStyle(editorField).borderRadius).toBe("9px");
    } finally {
      nativeField.remove();
      editorField.remove();
    }
  });

  it("uses Nova selection colors for generic navigation pills", async () => {
    await lumine.packages.activatePackage("nova-theme");
    await lumine.packages.activatePackage("nova-day-ui");

    const nav = document.createElement("ul");
    nav.className = "nav nav-pills";
    const item = document.createElement("li");
    item.className = "active";
    const link = document.createElement("a");
    item.appendChild(link);
    nav.appendChild(item);
    const tabs = document.createElement("ul");
    tabs.className = "nav nav-tabs";
    const tabItem = document.createElement("li");
    const tabLink = document.createElement("a");
    tabItem.appendChild(tabLink);
    tabs.appendChild(tabItem);
    document.body.append(nav, tabs);

    try {
      const style = getComputedStyle(link);
      expect(style.color).toBe("rgb(13, 14, 18)");
      expect(style.backgroundColor).toBe("rgb(219, 223, 240)");
      expect(style.borderRadius).toBe("6px");
      expect(getComputedStyle(tabLink).borderTopLeftRadius).toBe("6px");
      expect(getComputedStyle(tabLink).borderBottomLeftRadius).toBe("0px");
    } finally {
      nav.remove();
      tabs.remove();
    }
  });

  for (const mode of ["day", "night"]) {
    it(`keeps ${mode} secondary labels and inactive tabs readable`, async () => {
      await lumine.packages.activatePackage("nova-theme");
      await lumine.packages.activatePackage(`nova-${mode}-ui`);

      const samples = [
        ["--text-color-subtle", "--base-background-color"],
        ["--text-color-hint", "--input-background-color"],
        ["--tab-text-color", "--tab-background-color"],
      ].map(([foreground, background]) => {
        const sample = document.createElement("span");
        sample.style.color = `var(${foreground})`;
        sample.style.backgroundColor = `var(${background})`;
        document.body.appendChild(sample);
        return sample;
      });

      try {
        for (const sample of samples) {
          const style = getComputedStyle(sample);
          expect(contrastRatioWithAlpha(style.color, style.backgroundColor)).toBeGreaterThanOrEqual(
            4.5,
          );
        }
      } finally {
        for (const sample of samples) sample.remove();
      }
    });
  }

  it("owns Nova-specific symbolic and cursor-line syntax colors", async () => {
    await lumine.packages.activatePackage("nova-theme");
    await lumine.packages.activatePackage("nova-day-syntax");

    let rootStyle = getComputedStyle(document.documentElement);
    expect(rootStyle.getPropertyValue("--syntax-symbolic-color").trim()).toBe("hsl(228, 10%, 26%)");
    expect(rootStyle.getPropertyValue("--syntax-cursor-line-background-color").trim()).toBe(
      "rgba(79, 88, 214, 0.05)",
    );

    await lumine.packages.deactivatePackage("nova-day-syntax");
    await lumine.packages.activatePackage("nova-night-syntax");

    rootStyle = getComputedStyle(document.documentElement);
    expect(rootStyle.getPropertyValue("--syntax-symbolic-color").trim()).toBe("hsl(265, 75%, 72%)");
    expect(rootStyle.getPropertyValue("--syntax-cursor-line-background-color").trim()).toBe(
      "rgba(122, 131, 242, 0.04)",
    );
  });
});
