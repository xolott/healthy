import 'package:flutter/material.dart';

/// Placeholder Material 3 theme. Product theming arrives in a later iteration.
abstract final class MealsAppTheme {
  static ThemeData light() {
    return ThemeData(
      colorScheme: ColorScheme.fromSeed(seedColor: Colors.green),
      useMaterial3: true,
    );
  }
}
