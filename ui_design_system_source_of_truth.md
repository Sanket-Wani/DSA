# Product UI Design System --- Source of Truth

**Document type:** Implementation-ready UI/UX design specification\
**Status:** Authoritative\
**Audience:** Product designers, frontend engineers, AI coding agents\
**Scope:** Visual language, layout, components, interaction patterns,
responsive behavior, accessibility, and implementation quality.

------------------------------------------------------------------------

## 1. Purpose and Authority

This document defines the product's UI design rules. Treat it as the
**single source of truth for visual and interaction decisions**.

### Mandatory rules

1.  Follow the tokens, component rules, layout patterns, and interaction
    standards in this document consistently.
2.  Reuse existing design tokens and components instead of creating
    one-off values or controls.
3.  When a requirement is not specified, choose the simplest option that
    fits the established visual language.
4.  Do not introduce decorative gradients, strong shadows, unnecessary
    animations, bright accent colors, or visually noisy surfaces.
5.  Do not change the design language on individual pages. All product
    areas must feel like one cohesive application.
6.  Prioritize clarity, information density, alignment, and predictable
    behavior over decoration.
7.  If an implementation conflicts with this document, this document
    takes precedence unless a later explicit product decision supersedes
    it.

## 2. Design Principles

### 2.1 Quiet, professional interface

Use a restrained, neutral interface with a white primary workspace, pale
neutral backgrounds, subtle borders, dark text, and limited semantic
colors.

### 2.2 Clear hierarchy

Build hierarchy through spacing, font weight, font size, surface
contrast, and alignment---not through excessive colors or decoration.

### 2.3 Dense but readable

The interface should support data-heavy workflows without feeling
crowded. Keep rows compact, labels clear, and related information
aligned.

### 2.4 Consistent geometry

Use a repeatable spacing scale, consistent corner radii, shared control
heights, and predictable alignment across all screens.

### 2.5 Subtle affordances

Borders, light fills, small icons, hover states, and restrained shadows
should communicate interaction. Avoid exaggerated button effects.

### 2.6 Functional color

Color must communicate meaning, such as success, warning, error, or
selection. Do not use color solely for decoration.

### 2.7 Scannability

Users should be able to scan navigation, metrics, tables, statuses, and
actions quickly. Prefer concise labels and consistent column alignment.

------------------------------------------------------------------------

## 3. Visual Language

### 3.1 Overall aesthetic

-   Minimal, contemporary, business-oriented SaaS.
-   Mostly white and near-white surfaces.
-   Neutral gray outer canvas or application shell where appropriate.
-   Dark charcoal typography rather than pure black for most text.
-   Thin, low-contrast dividers and borders.
-   Rounded corners with a consistent radius scale.
-   Compact, outlined icons.
-   Small, understated status pills.
-   Little to no elevation; rely on borders and surface separation.
-   No ornamental illustrations in operational data views unless they
    serve a clear product purpose.

### 3.2 Surface hierarchy

Use surfaces in this order:

1.  **Application canvas:** very light neutral gray, if the page layout
    requires an outer canvas.
2.  **Primary workspace:** white.
3.  **Secondary panels/cards:** white or extremely light gray,
    distinguished with a subtle border.
4.  **Hover/selected surface:** pale gray.
5.  **Disabled surface:** neutral gray with reduced contrast, while
    remaining legible.

Avoid stacking multiple strong shadows or placing every element inside a
separate card.

------------------------------------------------------------------------

## 4. Design Tokens

Use CSS custom properties or the equivalent token system. The values
below are initial implementation defaults based on the intended visual
language; keep them centralized and adjust only through deliberate
design-system changes.

### 4.1 Color tokens

``` css
:root {
  /* Core surfaces */
  --color-canvas: #F5F5F5;
  --color-surface: #FFFFFF;
  --color-surface-subtle: #F8F8F8;
  --color-surface-muted: #F1F1F1;
  --color-surface-hover: #F5F5F5;
  --color-surface-selected: #EEEEEE;

  /* Text */
  --color-text-primary: #191919;
  --color-text-secondary: #666666;
  --color-text-tertiary: #858585;
  --color-text-disabled: #A3A3A3;
  --color-text-inverse: #FFFFFF;

  /* Borders */
  --color-border: #E8E8E8;
  --color-border-strong: #DADADA;
  --color-border-focus: #777777;

  /* Brand/action neutrals */
  --color-action-primary: #202020;
  --color-action-primary-hover: #353535;
  --color-action-secondary: #FFFFFF;
  --color-action-secondary-hover: #F4F4F4;

  /* Semantic colors: use sparingly */
  --color-success: #238B57;
  --color-success-bg: #E8F5EC;
  --color-warning: #B77A13;
  --color-warning-bg: #FFF4D9;
  --color-danger: #C83C42;
  --color-danger-bg: #FCEBEC;
  --color-info: #3978B8;
  --color-info-bg: #EAF2FB;

  /* Focus */
  --color-focus-ring: rgba(55, 55, 55, 0.24);
}
```

