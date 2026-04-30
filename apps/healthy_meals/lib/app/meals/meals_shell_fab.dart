import 'package:animations/animations.dart';
import 'package:flutter/material.dart';

import '../../core/navigation/meals_destinations.dart';
import 'meals_food_log_day_screen.dart';
import 'meals_food_log_entry_composer_screen.dart';
import 'meals_food_log_shell_sync.dart';
import 'pantry_create_food_screen.dart';
import 'pantry_create_recipe_screen.dart';

/// Extended FAB actions for the meals shell (branch + Pantry tab aware).
///
/// On Pantry, pass [pantryTabListenable] from the shell; the FAB [BuildContext]
/// is not a descendant of [PantryFabScope].
Widget mealsShellFloatingActionButton({
  required BuildContext context,
  required int branchIndex,
  required void Function(int index) goBranch,
  ValueNotifier<int>? pantryTabListenable,
  ValueNotifier<int>? pantryFoodCatalogRevision,
  ValueNotifier<int>? pantryRecipeCatalogRevision,
}) {
  final theme = Theme.of(context);
  final surface = theme.colorScheme.surface;

  if (branchIndex == 2) {
    final listenable = pantryTabListenable;
    if (listenable == null) {
      return const SizedBox.shrink();
    }
    return ListenableBuilder(
      listenable: listenable,
      builder: (context, _) {
        final tab = listenable.value;
        final isFoods = tab == 0;
        return OpenContainer<Object?>(
          key: ValueKey<String>('meals-fab-pantry-open-$tab'),
          transitionType: ContainerTransitionType.fadeThrough,
          transitionDuration: const Duration(milliseconds: 400),
          useRootNavigator: true,
          closedColor: surface,
          openColor: surface,
          middleColor: theme.colorScheme.surfaceContainerHighest,
          closedElevation: 4,
          openElevation: 0,
          closedShape: const StadiumBorder(),
          openShape: const RoundedRectangleBorder(),
          closedBuilder: (context, openContainer) {
            return FloatingActionButton.extended(
              key: ValueKey<String>('meals-fab-pantry-$tab'),
              onPressed: openContainer,
              icon: const Icon(Icons.add),
              label: Text(isFoods ? 'New Food' : 'New Recipe'),
            );
          },
          openBuilder: (context, closeContainer) {
            return isFoods
                ? MealsPantryCreateFoodScreen(
                    onDone: () => closeContainer(returnValue: true),
                  )
                : MealsPantryCreateRecipeScreen(
                    onDone: () => closeContainer(returnValue: true),
                  );
          },
          onClosed: (data) {
            if (data != true) {
              return;
            }
            if (isFoods) {
              pantryFoodCatalogRevision?.value++;
            } else {
              pantryRecipeCatalogRevision?.value++;
            }
          },
        );
      },
    );
  }

  final openedFromHome = branchIndex == 0;
  final openedFromFoodLog = branchIndex == 1;

  return OpenContainer<Object?>(
    key: const Key('meals-fab-journal-open-container'),
    transitionType: ContainerTransitionType.fadeThrough,
    transitionDuration: const Duration(milliseconds: 400),
    useRootNavigator: true,
    closedColor: surface,
    openColor: surface,
    middleColor: theme.colorScheme.surfaceContainerHighest,
    closedElevation: 4,
    openElevation: 0,
    closedShape: const StadiumBorder(),
    openShape: const RoundedRectangleBorder(),
    closedBuilder: (context, openContainer) {
      return FloatingActionButton.extended(
        key: const Key('meals-fab-food-log'),
        onPressed: openContainer,
        icon: const Icon(Icons.add),
        label: const Text('New entry'),
      );
    },
    openBuilder: (context, closeContainer) {
      if (openedFromFoodLog) {
        return MealsFoodLogEntryComposerScreen(
          onDone: () => closeContainer(returnValue: true),
        );
      }
      return _JournalFabOpenPage(openedFromHome: openedFromHome);
    },
    onClosed: (data) {
      if (openedFromHome) {
        goBranch(1);
      }
      if (openedFromFoodLog && data == true) {
        mealsFoodLogDayRefreshSignal.value++;
      }
    },
  );
}

class _JournalFabOpenPage extends StatelessWidget {
  const _JournalFabOpenPage({required this.openedFromHome});

  final bool openedFromHome;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.close),
          tooltip: 'Close',
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          openedFromHome ? MealsDestinations.foodLogLabel : 'New entry',
        ),
      ),
      body: openedFromHome
          ? const MealsFoodLogDayScreen(syncFabDay: false)
          : Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'Food log entry composer is not available yet.',
                  textAlign: TextAlign.center,
                ),
              ),
            ),
    );
  }
}
