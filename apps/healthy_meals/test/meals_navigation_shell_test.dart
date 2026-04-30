import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:healthy_meals/app/meals/meals_food_log_day_screen.dart';
import 'package:healthy_meals/app/meals/meals_main_shell.dart';
import 'package:healthy_meals/app/meals/meals_placeholder_screens.dart';
import 'package:healthy_meals/app/meals/pantry_catalog_screen.dart';
import 'package:healthy_meals/app/meals/pantry_http.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  testWidgets('bottom nav reaches real Pantry catalog tab', (
    WidgetTester tester,
  ) async {
    FlutterSecureStorage.setMockInitialValues({
      'healthy_session_token': 'nav-test-session',
      'healthy_api_base_url': 'https://nav-shell.test',
    });
    addTearDown(() {
      PantryHttp.client = http.Client();
    });

    PantryHttp.client = MockClient((request) async {
      final path = request.url.path;
      if (path.endsWith('/pantry/reference')) {
        return http.Response(
          jsonEncode({
            'nutrients': [
              {'key': 'calories', 'displayName': 'Calories'},
            ],
            'iconKeys': ['food_bowl'],
          }),
          200,
        );
      }
      if (path.endsWith('/pantry/items')) {
        return http.Response(jsonEncode({'items': <dynamic>[]}), 200);
      }
      return http.Response('not found', 404);
    });

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
                  builder: (context, state) => const MealsFoodLogDayScreen(),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/pantry',
                  builder: (context, state) => const MealsPantryCatalogScreen(),
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

    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('meals-nav-pantry')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('pantry-tab-food-top')), findsOneWidget);
    expect(find.byKey(const Key('pantry-food-empty')), findsOneWidget);
  });

  testWidgets('center plus selects Food Log branch', (
    WidgetTester tester,
  ) async {
    FlutterSecureStorage.setMockInitialValues({
      'healthy_session_token': 'fab-test-session',
      'healthy_api_base_url': 'https://fab-shell.test',
    });
    addTearDown(() {
      PantryHttp.client = http.Client();
    });

    PantryHttp.client = MockClient((request) async {
      final path = request.url.path;
      if (path.endsWith('/food-log/entries')) {
        return http.Response(jsonEncode({'entries': <dynamic>[]}), 200);
      }
      return http.Response('not found', 404);
    });

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
                  builder: (context, state) => const MealsFoodLogDayScreen(),
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

    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('meals-fab-food-log')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('food-log-empty-state')), findsOneWidget);

    await tester.tap(find.byTooltip('Close'));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('food-log-empty-state')), findsOneWidget);
  });
}