#### Color usage rules

-   Primary text should be the darkest neutral.
-   Secondary text is for descriptions, metadata, supporting labels, and
    timestamps.
-   Tertiary text is for low-priority metadata only; do not use it for
    essential instructions.
-   Borders should define boundaries without dominating the interface.
-   Primary actions use a dark neutral fill with white text.
-   Secondary actions use a white or subtle neutral fill with a thin
    border.
-   Green means successful, completed, healthy, or on track.
-   Amber means caution, approaching a threshold, or needs attention.
-   Red means failed, late, destructive, or urgent.
-   Blue is reserved for informational or link-oriented states.
-   Semantic states must also include text or an icon; never communicate
    meaning through color alone.
-   Do not apply semantic colors to large areas unless the state
    genuinely requires it.

### 4.2 Typography tokens

Use a neutral, highly legible sans-serif stack. Prefer the product's
established font if one is already configured; otherwise use:

``` css
:root {
  --font-sans: Inter, ui-sans-serif, system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI", sans-serif;

  --font-size-xs: 11px;
  --font-size-sm: 12px;
  --font-size-md: 13px;
  --font-size-base: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 20px;
  --font-size-2xl: 24px;

  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  --line-height-tight: 1.2;
  --line-height-normal: 1.45;
  --line-height-relaxed: 1.6;
}
```

#### Typography hierarchy

  -------------------------------------------------------------------------
  Role                            Size               Weight Usage
  --------------- -------------------- -------------------- ---------------
  Page title                 20--24 px                  600 Main page
                                                            heading

  Section title              16--18 px                  600 Major content
                                                            section

  Metric value               22--26 px                  700 KPI/card
                                                            primary number

  Body/control               13--14 px             400--500 Main content
  text                                                      and controls

  Table header               11--12 px             500--600 Column labels

  Supporting                 11--12 px                  400 Email, helper
  metadata                                                  text,
                                                            timestamps

  Compact badge              11--12 px                  500 Status and
                                                            small labels
  -------------------------------------------------------------------------

Rules:

-   Use sentence case for labels and headings.
-   Avoid all-caps labels except for very short, established
    abbreviations.
-   Use weight before size to establish modest hierarchy.
-   Do not make every label bold.
-   Keep long-form body text at a comfortable line height.
-   Use tabular numerals for metrics, counts, prices, durations, and
    aligned numeric columns where supported.
-   Truncate long single-line metadata with an accessible way to inspect
    the full value.

### 4.3 Spacing scale

Use a 4 px base spacing system.

``` css
:root {
  --space-0: 0;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}
```

Usage guidance:

-   4--8 px: icon-to-label gaps and tight internal groupings.
-   8--12 px: compact controls and table cell content.
-   12--16 px: card internals and related controls.
-   16--24 px: between component groups.
-   24--32 px: between major sections.
-   32 px and above: page-level separation or generous responsive
    spacing.

Do not invent arbitrary margins when a token already fits.

### 4.4 Radius tokens

``` css
:root {
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 9px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-pill: 999px;
}
```

Rules:

-   Small inputs and compact buttons: 6--9 px.
-   Cards and grouped panels: 10--12 px.
-   Large shell/container corners: 14--18 px where appropriate.
-   Status badges: pill radius.
-   Do not mix sharp square corners with very rounded cards without a
    clear reason.

### 4.5 Borders and elevation

``` css
:root {
  --border-width: 1px;
  --shadow-none: none;
  --shadow-subtle: 0 1px 2px rgba(0, 0, 0, 0.035);
  --shadow-popover: 0 8px 24px rgba(0, 0, 0, 0.10);
}
```

-   Prefer a 1 px border over a shadow for normal cards and tables.
-   Use subtle elevation only for overlays or elements that must appear
    above surrounding content.
-   Menus, dialogs, and popovers may use a more visible but still
    restrained shadow.
-   Avoid heavy, diffuse shadows on all cards.

### 4.6 Control sizing

``` css
:root {
  --control-height-sm: 30px;
  --control-height-md: 36px;
  --control-height-lg: 40px;
  --icon-size-sm: 14px;
  --icon-size-md: 16px;
  --icon-size-lg: 18px;
  --avatar-size-sm: 28px;
  --avatar-size-md: 32px;
  --avatar-size-lg: 40px;
}
```

Use the same heights for controls that appear in the same toolbar.
Increase touch targets on mobile without changing the visual system.

------------------------------------------------------------------------

