import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:healthy_meals/app/meals/meals_main_shell.dart';
import 'package:healthy_meals/app/meals/meals_placeholder_screens.dart';

void main() {
  testWidgets('bottom nav switches primary destinations', (WidgetTester tester) async {
    final router = GoRouter(
      initialLocation: '/home',
      routes: [
        StatefulShellRoute.indexedStack(
          builder: (context, state, navigationShell) {
            return MealsMainShell(navigationShell: navigationShell);
          },
          branches: [
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/home',
                  builder: (context, state) => const MealsHomePlaceholder(),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/food-log',
                  builder: (context, state) => const MealsFoodLogPlaceholder(),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/pantry',
                  builder: (context, state) => const MealsPantryPlaceholder(),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/progress',
                  builder: (context, state) => const MealsProgressPlaceholder(),
                ),
              ],
            ),
          ],
        ),
      ],
    );

    await tester.pumpWidget(
      MaterialApp.router(
        routerConfig: router,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Pantry catalog functionality will arrive'), findsNothing);

    await tester.tap(find.byKey(const Key('meals-nav-pantry')));
    await tester.pumpAndSettle();

    expect(find.textContaining('Pantry catalog functionality will arrive'), findsOneWidget);
  });

  testWidgets('center plus selects Food Log branch', (WidgetTester tester) async {
    final router = GoRouter(
      initialLocation: '/home',
      routes: [
        StatefulShellRoute.indexedStack(
          builder: (context, state, navigationShell) {
            return MealsMainShell(navigationShell: navigationShell);
          },
          branches: [
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/home',
                  builder: (context, state) => const MealsHomePlaceholder(),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/food-log',
                  builder: (context, state) => const MealsFoodLogPlaceholder(),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/pantry',
                  builder: (context, state) => const MealsPantryPlaceholder(),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/progress',
                  builder: (context, state) => const MealsProgressPlaceholder(),
                ),
              ],
            ),
          ],
        ),
      ],
    );

    await tester.pumpWidget(
      MaterialApp.router(
        routerConfig: router,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('meals-fab-food-log')));
    await tester.pumpAndSettle();

    expect(find.textContaining('Food logging will open from this destination'), findsOneWidget);
  });
}
