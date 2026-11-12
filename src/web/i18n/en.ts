/**
 * English: the source text for the website's own wording. Every other language
 * (src/web/i18n/locales/*.ts) must have exactly these keys; TypeScript and tests/i18n.test.ts enforce it.
 *
 *   {name}          a value filled in by the app. Keep the braces and the name.
 *   <b>…</b> <em>…</em>   emphasis. Keep the tags around the matching words.
 *   { one, other }  a text that depends on a count ({n}). Add the forms your language needs
 *                   (zero, one, two, few, many, other: the Unicode plural categories).
 *
 * Not in this file: parameter names and help (src/params/schema.ts), parameter groups
 * (src/web/lib/fields.ts), cable names (src/web/lib/cables.ts) and the rule notes
 * (src/rules/derive.ts). Their English lives next to the code that owns them.
 */
export const en = {
  'meta.title': 'Bricko · Brick-compatible cable clip generator',
  'meta.description': 'Design a print-in-place, brick-compatible cable clip in your browser and download the STL. Free and open source.',

  // Header
  'app.home': 'Bricko home',
  'app.tagline': 'Cable clips that snap onto building bricks',
  'app.howToPrint': 'How to print',
  'app.source': 'Source',
  'app.intro': 'Pick your cables, download, and print. Every clip folds shut on a built-in hinge, with no assembly.',
  'footer.about': '<b>Bricko</b> is free and open source (AGPL-3.0). Everything runs in your browser, so nothing is uploaded.',
  'footer.source': 'Source code and feedback',

  // Preview
  'view.label': 'View',
  'view.desk': 'On your desk',
  'view.printer': 'On the printer',
  'view.openLid': 'Open lid',
  'view.closeLid': 'Close lid',
  'view.reset': 'Reset view',
  'view.preview': '3D preview of the clip. Drag to rotate, pinch or scroll to zoom, double-tap to reset the view.',
  'status.loading': 'Loading…',
  'status.updating': 'Updating…',
  'blocked.title': "This clip can't be made",
  'stats.label': 'Clip size',
  'stats.filament': 'about <b>{g}</b> g of filament',
  'stats.filamentShort': 'about <b>{g}</b> g',

  // Share and download
  'share.button': 'Share',
  'share.copied': 'Link copied ✓',
  'share.title': 'Bricko cable clip',
  'share.prompt': 'Copy this link',
  'download.button': 'Download STL',
  'toast.downloaded': 'Downloaded. Print it exactly as it is in the file: lying on its side, no supports.',
  'toast.tips': 'Printing tips',
  'toast.dismiss': 'Dismiss',

  // Settings panel
  'panel.label': 'Settings',
  'panel.customize': 'Customize',
  'error.invalid': 'Invalid value: {field}',
  'error.loading': 'Still loading, try again in a second.',
  'error.testPrint': 'Could not build the test print.',
  'issues.selfCheck': 'Self-check failed: {detail}. Please report this combination.',

  // 1 Your cables
  'cables.title': 'Your cables',
  'cables.cable': 'Cable {n}',
  'cables.thickness': 'Cable {n} thickness',
  'cables.other': 'Other size…',
  'cables.remove': 'Remove cable {n}',
  'cables.removeTip': 'Remove',
  'cables.add': '+ Add a cable',
  'cables.hint': "Not sure of a size? Measure the cable's thickness and pick <em>Other size</em>.",
  'fit.question': 'How should cables sit?',
  'fit.label': 'How cables sit',
  'fit.easy': 'Easy',
  'fit.easySub': 'cables drop in',
  'fit.snug': 'Snug',
  'fit.snugSub': 'cables click in',

  // 2 Width
  'width.title': 'Width',
  'width.label': 'Clip width in studs',
  'width.studs': { one: 'stud', other: 'studs' },
  'width.hint': '{mm} mm wide. Wider clips are stronger.',

  // 3 Bricks
  'bricks.title': 'Bricks',
  'bricks.studs': 'Studs on top',
  'bricks.studsSub': 'Build on top of the clip',
  'bricks.sockets': 'Snaps onto bricks',
  'bricks.socketsSub': 'Press it onto a brick or baseplate',

  // 4 Hinge fit
  'hinge.title': 'Hinge fit',
  'hinge.tighter': 'Tighter',
  'hinge.standard': 'Standard',
  'hinge.looser': 'Looser',
  'hinge.custom': 'Custom gap: {mm} mm (set in Advanced).',
  'hinge.hint': 'Hinge stuck after printing? Choose <em>Looser</em>. Wobbly? <em>Tighter</em>.',
  'hinge.fitTest': 'Print a fit test first →',

  // Advanced settings
  'adv.title': 'Advanced settings',
  'adv.blurb': 'Exact sizes, hinge, latch, brick fit, printer',
  'adv.cables': 'Cables',
  'adv.room': 'Extra room around each cable',
  'adv.channels': 'Channels are {widths} mm wide and {height} mm tall.',
  'adv.preview': 'Preview',
  'adv.openLid': 'Open the lid',
  'adv.cut': 'Cut-away view',
  'adv.cutOff': 'off',
  'adv.cutHelp': 'Slice through the clip to see the hinge and latch inside.',
  'adv.checks': 'Checks',
  'adv.reset': 'Reset everything to defaults',
  'checks.twoParts': 'Two separate parts',
  'checks.noTouch': 'Parts never touch',
  'checks.minGap': 'Smallest gap',
  'checks.volume': 'Plastic volume',
  'checks.time': 'Build time',

  // How to print
  'guide.1': "<b>Don't rotate it.</b> The file is already lying on its side, hinge pointing up. That's how it prints best.",
  'guide.2': '<b>No supports, no assembly.</b> The hinge prints already joined. A brim is fine if your bed is slippery.',
  'guide.3': '<b>PETG or PLA+</b> work best. Plain PLA works too.',
  'guide.4': "When it's done, open the lid gently once to free the hinge.",
  'guide.5': '<b>Hinge stuck?</b> Choose <em>Looser</em> under Hinge fit and print again. <b>Wobbly?</b> Choose <em>Tighter</em>.',
  'guide.6': '<b>First clip?</b> Print the fit test (Hinge fit → <em>Print a fit test</em>). It tells you the best settings for your printer.',

  // Fit test
  'test.title': "Find your printer's best fit",
  'test.close': 'Close',
  'test.intro': "Every printer is a little different. This prints five mini clips in one go (about 25 g), each a little looser than the last, and the dots on each clip tell them apart. The 3-dot clip uses your current settings. When they're printed:",
  'test.hinge': '<b>Hinge:</b> pick the tightest clip whose hinge turns freely.',
  'test.studs': "<b>Studs:</b> press a real brick onto each clip's studs. Pick the one that clicks and holds.",
  'test.sockets': '<b>Sockets:</b> press each clip onto a real brick or baseplate. Pick the one that grips without forcing.',
  'test.saved': 'Showing the values from your last downloaded test print.',
  'test.colDots': 'Dots',
  'test.colHinge': 'Hinge',
  'test.colStuds': 'Studs',
  'test.colSockets': 'Sockets',
  'test.dots': { one: '{n} dot', other: '{n} dots' },
  'test.apply': 'After printing, pick the winning value in each column to apply it. The highlighted values are your current settings.',
  'test.done': 'Downloaded. About 25 g of filament.',
  'test.building': 'Building…',
  'test.download': 'Download test print STL',
} as const;