## 5. Application Shell and Layout

### 5.1 Desktop shell

Use a stable two-region application shell:

-   **Left navigation rail/sidebar:** persistent, vertically arranged
    navigation.
-   **Main workspace:** top utility bar plus page content.
-   **Top utility bar:** restrained height, separated from the workspace
    by a subtle bottom border.
-   **Main content:** aligned to a consistent left and right inset.
-   **Page-level background:** white or near-white, with the primary
    content clearly defined.

The shell should feel calm and spacious around the edges while allowing
the central work area to remain information-dense.

### 5.2 Sidebar

Recommended desktop width: **220--256 px**. The sidebar may collapse at
narrower widths.

Structure:

1.  Brand mark and product name.
2.  Optional global search.
3.  Primary navigation list.
4.  Flexible empty space.
5.  Secondary navigation, such as help and settings, anchored near the
    bottom.

Sidebar rules:

-   Use a simple monochrome icon to the left of each label.
-   Keep icon dimensions and label alignment consistent.
-   Navigation rows should be approximately 36--40 px tall.
-   Use a pale neutral background for the active item.
-   Active item text and icon should be darker or slightly stronger than
    inactive items.
-   Do not rely on a colored stripe alone to identify the current page.
-   Inactive links use secondary text; hover adds a subtle neutral fill.
-   Use a clear focus indicator for keyboard navigation.
-   Keep labels short and consistent.
-   Avoid nested navigation unless the information architecture requires
    it.

### 5.3 Top utility bar

Recommended height: **48--56 px**.

Use for global utilities such as:

-   Notifications.
-   User avatar/profile menu.
-   Organization or workspace switcher, if needed.

Rules:

-   Align items vertically to the center.
-   Keep utilities on the right unless the product requires another
    pattern.
-   Use icon buttons with accessible labels and visible focus states.
-   Notification indicators should be small and must not obscure the
    icon.
-   Separate the bar from content with a subtle border, not a heavy
    shadow.

### 5.4 Main workspace

-   Use 16--20 px horizontal content insets on standard desktop layouts.
-   Use consistent top spacing between the utility bar and page content.
-   Align page title, page actions, cards, and data table to the same
    content grid.
-   Avoid horizontal misalignment between a section title and its
    corresponding table or cards.
-   Use a fluid content width; avoid unnecessarily narrow fixed-width
    workspaces.
-   On very wide screens, preserve readable column widths and avoid
    stretching short forms excessively.

### 5.5 Page structure

A typical data-oriented page should follow this order where relevant:

1.  Page-level title and primary action area.
2.  Optional KPI/summary row.
3.  Section heading and date/range controls.
4.  Search, filters, and contextual actions.
5.  Main data view (table, list, or cards).
6.  Pagination and page-size controls.

Not every page needs every section. Do not add empty placeholder cards
solely to follow this order.

------------------------------------------------------------------------

## 6. Grid and Alignment

-   Use a consistent horizontal grid across the main workspace.
-   Summary cards should have equal heights and aligned edges.
-   Use equal-width cards when each metric has comparable importance.
-   Keep gaps between cards consistent, generally 12--16 px.
-   Align toolbar controls by their vertical center and use consistent
    heights.
-   Align numeric values and dates consistently within tables.
-   Keep labels close to the content they describe.
-   Use flexible layouts instead of absolute positioning for normal page
    structure.
-   Avoid pixel-positioned layouts that break when text length or
    viewport width changes.

Suggested desktop KPI grid:

``` css
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
```

Adjust the number of columns responsively rather than forcing four
columns at every width.

------------------------------------------------------------------------

## 7. Cards and KPI Components

### 7.1 Card anatomy

A compact metric card may include:

1.  Small, muted label.
2.  Prominent value.
3.  Optional trend or status indicator.
4.  Short comparison period or explanatory note.

### 7.2 Card styling

-   White or very light neutral fill.
-   Thin neutral border.
-   10--12 px corner radius.
-   Approximately 14--18 px internal padding.
-   No strong shadow.
-   Labels use secondary text.
-   Values use primary text and semibold/bold weight.
-   Supporting context uses small, muted text.
-   Semantic trend colors are used only when the trend has a clear
    meaning.

### 7.3 Metric rules

-   Format values consistently across the same group.
-   Use tabular numerals where possible.
-   Keep labels concise.
-   Make positive/negative trends understandable with text or an icon in
    addition to color.
-   Never assume that an increase is good; the semantic direction
    depends on the metric.
-   Do not use decorative charts inside a compact metric card unless
    they add meaningful information.

------------------------------------------------------------------------

## 8. Page Headings and Toolbars

### 8.1 Heading row

