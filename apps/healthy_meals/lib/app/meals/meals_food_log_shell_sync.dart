import 'package:flutter/foundation.dart';

DateTime _dateOnly(DateTime d) => DateTime(d.year, d.month, d.day);

/// Calendar day shown on Food Log; drives the FAB composer default date.
///
/// Updated by [MealsFoodLogDayScreen] when [MealsFoodLogDayScreen.syncFabDay]
/// is true.
final ValueNotifier<DateTime> mealsFoodLogSelectedDayNotifier = ValueNotifier(
  _dateOnly(DateTime.now()),
);

/// Increment after a successful save from the Food Log composer so the day
/// view refetches.
final ValueNotifier<int> mealsFoodLogDayRefreshSignal = ValueNotifier(0);
