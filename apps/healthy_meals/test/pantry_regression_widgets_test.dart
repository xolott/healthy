import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:healthy_meals/app/meals/pantry_catalog_screen.dart';
import 'package:healthy_meals/app/meals/pantry_create_recipe_screen.dart';
import 'package:healthy_meals/app/meals/pantry_food_detail_screen.dart';
import 'package:healthy_meals/app/meals/pantry_http.dart';
import 'package:healthy_meals/app/meals/pantry_recipe_detail_screen.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// Issue #90: widget-level Pantry regression with mocked HTTP + secure storage.
///
/// Full device integration against Postgres/API is not wired in CI for this app;
/// admin Playwright uses the real stack (`pnpm --filter admin test:e2e`).
void main() {
  const mockBase = 'https://api.pantry-regression.test';

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({
      'healthy_session_token': 'test-session',
      'healthy_api_base_url': mockBase,
    });
  });

  tearDown(() {
    PantryHttp.client = http.Client();
  });

  Map<String, dynamic> _foodItemWire(
    String id,
    String name,
    double calories,
  ) {
    return {
      'id': id,
      'name': name,
      'iconKey': 'food_bowl',
      'itemType': 'food',
      'metadata': {
        'kind': 'food',
        'baseAmountGrams': 50,
        'nutrients': {
          'calories': calories,
          'protein': 2,
          'fat': 1,
          'carbohydrates': 12,
        },
      },
    };
  }

  testWidgets('Pantry catalog: tabs and active-tab search', (tester) async {
    PantryHttp.client = MockClient((request) async {
      final path = request.url.path;
      if (path.endsWith('/pantry/reference')) {
        return http.Response(
          jsonEncode({
            'nutrients': [
              {'key': 'calories', 'displayName': 'Calories'},
            ],
            'iconKeys': ['food_bowl', 'recipe_pot'],
          }),
          200,
        );
      }
      if (path.endsWith('/pantry/items')) {
        final type = request.url.queryParameters['itemType'];
        if (type == 'food') {
          return http.Response(
            jsonEncode({
              'items': [
                _foodItemWire(
                  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                  'Apple',
                  95,
                ),
                _foodItemWire(
                  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                  'Banana',
                  102,
                ),
              ],
            }),
            200,
          );
        }
        if (type == 'recipe') {
          return http.Response(jsonEncode({'items': []}), 200);
        }
      }
      return http.Response('not found', 404);
    });

    await tester.pumpWidget(
      const MaterialApp(home: MealsPantryCatalogScreen()),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('pantry-catalog-health')), findsOneWidget);
    expect(find.text('Apple'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('pantry-items-search')), 'Bana');
    await tester.pump();
    expect(find.text('Apple'), findsNothing);
    expect(find.text('Banana'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('pantry-items-search')), 'zzz');
    await tester.pump();
    expect(find.byKey(const Key('pantry-search-no-matches')), findsOneWidget);

    await tester.tap(find.byKey(const Key('pantry-tab-recipes')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('pantry-empty')), findsOneWidget);
  });

  testWidgets('Pantry food detail loads GET /pantry/items/:id', (tester) async {
    PantryHttp.client = MockClient((request) async {
      final path = request.url.path;
      if (path.endsWith('/pantry/reference')) {
        return http.Response(jsonEncode({'servingUnits': <dynamic>[]}), 200);
      }
      if (path.endsWith('/pantry/items/food-detail-id')) {
        return http.Response(
          jsonEncode({
            'item': {
              'id': 'food-detail-id',
              'name': 'Test oats',
              'itemType': 'food',
              'metadata': {
                'kind': 'food',
                'baseAmountGrams': 40,
                'nutrients': {
                  'calories': 150,
                  'protein': 5,
                  'fat': 3,
                  'carbohydrates': 27,
                },
              },
            },
          }),
          200,
        );
      }
      return http.Response('not found', 404);
    });

    await tester.pumpWidget(
      const MaterialApp(home: MealsPantryFoodDetailScreen(itemId: 'food-detail-id')),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('150'), findsWidgets);
    expect(find.text('Test oats'), findsOneWidget);
  });

  testWidgets('Pantry recipe detail shows nested ingredient from wire', (tester) async {
    PantryHttp.client = MockClient((request) async {
      if (request.url.path.endsWith('/pantry/items/recipe-outer-id')) {
        return http.Response(
          jsonEncode({
            'item': {
              'id': 'recipe-outer-id',
              'name': 'Wrapped bowl',
              'iconKey': 'recipe_pot',
              'itemType': 'recipe',
              'metadata': {
                'kind': 'recipe',
                'servings': 1,
                'servingLabel': 'serving',
                'nutrients': {
                  'calories': 150,
                  'protein': 5,
                  'fat': 3,
                  'carbohydrates': 27,
                },
                'nutrientsPerServing': {
                  'calories': 150,
                  'protein': 5,
                  'fat': 3,
                  'carbohydrates': 27,
                },
              },
              'ingredients': [
                {
                  'displayName': 'Inner bowl',
                  'ingredientKind': 'recipe',
                  'quantity': 1,
                  'servingOption': {'kind': 'base'},
                },
              ],
            },
          }),
          200,
        );
      }
      return http.Response('not found', 404);
    });

    await tester.pumpWidget(
      const MaterialApp(
        home: MealsPantryRecipeDetailScreen(itemId: 'recipe-outer-id'),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('Inner bowl'), findsOneWidget);
    expect(find.textContaining('150'), findsWidgets);
  });

  testWidgets('Create recipe screen shows empty-catalog guidance', (tester) async {
    PantryHttp.client = MockClient((request) async {
      final path = request.url.path;
      if (path.endsWith('/pantry/reference')) {
        return http.Response(
          jsonEncode({'iconKeys': ['recipe_pot']}),
          200,
        );
      }
      if (path.endsWith('/pantry/items')) {
        return http.Response(jsonEncode({'items': <dynamic>[]}), 200);
      }
      return http.Response('not found', 404);
    });

    await tester.pumpWidget(
      const MaterialApp(home: MealsPantryCreateRecipeScreen()),
    );
    await tester.pumpAndSettle();

    expect(
      find.textContaining('Save at least one food or recipe in your pantry first.'),
      findsOneWidget,
    );
  });
}