-   Put the page title at the leading edge of the content grid.
-   Place primary actions at the opposite edge when appropriate.
-   Use 20--24 px semibold type for the page title.
-   Keep the title and primary action aligned vertically.
-   On narrow screens, allow actions to wrap or move into an overflow
    menu.

### 8.2 Section header

-   Use 16--18 px semibold type.
-   Place related date, view, or contextual controls close to the
    section title.
-   Separate section headers from content using spacing, not thick
    divider bars.

### 8.3 Toolbar

A toolbar may contain search, filters, date navigation, view controls,
and a primary action.

Rules:

-   Search and filter controls should share consistent heights.
-   Keep the primary action visually dominant.
-   Use a dark neutral fill and white text for the primary action.
-   Use white backgrounds, thin borders, and dark text for secondary
    actions.
-   Place a small icon before the text where it improves recognition.
-   Do not place too many equally prominent buttons in one toolbar.
-   At narrow widths, wrap controls or group less-frequent actions in an
    overflow menu.
-   Maintain clear separation between search, filters, and destructive
    actions.

------------------------------------------------------------------------

## 9. Buttons

### 9.1 Primary button

-   Dark neutral background.
-   White text.
-   Medium or semibold font weight.
-   Compact height around 34--38 px on desktop.
-   6--9 px radius.
-   Optional leading icon with a consistent gap.
-   Hover state uses a slightly lighter or darker neutral, depending on
    the base.
-   Pressed state should be visibly different but subtle.

### 9.2 Secondary button

-   White or near-white background.
-   Thin neutral border.
-   Dark text.
-   Same height and radius as neighboring primary buttons.
-   Hover state uses a light neutral fill.

### 9.3 Tertiary/icon button

-   Transparent or neutral background.
-   Used for low-emphasis actions and compact utilities.
-   Icon-only buttons must have an accessible name and a clear
    hover/focus state.
-   Provide tooltips when the icon's meaning is not universally
    recognizable.

### 9.4 Destructive actions

-   Use danger color for destructive intent, not for routine actions.
-   Confirm irreversible or high-impact actions.
-   State the consequence clearly in the confirmation step.
-   Do not make destructive actions the default primary action in
    ordinary workflows.

### 9.5 Button behavior

-   Show a disabled state when an action is unavailable.
-   Show a loading state during an in-progress operation.
-   Prevent duplicate submissions while an operation is pending.
-   Preserve button width during loading where possible.
-   Never make a control look clickable if it has no action.

------------------------------------------------------------------------

## 10. Search, Inputs, and Filters

### 10.1 Search input

-   White background.
-   Thin neutral border.
-   Compact height around 34--38 px.
-   Small search icon aligned to the leading edge.
-   Muted placeholder text.
-   6--9 px corner radius.
-   Clear visible focus state.
-   Search controls in the same toolbar should share a common height.

Search behavior should include:

-   A descriptive placeholder that indicates what can be searched.
-   Debouncing for live search where appropriate.
-   A clear button when the user has entered a query, if useful.
-   A clear empty-results state.
-   Preservation of search state during pagination where practical.

### 10.2 Filter button

-   Use a secondary button style.
-   Include a filter icon and concise label.
-   If filters are active, display a count or other subtle active
    indicator.
-   Opening filters should use a popover, dropdown panel, or side panel
    based on complexity.
-   Provide clear Apply and Reset behavior when filters are not applied
    immediately.
-   Make active filters visible and removable.

### 10.3 Form fields

-   Labels should remain visible; do not rely only on placeholders.
-   Use consistent field heights and border radii.
-   Place helper text directly below the relevant field.
-   Show validation errors close to the field and explain how to correct
    them.
-   Keep label, input, helper text, and error states aligned.
-   Group related fields logically.
-   Avoid very wide inputs for short values.
-   Use suitable input types and autocomplete attributes.

### 10.4 Date and range controls

-   Present the selected date or range clearly.
-   Use small, consistent previous/next controls for stepping through
    adjacent periods.
-   Keep date controls visually grouped.
-   Distinguish a date label from an interactive dropdown.
-   Use the user's locale for date formatting unless the product
    specifies otherwise.
-   Ensure keyboard and screen-reader support for date pickers.

------------------------------------------------------------------------

## 11. Tables and Data Grids

Tables are a core pattern for dense operational information.

### 11.1 Table container

-   Use a white surface with a thin neutral outer border.
-   Use a subtle radius, approximately 10--12 px.
-   Clip or manage overflow so the table aligns with the container's
    rounded corners.
-   Avoid heavy shadows.
-   Keep header and body visually distinct without strong color blocks.

### 11.2 Table header

-   Use a subtle neutral background or white background.
-   Use 11--12 px medium/semibold text.
-   Use consistent vertical alignment.
-   Keep column labels concise.
-   Use consistent padding across all header cells.
-   Support sorting only where sorting is meaningful; indicate the
    current sort direction.

