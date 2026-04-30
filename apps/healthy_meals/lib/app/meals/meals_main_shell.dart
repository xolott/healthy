import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'meals_bottom_nav.dart';
import 'meals_shell_fab.dart';
import 'pantry_fab_scope.dart';

class MealsMainShell extends StatefulWidget {
  const MealsMainShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  State<MealsMainShell> createState() => _MealsMainShellState();
}

class _MealsMainShellState extends State<MealsMainShell> {
  late final ValueNotifier<int> _pantryCatalogTabIndex;
  late final ValueNotifier<int> _pantryFoodCatalogRevision;
  late final ValueNotifier<int> _pantryRecipeCatalogRevision;

  @override
  void initState() {
    super.initState();
    _pantryCatalogTabIndex = ValueNotifier(0);
    _pantryFoodCatalogRevision = ValueNotifier(0);
    _pantryRecipeCatalogRevision = ValueNotifier(0);
  }

  @override
  void dispose() {
    _pantryCatalogTabIndex.dispose();
    _pantryFoodCatalogRevision.dispose();
    _pantryRecipeCatalogRevision.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final navigationShell = widget.navigationShell;
    final index = navigationShell.currentIndex;
    return PantryFabScope(
      tabIndexListenable: _pantryCatalogTabIndex,
      foodCatalogRevision: _pantryFoodCatalogRevision,
      recipeCatalogRevision: _pantryRecipeCatalogRevision,
      child: Scaffold(
        body: navigationShell,
        floatingActionButton: index == 3
            ? null
            : AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                switchInCurve: Curves.easeInOut,
                switchOutCurve: Curves.easeInOut,
                transitionBuilder: (child, animation) =>
                    ScaleTransition(scale: animation, child: child),
                child: KeyedSubtree(
                  key: ValueKey<int>(index),
                  child: mealsShellFloatingActionButton(
                    context: context,
                    branchIndex: index,
                    goBranch: navigationShell.goBranch,
                    pantryTabListenable: _pantryCatalogTabIndex,
                    pantryFoodCatalogRevision: _pantryFoodCatalogRevision,
                    pantryRecipeCatalogRevision: _pantryRecipeCatalogRevision,
                  ),
                ),
              ),
        floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
        bottomNavigationBar: MealsBottomNav(
          currentIndex: index,
          onDestinationSelected: navigationShell.goBranch,
        ),
      ),
    );
  }
}
