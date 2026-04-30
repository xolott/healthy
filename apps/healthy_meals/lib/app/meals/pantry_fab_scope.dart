import 'package:flutter/material.dart';

/// Pantry shell scope: tab index for the FAB and revision ticks so catalog lists reload after creates.
///
/// Notifiers are owned by [MealsMainShell]; the catalog screen updates [tabIndexListenable] when tabs change.
class PantryFabScope extends InheritedWidget {
  const PantryFabScope({
    super.key,
    required this.tabIndexListenable,
    required this.foodCatalogRevision,
    required this.recipeCatalogRevision,
    required super.child,
  });

  final ValueNotifier<int> tabIndexListenable;
  final ValueNotifier<int> foodCatalogRevision;
  final ValueNotifier<int> recipeCatalogRevision;

  static PantryFabScope? maybeOf(BuildContext context) {
    return context.getInheritedWidgetOfExactType<PantryFabScope>();
  }

  @override
  bool updateShouldNotify(PantryFabScope oldWidget) =>
      oldWidget.tabIndexListenable != tabIndexListenable ||
      oldWidget.foodCatalogRevision != foodCatalogRevision ||
      oldWidget.recipeCatalogRevision != recipeCatalogRevision;
}