### 11.3 Table rows

-   Desktop default row height: approximately 48--54 px, adjusted for
    multi-line content.
-   Use thin horizontal separators.
-   Avoid vertical grid lines unless they are necessary to interpret
    complex data.
-   Use a subtle hover background for interactive rows.
-   Do not make the entire row clickable if it contains competing
    controls without a clear interaction model.
-   Maintain a consistent row density throughout a table.
-   Keep checkbox, avatar, text, status, and action alignment consistent
    across rows.

### 11.4 Cell content

-   Use 13--14 px primary text for main values.
-   Use 11--12 px secondary text for supporting information.
-   When a cell contains a name and metadata, stack them with a small
    vertical gap.
-   Use avatars consistently and do not allow them to shift text
    alignment.
-   Use a single-line ellipsis for long secondary text when necessary.
-   Use monospaced or tabular numerals for identifiers, numeric data,
    times, and values where it improves comparison.
-   Align numeric columns consistently; generally right-align purely
    numeric values and keep text columns left-aligned.
-   Use em dashes or a consistent empty-value indicator for unavailable
    data; do not mix many different symbols.

### 11.5 Row selection

-   Use a standard checkbox in the first column when bulk selection is
    supported.
-   The header checkbox should represent select-all behavior and support
    an indeterminate state.
-   Make selected rows visibly distinct using a subtle neutral fill or
    another consistent selection treatment.
-   Show bulk actions only when they are relevant to the current
    selection.
-   Clearly distinguish selection from hover.

### 11.6 Status badges

-   Use small pill-shaped labels.
-   Use a pale semantic background with a darker semantic foreground.
-   Include concise text, not just a colored dot.
-   Use a small dot only as a supplementary cue.
-   Keep badge padding and typography consistent.
-   Do not use badges for ordinary metadata or decorative labels.

Suggested mapping:

  ----------------------------------------------------------------------------
  State                   Foreground                 Background
  ----------------------- -------------------------- -------------------------
  Success / on track      `--color-success`          `--color-success-bg`

  Warning / needs         `--color-warning`          `--color-warning-bg`
  attention                                          

  Error / overdue /       `--color-danger`           `--color-danger-bg`
  failed                                             

  Informational           `--color-info`             `--color-info-bg`

  Neutral / unknown       `--color-text-secondary`   `--color-surface-muted`
  ----------------------------------------------------------------------------

### 11.7 Row actions

-   Use a compact overflow menu for infrequent row actions.
-   Use a small ellipsis icon button aligned consistently at the end of
    each row.
-   Provide an accessible label that includes the row context where
    possible.
-   Menu items should have clear labels and logical ordering.
-   Destructive actions should be separated from routine actions and
    styled appropriately.
-   Ensure menus can be opened and operated by keyboard.

### 11.8 Table responsiveness

-   Do not simply shrink all columns until the table becomes unreadable.
-   On medium widths, prioritize key columns and permit horizontal
    scrolling if necessary.
-   On mobile, consider a card/list representation for each record.
-   Keep essential actions accessible even when some columns are hidden.
-   If horizontal scrolling is used, preserve clear indication that more
    columns are available.

------------------------------------------------------------------------

## 12. Pagination and Page Size

-   Place pagination directly below the data view.
-   Keep page-size controls and the item-count context on the leading
    side.
-   Keep page navigation on the trailing side on desktop.
-   Use compact square or near-square page buttons.
-   The active page should use a dark neutral fill and white text.
-   Inactive pages should use a white or transparent surface with a
    subtle border.
-   Disabled previous/next controls must be visibly disabled and
    non-interactive.
-   Ellipses may indicate omitted page ranges.
-   Preserve filters and sort order while changing pages.
-   On narrow screens, reduce visible page numbers and prioritize
    previous/next controls.
-   Always make the current page available to assistive technology.

------------------------------------------------------------------------

## 13. Icons and Avatars

### 13.1 Icons

-   Use one consistent icon family across the product.
-   Prefer simple outline icons with consistent stroke weight.
-   Default icon sizes: 14--16 px for compact controls, 16--18 px for
    navigation and primary controls.
-   Align icons to the visual center of the accompanying text.
-   Use icons to reinforce labels, not replace essential text.
-   Avoid mixing filled, outlined, 3D, and multicolor icon styles.
-   Use semantic icons consistently for search, calendar, filters,
    notifications, settings, help, navigation, and overflow actions.
-   Decorative icons should be hidden from assistive technology;
    functional icons need accessible names through their controls.

### 13.2 Avatars

-   Use circular avatars for people.
-   Common sizes: 28--32 px for table rows and 36--40 px for profile
    areas.
