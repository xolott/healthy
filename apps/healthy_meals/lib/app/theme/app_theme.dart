import 'package:flutter/material.dart';

/// Placeholder theme aligned with Material 3 Expressive. Product theming
/// arrives in a later iteration.
abstract final class MealsAppTheme {
  static ThemeData light() {
    final colorScheme = ColorScheme.fromSeed(seedColor: Colors.orange);
    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      // Default SearchBar uses elevation 6, which reads as a heavy M2-style
      // drop shadow. M3 leans on surface containers and tonal color, not deep
      // shadow, for affordance.
      searchBarTheme: SearchBarThemeData(
        backgroundColor: WidgetStatePropertyAll(
          colorScheme.surfaceContainerHigh,
        ),
        elevation: const WidgetStatePropertyAll(0),
        shadowColor: const WidgetStatePropertyAll(Colors.transparent),
      ),
    );
  }
}
