---
name: mobile-android-design
description: Master Material Design 3 and Flutter's material library for building cross-platform UIs. Use when designing mobile interfaces, implementing Material widgets, theming, or following Material 3 in Flutter.
---

# Flutter mobile design (Material 3)

Use Flutter’s **`package:flutter/material.dart`** with **Material 3** to build consistent, accessible UIs on Android, iOS, and other targets. The canonical API index is the [Material library (Flutter API)](https://api.flutter.dev/flutter/material/); the visual and interaction spec lives at [Material Design 3](https://m3.material.io/).

## Material 3 Expressive (required)

**Follow [Material 3 Expressive](https://m3.material.io/) for layout, component choices, shape and interaction intent, without exception.** Do not use Material 2 components or ad-hoc styling where an M3 / Expressive-appropriate control exists. Implement using Flutter’s Material 3 API (`useMaterial3: true`, M3 type scale, M3 color roles, M3 component widgets such as `SearchBar` and `NavigationBar`). If the framework does not yet ship a specific Expressive variant, approximate the spec with the closest M3 theming and shapes while staying in the M3 system—never as an excuse to revert to M2 or non-Material patterns.

## When to use this skill

- Applying Material 3 structure, motion, and components in Flutter
- Theming: `ColorScheme`, `TextTheme`, component themes, dark/light
- Layout: `Column`/`Row`, slivers, `ListView` / `ListView.builder`, `GridView`
- App chrome: `Scaffold`, `AppBar` / `SliverAppBar`, `NavigationBar`, `NavigationDrawer`, `FloatingActionButton`, bottom sheets, dialogs
- Navigation patterns that work with your app router (e.g. bottom tabs, nested shells)
- Accessibility: semantics, contrast, large text, hit targets (≥ 48 logical pixels on primary actions)

## Core API surface (see package docs)

Import:

```dart
import 'package:flutter/material.dart';
```

Frequently used types and widgets (all documented under [material](https://api.flutter.dev/flutter/material/)):

- **Theming:** `ThemeData`, `ColorScheme` / `ColorScheme.fromSeed`, `TextTheme`, `Theme`, `MaterialApp`
- **Structure:** `Scaffold`, `AppBar`, `SliverAppBar`, `Material`, `SafeArea`
- **Layout:** `Column`, `Row`, `Flex`, `Expanded`, `Padding`, `SizedBox`, `ConstrainedBox`, `LayoutBuilder`
- **Lists & scrolling:** `ListView`, `ListView.builder`, `CustomScrollView`, `SliverList`, `GridView`
- **Input & display:** `TextField`, `TextFormField`, `SearchBar` (with `SearchAnchor` when a search overlay and suggestions are required), `ListTile`, `Card`, `Chip`, `LinearProgressIndicator`, `CircularProgressIndicator`
- **Actions:** `FilledButton`, `FilledButton.tonal`, `OutlinedButton`, `TextButton`, `IconButton`, `SegmentedButton`, `FloatingActionButton` / `FloatingActionButton.extended`
- **Overlays:** `showModalBottomSheet`, `showDialog`, `Drawer` / `NavigationDrawer` / `EndDrawer`, `MenuAnchor`, `PopupMenuButton`

Enable Material 3 explicitly on `ThemeData` (recommended; also default in recent Flutter):

```dart
theme: ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(
    seedColor: const Color(0xFF6750A4),
  ),
),
```

## Layout

**Column and row** (spacing and alignment from theme-friendly patterns):

```dart
Column(
  crossAxisAlignment: CrossAxisAlignment.start,
  children: [
    Text('Title', style: Theme.of(context).textTheme.titleLarge),
    const SizedBox(height: 8),
    Text(
      'Body',
      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
    ),
  ],
);

Row(
  children: [
    const Icon(Icons.star),
    const SizedBox(width: 8),
    Expanded(
      child: Text('Line that can wrap', style: Theme.of(context).textTheme.bodyLarge),
    ),
  ],
);
```

**Long lists** — prefer `ListView.builder` (or sliver builders in `CustomScrollView`) so children are created lazily.

**Responsive width** — use `LayoutBuilder`, `MediaQuery.sizeOf(context)`, or `constraints` in `LayoutBuilder` to switch column count or padding, not a single hard-coded width for all devices.

## Navigation patterns (Material + router)

`NavigationBar` is the Material 3 bottom bar (replaces the older `BottomNavigationBar` for M3-styled apps). State is often driven by your tab index and `go_router` (or your project’s router): map selected index to routes and `context.go` / `push` as your architecture requires.

**Sketch** (index + destinations only; wire routes to your `GoRouter` / app):

```dart
Scaffold(
  body: /* current tab child */,
  bottomNavigationBar: NavigationBar(
    selectedIndex: _currentIndex,
    onDestinationSelected: (i) => setState(() => _currentIndex = i),
    destinations: const [
      NavigationDestination(icon: Icon(Icons.home), label: 'Home'),
      NavigationDestination(icon: Icon(Icons.search), label: 'Search'),
    ],
  ),
);
```

**Side navigation** — `NavigationDrawer` for modal drawer; `NavigationRail` for large widths when the product spec calls for it (see [NavigationRail](https://api.flutter.dev/flutter/material/NavigationRail-class.html)).

## Material 3 theming

Prefer **`ColorScheme.fromSeed`** (and optional `brightness: Brightness.dark`) for a full M3 tonal palette. Read colors from context:

- `Theme.of(context).colorScheme` — e.g. `primary`, `onPrimary`, `surface`, `onSurface`, `error`
- `Theme.of(context).textTheme` — type scale (display, headline, title, body, label)

**Custom `ColorScheme`:** use `ColorScheme` constructor or `fromSeed` with `primary`, `secondary`, and surface roles as needed; keep **on-*** roles for contrast (see M3 spec).

**Component themes** — set `cardTheme`, `navigationBarTheme`, `filledButtonTheme`, etc. on `ThemeData` for app-wide consistency.

## Component examples (M3)

**Card:**

```dart
Card(
  clipBehavior: Clip.antiAlias,
  child: InkWell(
    onTap: onTap,
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text(
            body,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
        ],
      ),
    ),
  ),
);
```

**Buttons (M3 roles):**

```dart
FilledButton(onPressed: onPrimaryAction, child: const Text('Continue'));
FilledButton.tonal(onPressed: onSecondary, child: const Text('Add'));
OutlinedButton(onPressed: onTertiary, child: const Text('Cancel'));
TextButton(onPressed: onLearnMore, child: const Text('Learn more'));
FloatingActionButton(
  onPressed: onFab,
  tooltip: 'Add',
  child: const Icon(Icons.add),
);
```

**Text fields** — `TextFormField` with `InputDecoration` and validators; `labelText`, `helperText`, `errorText` for a11y and clarity.

## Quick list tile pattern

```dart
ListTile(
  leading: CircleAvatar(
    backgroundColor: Theme.of(context).colorScheme.primaryContainer,
    child: Icon(Icons.label, color: Theme.of(context).colorScheme.onPrimaryContainer),
  ),
  title: Text(item.title, style: Theme.of(context).textTheme.titleMedium),
  subtitle: Text(
    item.subtitle,
    style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
  ),
  trailing: const Icon(Icons.chevron_right),
  onTap: onTap,
);
```

## Best practices

1. **Theme, don’t hard-code colors** — `Theme.of(context).colorScheme` and `textTheme` for light/dark and future token changes
2. **Material 3** — `useMaterial3: true` and M3 component roles (tonal / filled / outlined) as in the spec
3. **Performance** — builders for long lists; avoid heavy work in `build()`
4. **Touch targets** — at least **48×48** logical pixels for primary actions (`kMinInteractiveDimension` in `package:flutter/material.dart`); many controls default to this via `ButtonStyle` / `IconButton`
5. **Semantics** — `Semantics` / meaningful labels; don’t leave icons without `tooltip` on desktop or `semanticsLabel` when there is no text
6. **State** — prefer small, composable `StatelessWidget`s and explicit state (`ValueNotifier`, `ChangeNotifier`, or your app’s state layer as per project rules)

## Common pitfalls

- **Mixing M2 and M3** — inconsistent corners and elevations; lean on one system via `useMaterial3`
- **Oversized builds** — creating large widget trees in `build()` for every item; use builders and `const` where possible
- **Missing `Material`** — some ink effects need a `Material` ancestor; `Card` and `Scaffold` usually provide it
- **Route state** — tab index and deep links must stay in sync with your router
- **Contrast** — `onSurface` vs `primary` for text; test dark mode and large text (device settings + `MediaQuery` text scale)

## References

- [Flutter Material library (API index)](https://api.flutter.dev/flutter/material/) — all widgets, themes, and constants
- [Material 3 (Google)](https://m3.material.io/) — guidelines and component definitions
- [Get started (incl. M3 Expressive)](https://m3.material.io/get-started) and [Building with M3 Expressive](https://m3.material.io/blog/building-with-m3-expressive) — expressive layout, shape, and motion (required for this project)
- Project Flutter rules: `.cursor/rules/flutter.mdc` (theming, `go_router`, testing)