-   Crop images consistently using `object-fit: cover`.
-   If no image is available, use a neutral fallback with initials or a
    generic person icon.
-   Keep avatar sizing fixed so row content does not shift.
-   Do not use avatars as decorative color accents.

------------------------------------------------------------------------

## 14. Navigation and Interaction States

Every interactive component must have consistent states.

### 14.1 Required states

-   Default.
-   Hover.
-   Focus-visible.
-   Active/pressed.
-   Selected, where applicable.
-   Disabled.
-   Loading, where applicable.
-   Error, where applicable.

### 14.2 State rules

-   Hover changes should be subtle and should not cause layout shifts.
-   Keyboard focus must be visible.
-   Selected navigation should use a stable neutral highlight.
-   Disabled controls must be visibly different and not respond to
    interaction.
-   Loading states must communicate that work is underway.
-   Error states should explain the problem and, when possible, provide
    a recovery action.
-   Do not communicate a state exclusively through color.
-   Avoid animations that delay users from completing a task.

### 14.3 Motion

-   Use motion only to explain state changes or spatial relationships.
-   Keep common transitions short, approximately 120--180 ms.
-   Prefer opacity and subtle color changes over large movements.
-   Respect `prefers-reduced-motion`.
-   Avoid bounce, spring, or decorative entrance animations in
    data-heavy workflows.

------------------------------------------------------------------------

## 15. Dropdowns, Popovers, and Menus

-   Use a white surface, subtle border, restrained shadow, and 8--12 px
    radius.
-   Align the menu to the triggering control when practical.
-   Maintain comfortable row padding and clear item labels.
-   Provide hover and keyboard-focus states.
-   Close on Escape and, where appropriate, outside click.
-   Keep the focus behavior predictable.
-   Do not allow menus to extend beyond the viewport.
-   Use separators sparingly to group related actions.
-   Destructive menu items should be clearly differentiated.
-   Use a dialog or side panel rather than a crowded popover for complex
    workflows.

------------------------------------------------------------------------

## 16. Dialogs and Side Panels

-   Use dialogs for focused decisions or short forms.
-   Use side panels for detailed editing while retaining page context.
-   Use a clear title and concise explanation.
-   Keep primary and secondary actions in a consistent footer area.
-   The primary action should be visually clear.
-   Provide an obvious close action.
-   Trap focus within modal dialogs and restore focus to the trigger on
    close.
-   Support Escape when closing is safe.
-   Warn before discarding meaningful unsaved changes.
-   Avoid deeply nested dialogs.

------------------------------------------------------------------------

## 17. Empty, Loading, Error, and Success States

### 17.1 Empty state

-   Explain what is missing.
-   If relevant, explain how to create or find the first item.
-   Offer one clear next action.
-   Keep the visual treatment minimal.
-   Do not show an empty table with no explanation when the user needs
    guidance.

### 17.2 Loading state

-   Use a small spinner, skeleton, or inline progress indicator
    appropriate to the component.
-   Preserve the page layout where possible to prevent layout shift.
-   Do not use a full-page blocking loader for small background
    operations.
-   Indicate long-running tasks and provide progress when meaningful.

### 17.3 Error state

-   State what failed in plain language.
-   Preserve user input whenever possible.
-   Offer retry or a recovery step when available.
-   Avoid exposing raw stack traces or internal system details to end
    users.
-   Use semantic error colors sparingly and consistently.

### 17.4 Success feedback

-   Confirm meaningful actions with concise inline feedback, a toast, or
    an updated status.
-   Avoid interrupting routine actions with unnecessary confirmation
    dialogs.
-   Do not use success messages as a substitute for updating the actual
    interface state.

------------------------------------------------------------------------

## 18. Responsive Behavior

### 18.1 Breakpoints

Use these as initial breakpoints and centralize them in the styling
system:

``` css
:root {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
}
```

If the framework uses a different breakpoint convention, map these
values to the framework rather than introducing a second system.

### 18.2 Desktop: 1024 px and above

-   Show the full sidebar where space permits.
-   Use multi-column KPI layouts.
-   Keep tables in their full form when practical.
-   Place toolbar controls on a single line if there is sufficient room.
-   Maintain generous outer margins and consistent content alignment.

### 18.3 Tablet: 768--1023 px

-   Allow the sidebar to collapse or become a drawer.
-   Reduce KPI columns from four to two when needed.
-   Allow toolbars to wrap.
-   Preserve primary table columns and use horizontal scrolling for
    secondary columns.
-   Reduce page insets modestly, not to zero.

### 18.4 Mobile: below 768 px

-   Use a compact header and collapsible navigation/drawer.
-   Stack KPI cards in one or two columns depending on available width.
-   Stack or wrap search and filter controls.
-   Use full-width primary actions when appropriate.
-   Replace wide tables with record cards or a carefully prioritized
    compact layout when that improves usability.
