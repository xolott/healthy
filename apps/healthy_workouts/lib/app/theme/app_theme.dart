import 'package:flutter/material.dart';

abstract final class WorkoutsAppTheme {
  static ThemeData light() {
    return ThemeData(
      colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
      useMaterial3: true,
    );
  }
}