-   Ensure controls have touch-friendly targets, ideally around 44 × 44
    px.
-   Keep labels readable and avoid tiny text.
-   Prevent horizontal overflow at the page level.
-   Keep important actions visible without requiring precise pointer
    interaction.

### 18.5 Responsive principle

Adapt structure and priority---not just scale. Never solve mobile layout
by shrinking text, icons, and controls indiscriminately.

------------------------------------------------------------------------

## 19. Accessibility Requirements

Accessibility is mandatory, not optional.

-   Meet WCAG 2.2 AA where applicable.
-   Maintain sufficient contrast for text, controls, borders, and focus
    indicators.
-   Ensure all functionality is keyboard-operable.
-   Use semantic HTML elements and correct heading order.
-   Provide visible `:focus-visible` styles.
-   Give icon-only controls accessible names.
-   Associate form labels, descriptions, and errors with their fields.
-   Use `aria-sort` or equivalent semantics for sortable table columns.
-   Expose selected, expanded, checked, and disabled states to assistive
    technology.
-   Do not use color as the only indicator of status or validation.
-   Support browser zoom and text enlargement without clipping essential
    content.
-   Respect reduced-motion preferences.
-   Ensure status changes and important feedback can be announced
    accessibly.
-   Use logical tab order and avoid keyboard traps except intentional,
    correctly implemented modal focus management.

Suggested focus treatment:

``` css
:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}
```

Adjust per component to avoid clipped outlines, but never remove focus
visibility without a replacement.

------------------------------------------------------------------------

## 20. Content and Microcopy

-   Use short, specific, action-oriented labels.
-   Prefer familiar words over technical jargon.
-   Use sentence case consistently.
-   Button labels should describe the action, e.g. "Add item", "Save
    changes", or "Apply filters".
-   Avoid vague labels such as "Proceed" when a specific action name is
    possible.
-   Use consistent terminology for the same concept across the
    application.
-   Keep helper text brief and directly relevant.
-   Explain validation errors in a way that tells users how to fix them.
-   Format dates, times, numbers, and currencies consistently according
    to product locale.
-   Use an em dash or consistent placeholder for missing data.
-   Avoid unnecessary exclamation marks and promotional language in
    operational interfaces.

------------------------------------------------------------------------

## 21. Implementation Architecture

The UI should be implemented using shared tokens and reusable components
rather than isolated page-specific styling.

### 21.1 Recommended component hierarchy

``` text
Application
├── AppShell
│   ├── Sidebar
│   │   ├── Brand
│   │   ├── GlobalSearch (optional)
│   │   ├── PrimaryNavigation
│   │   └── SecondaryNavigation
│   ├── TopBar
│   │   ├── GlobalUtilities
│   │   ├── Notifications
│   │   └── ProfileMenu
│   └── MainWorkspace
│       ├── PageHeader
│       ├── SummaryGrid (optional)
│       │   └── MetricCard
│       ├── SectionToolbar (optional)
│       │   ├── DateNavigator (optional)
│       │   ├── SearchInput (optional)
│       │   ├── FilterControl (optional)
│       │   └── PrimaryAction (optional)
│       ├── DataView
│       │   ├── DataTable or RecordList
│       │   ├── StatusBadge
│       │   └── RowActionMenu
│       └── Pagination (optional)
```

This is a reusable pattern, not a requirement that every page contain
every component.

### 21.2 Token-first styling

-   Define colors, typography, spacing, radii, borders, shadows, and
    control dimensions centrally.
-   Reference tokens in components.
-   Avoid repeated hard-coded hex values across page styles.
-   Avoid one-off spacing values when the spacing scale provides a
    suitable option.
-   If a new token is truly required, define it centrally and use it
    consistently.

### 21.3 Component contracts

Every reusable component should define:

-   Purpose and supported use cases.
-   Variants and sizes.
-   Required and optional props.
-   Interaction states.
-   Keyboard behavior.
-   Accessibility semantics.
-   Responsive behavior.
-   Empty/loading/error behavior where relevant.

### 21.4 Avoid

-   Duplicating buttons, inputs, badges, or table styles in separate
    pages.
-   Inline style overrides that bypass design tokens without a clear
    reason.
-   Different radii or heights for controls that appear together.
-   One-off colors for individual statuses.
-   Unnecessary dependencies for simple UI primitives.
-   Clickable `div` elements when semantic buttons or links are
    appropriate.
-   Layouts that depend on fixed coordinates.
-   Placeholder controls that appear interactive but do nothing.

------------------------------------------------------------------------

## 22. Suggested CSS Foundation

The following is a starting point. Integrate it with the existing
framework and avoid duplicating global resets or token definitions.

``` css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  color-scheme: light;
}

body {
  margin: 0;
  background: var(--color-canvas);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

button,
input,
select,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}

button:disabled,
input:disabled,
select:disabled,
textarea:disabled {
  cursor: not-allowed;
}

.app-shell {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  min-height: 100vh;
  background: var(--color-surface);
}

.app-sidebar {
  min-width: 0;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
}

.app-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.app-topbar {
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-inline: var(--space-5);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.page-content {
  min-width: 0;
  padding: var(--space-4);
}

.panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

@media (max-width: 1023px) {
  .app-shell {
    grid-template-columns: 72px minmax(0, 1fr);
  }
}

@media (max-width: 767px) {
  .app-shell {
    display: block;
  }

  .app-sidebar {
    display: none;
  }

  .page-content {
    padding: var(--space-3);
  }
}
```

The sidebar collapse behavior should be implemented deliberately: a 72
px icon rail is appropriate only if navigation remains understandable
and accessible. Otherwise, use a drawer.

------------------------------------------------------------------------

## 23. Design QA Checklist

Before considering a screen complete, verify all applicable items.

### Visual consistency

-   [ ] Uses the shared color, spacing, typography, radius, and control
    tokens.
-   [ ] Main content aligns to a consistent grid.
-   [ ] Cards and panels use restrained borders and elevation.
-   [ ] Typography hierarchy is clear and consistent.
-   [ ] Icons use one consistent family and size scale.
-   [ ] Semantic colors are used only for meaningful states.

### Component consistency

-   [ ] Buttons in the same context share height and alignment.
-   [ ] Search and filter controls use consistent styling.
-   [ ] Table rows have consistent density and alignment.
-   [ ] Status badges use the standard semantic mapping.
-   [ ] Pagination follows the shared interaction and visual rules.
-   [ ] Hover, focus, active, disabled, and loading states are defined.

### Interaction

-   [ ] Every visible control has a real, clear action.
-   [ ] Search, filters, pagination, and sorting behave predictably.
-   [ ] Menus and dialogs support keyboard interaction.
-   [ ] Destructive actions are clearly identified.
-   [ ] Loading and error conditions are handled.
-   [ ] State changes are communicated to the user.

### Responsive quality

-   [ ] No page-level horizontal overflow.
-   [ ] Navigation adapts appropriately to narrow viewports.
-   [ ] Tables remain usable on tablet and mobile.
-   [ ] Toolbars wrap or reorganize without overlapping.
-   [ ] Touch targets are large enough on mobile.
-   [ ] Text does not clip at normal zoom or enlarged text settings.

### Accessibility

-   [ ] Semantic elements and heading hierarchy are correct.
-   [ ] Inputs have labels.
-   [ ] Icon-only controls have accessible names.
-   [ ] Focus is visible.
-   [ ] Status is not communicated by color alone.
-   [ ] Keyboard navigation works throughout the page.
-   [ ] Contrast and reduced-motion behavior are considered.

------------------------------------------------------------------------

## 24. Final Rules for AI Coding Agents

When building or modifying UI, follow this sequence:

1.  **Inspect the existing codebase first.** Identify the framework,
    routing, styling system, icon library, shared components, and
    current tokens.
2.  **Reuse before creating.** Extend existing shared components when
    they can satisfy the requirement without breaking consistency.
3.  **Establish tokens centrally.** Do not scatter style decisions
    across page files.
4.  **Build the shell and primitives first.** Ensure the application
    shell, navigation, buttons, inputs, cards, badges, tables, and menus
    follow this system before composing complex screens.
5.  **Compose pages from shared components.** Page-specific code should
    primarily define content, data, and composition---not redefine the
    visual language.
6.  **Implement real states.** Include hover, focus, active, disabled,
    loading, empty, and error states where relevant.
7.  **Test responsive behavior.** Validate desktop, tablet, and mobile
    layouts rather than assuming desktop styles will scale.
8.  **Test keyboard and accessibility behavior.** Do not treat
    accessibility as a final cosmetic pass.
9.  **Check for drift.** Search for hard-coded colors, inconsistent
    spacing, mismatched control heights, ad hoc radii, and duplicated
    components.
10. **Do not invent a second design system.** Any new UI must fit this
    one.
11. **Do not overdesign.** If two solutions are equally usable, prefer
    the simpler and more restrained one.
12. **Validate the final result.** Run the project's available checks
    and inspect the rendered UI at representative viewport sizes.

### Acceptance criteria

A UI implementation is acceptable only when it is visually consistent
with this specification, functionally complete for the requested
workflow, responsive, accessible, and built from reusable components
wherever practical.

**End of source-of-truth specification.**
