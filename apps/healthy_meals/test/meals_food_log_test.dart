import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:healthy_meals/app/meals/meals_food_log_day_screen.dart';
import 'package:healthy_meals/app/meals/meals_food_log_entry_composer_screen.dart';
import 'package:healthy_meals/app/meals/meals_food_log_shell_sync.dart';
import 'package:healthy_meals/app/meals/pantry_http.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:intl/intl.dart';

void main() {
  test(
    'FoodLogEntryListItem.tryParse accepts entries with snapshot fields',
    () {
      final row = FoodLogEntryListItem.tryParse(<String, dynamic>{
        'id': 'a',
        'displayName': 'Oats',
        'iconKey': 'food_bowl',
        'calories': 150.0,
        'proteinGrams': 5,
        'fatGrams': 2.5,
        'carbohydratesGrams': 27,
        'consumedAt': '2026-04-29T14:30:00.000Z',
        'consumedDate': '2026-04-29',
        'quantity': 1.5,
        'servingOption': <String, dynamic>{'kind': 'unit', 'unit': 'cup'},
      });
      expect(row, isNotNull);
      expect(row!.displayName, 'Oats');
      expect(row.iconKey, 'food_bowl');
      expect(row.calories, 150.0);
      expect(row.quantity, 1.5);
      expect(row.consumedServingSummaryLine, '1.5 × cup');
    },
  );

  testWidgets('Food Log day screen renders entries on hourly timeline', (
    WidgetTester tester,
  ) async {
    FlutterSecureStorage.setMockInitialValues({
      'healthy_session_token': 'timeline-test',
      'healthy_api_base_url': 'https://foodlog.example',
    });
    addTearDown(() {
      PantryHttp.client = http.Client();
    });

    PantryHttp.client = MockClient((request) async {
      if (request.method == 'GET' &&
          request.url.path.endsWith('/food-log/entries')) {
        return http.Response(
          jsonEncode({
            'entries': [
              {
                'id': 'entry-1',
                'displayName': 'Greek Yogurt',
                'iconKey': 'food_bowl',
                'calories': 240,
                'proteinGrams': 20,
                'fatGrams': 8,
                'carbohydratesGrams': 16,
                'consumedAt': '2026-04-29T07:23:00.000Z',
                'consumedDate': '2026-04-29',
                'quantity': 2,
                'servingOption': {'kind': 'base'},
              },
            ],
          }),
          200,
        );
      }
      return http.Response('not found', 404);
    });

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: MealsFoodLogDayScreen(syncFabDay: false)),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Greek Yogurt'), findsOneWidget);
    expect(find.text('240'), findsOneWidget);
    expect(find.text('20P'), findsOneWidget);
    expect(find.text('16C'), findsOneWidget);
    expect(find.text('8F'), findsOneWidget);
  });

  testWidgets('composer POSTs batch with base serving and pops on 201', (
    WidgetTester tester,
  ) async {
    FlutterSecureStorage.setMockInitialValues({
      'healthy_session_token': 'composer-test',
      'healthy_api_base_url': 'https://composer.test',
    });
    addTearDown(() {
      PantryHttp.client = http.Client();
    });

    String? capturedBody;
    PantryHttp.client = MockClient((request) async {
      if (request.url.path.endsWith('/pantry/items') &&
          request.method == 'GET') {
        final t = request.url.queryParameters['itemType'];
        if (t == 'recipe') {
          return http.Response(jsonEncode({'items': <dynamic>[]}), 200);
        }
        return http.Response(
          jsonEncode({
            'items': [
              {
                'id': 'food-uuid-1',
                'name': 'Test Food',
                'iconKey': 'food_bowl',
                'itemType': 'food',
                'metadata': {
                  'kind': 'food',
                  'nutrients': {
                    'calories': 100,
                    'protein': 3,
                    'carbohydrates': 20,
                    'fat': 1,
                  },
                  'baseAmountGrams': 100,
                },
              },
            ],
          }),
          200,
        );
      }
      if (request.url.path.endsWith('/food-log/entries/batch') &&
          request.method == 'POST') {
        capturedBody = request.body;
        return http.Response(
          jsonEncode({
            'entries': [
              {
                'id': 'log-1',
                'pantryItemId': 'food-uuid-1',
                'displayName': 'Test Food',
                'calories': 200,
                'proteinGrams': 6,
                'fatGrams': 2,
                'carbohydratesGrams': 40,
                'consumedDate': '2026-04-29',
                'quantity': 2,
                'servingOption': {'kind': 'base'},
              },
            ],
          }),
          201,
        );
      }
      return http.Response('not found', 404);
    });

    var done = false;
    await tester.pumpWidget(
      MaterialApp(
        home: MealsFoodLogEntryComposerScreen(onDone: () => done = true),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Food or recipe'));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('food-log-food-picker')), findsOneWidget);
    await tester.tap(find.text('Test Food'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Test Food'), findsWidgets);

    await tester.enterText(
      find.byKey(const Key('food-log-composer-quantity')),
      '2',
    );
    await tester.pump();

    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    expect(done, isTrue);
    expect(capturedBody, isNotNull);
    final decoded = jsonDecode(capturedBody!) as Map<String, dynamic>;
    expect(decoded['consumedDate'], isA<String>());
    expect(decoded['consumedAt'], isA<String>());
    final entries = decoded['entries'] as List<dynamic>;
    expect(entries, hasLength(1));
    final e0 = entries.first as Map<String, dynamic>;
    expect(e0['pantryItemId'], 'food-uuid-1');
    expect(e0['quantity'], 2);
    expect(e0['servingOption'], {'kind': 'base'});
  });

  testWidgets(
    'composer POSTs predefined unit serving when food has servingOptions',
    (WidgetTester tester) async {
      FlutterSecureStorage.setMockInitialValues({
        'healthy_session_token': 'composer-test',
        'healthy_api_base_url': 'https://composer.test',
      });
      addTearDown(() {
        PantryHttp.client = http.Client();
      });

      String? capturedBody;
      PantryHttp.client = MockClient((request) async {
        if (request.url.path.endsWith('/pantry/items') &&
            request.method == 'GET') {
          final t = request.url.queryParameters['itemType'];
          if (t == 'recipe') {
            return http.Response(jsonEncode({'items': <dynamic>[]}), 200);
          }
          return http.Response(
            jsonEncode({
              'items': [
                {
                  'id': 'food-opt-1',
                  'name': 'Sliced Bread',
                  'iconKey': 'food_bowl',
                  'itemType': 'food',
                  'metadata': {
                    'kind': 'food',
                    'nutrients': {
                      'calories': 200,
                      'protein': 8,
                      'carbohydrates': 38,
                      'fat': 2,
                    },
                    'baseAmountGrams': 100,
                    'servingOptions': [
                      {'kind': 'unit', 'unit': 'slice', 'grams': 40},
                      {'kind': 'custom', 'label': 'heel', 'grams': 35},
                    ],
                  },
                },
              ],
            }),
            200,
          );
        }
        if (request.url.path.endsWith('/food-log/entries/batch') &&
            request.method == 'POST') {
          capturedBody = request.body;
          return http.Response(
            jsonEncode({
              'entries': [
                {
                  'id': 'log-2',
                  'pantryItemId': 'food-opt-1',
                  'displayName': 'Sliced Bread',
                  'calories': 100,
                  'proteinGrams': 4,
                  'fatGrams': 1,
                  'carbohydratesGrams': 19,
                  'consumedDate': '2026-04-29',
                  'quantity': 3,
                  'servingOption': {'kind': 'unit', 'unit': 'slice'},
                },
              ],
            }),
            201,
          );
        }
        return http.Response('not found', 404);
      });

      var done = false;
      await tester.pumpWidget(
        MaterialApp(
          home: MealsFoodLogEntryComposerScreen(onDone: () => done = true),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Food or recipe'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Sliced Bread'));
      await tester.pumpAndSettle();

      expect(
        find.byKey(const Key('food-log-composer-serving')),
        findsOneWidget,
      );
      await tester.enterText(
        find.byKey(const Key('food-log-composer-quantity')),
        '',
      );
      await tester.pump();
      await tester.enterText(
        find.byKey(const Key('food-log-composer-quantity')),
        '3',
      );
      await tester.pump();
      await tester.pumpAndSettle();

      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();

      expect(done, isTrue);
      expect(capturedBody, isNotNull);
      final decoded = jsonDecode(capturedBody!) as Map<String, dynamic>;
      final entries = decoded['entries'] as List<dynamic>;
      final e0 = entries.first as Map<String, dynamic>;
      expect(e0['pantryItemId'], 'food-opt-1');
      expect(e0['quantity'], 3);
      expect(e0['servingOption'], {'kind': 'unit', 'unit': 'slice'});
    },
  );

  testWidgets(
    'composer logs recipe with full-yield serving and POSTs base serving',
    (WidgetTester tester) async {
      FlutterSecureStorage.setMockInitialValues({
        'healthy_session_token': 'composer-test',
        'healthy_api_base_url': 'https://composer.test',
      });
      addTearDown(() {
        PantryHttp.client = http.Client();
      });

      String? capturedBody;
      PantryHttp.client = MockClient((request) async {
        if (request.url.path.endsWith('/pantry/items') &&
            request.method == 'GET') {
          final t = request.url.queryParameters['itemType'];
          if (t == 'recipe') {
            return http.Response(
              jsonEncode({
                'items': [
                  {
                    'id': 'recipe-uuid-1',
                    'name': 'Chili',
                    'iconKey': 'food_bowl',
                    'itemType': 'recipe',
                    'metadata': {
                      'kind': 'recipe',
                      'servings': 2,
                      'servingLabel': 'bowl',
                      'nutrients': {
                        'calories': 400,
                        'protein': 20,
                        'fat': 10,
                        'carbohydrates': 40,
                      },
                      'nutrientsPerServing': {
                        'calories': 200,
                        'protein': 10,
                        'fat': 5,
                        'carbohydrates': 20,
                      },
                    },
                  },
                ],
              }),
              200,
            );
          }
          return http.Response(jsonEncode({'items': <dynamic>[]}), 200);
        }
        if (request.url.path.endsWith('/food-log/entries/batch') &&
            request.method == 'POST') {
          capturedBody = request.body;
          return http.Response(
            jsonEncode({
              'entries': [
                {
                  'id': 'log-r1',
                  'pantryItemId': 'recipe-uuid-1',
                  'displayName': 'Chili',
                  'calories': 400,
                  'proteinGrams': 20,
                  'fatGrams': 10,
                  'carbohydratesGrams': 40,
                  'consumedDate': '2026-04-29',
                  'quantity': 1,
                  'servingOption': {'kind': 'base'},
                },
              ],
            }),
            201,
          );
        }
        return http.Response('not found', 404);
      });

      var done = false;
      await tester.pumpWidget(
        MaterialApp(
          home: MealsFoodLogEntryComposerScreen(onDone: () => done = true),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Food or recipe'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Recipes'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Chili'));
      await tester.pumpAndSettle();

      expect(
        find.byKey(const Key('food-log-composer-serving')),
        findsOneWidget,
      );

      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();

      expect(done, isTrue);
      expect(capturedBody, isNotNull);
      final decoded = jsonDecode(capturedBody!) as Map<String, dynamic>;
      final entries = decoded['entries'] as List<dynamic>;
      final e0 = entries.first as Map<String, dynamic>;
      expect(e0['pantryItemId'], 'recipe-uuid-1');
      expect(e0['quantity'], 1);
      expect(e0['servingOption'], {'kind': 'base'});
    },
  );

  testWidgets('composer batches multiple added drafts in one POST', (
    WidgetTester tester,
  ) async {
    FlutterSecureStorage.setMockInitialValues({
      'healthy_session_token': 'composer-batch-test',
      'healthy_api_base_url': 'https://composer.test',
    });
    addTearDown(() {
      PantryHttp.client = http.Client();
    });

    String? capturedBody;
    PantryHttp.client = MockClient((request) async {
      if (request.url.path.endsWith('/pantry/items') &&
          request.method == 'GET') {
        final t = request.url.queryParameters['itemType'];
        if (t == 'recipe') {
          return http.Response(jsonEncode({'items': <dynamic>[]}), 200);
        }
        return http.Response(
          jsonEncode({
            'items': [
              {
                'id': 'food-uuid-a',
                'name': 'First Food',
                'iconKey': 'food_bowl',
                'itemType': 'food',
                'metadata': {
                  'kind': 'food',
                  'nutrients': {
                    'calories': 100,
                    'protein': 3,
                    'carbohydrates': 20,
                    'fat': 1,
                  },
                  'baseAmountGrams': 100,
                },
              },
              {
                'id': 'food-uuid-b',
                'name': 'Second Food',
                'iconKey': 'food_bowl',
                'itemType': 'food',
                'metadata': {
                  'kind': 'food',
                  'nutrients': {
                    'calories': 50,
                    'protein': 2,
                    'carbohydrates': 10,
                    'fat': 0.5,
                  },
                  'baseAmountGrams': 50,
                },
              },
            ],
          }),
          200,
        );
      }
      if (request.url.path.endsWith('/food-log/entries/batch') &&
          request.method == 'POST') {
        capturedBody = request.body;
        return http.Response(
          jsonEncode({
            'entries': [
              {'id': 'a', 'pantryItemId': 'food-uuid-a'},
              {'id': 'b', 'pantryItemId': 'food-uuid-b'},
            ],
          }),
          201,
        );
      }
      return http.Response('not found', 404);
    });

    var done = false;
    await tester.pumpWidget(
      MaterialApp(
        home: MealsFoodLogEntryComposerScreen(onDone: () => done = true),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Food or recipe'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('First Food'));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('food-log-composer-add-to-meal')));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Add food or recipe'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Second Food'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    expect(done, isTrue);
    expect(capturedBody, isNotNull);
    final decoded = jsonDecode(capturedBody!) as Map<String, dynamic>;
    final entries = decoded['entries'] as List<dynamic>;
    expect(entries, hasLength(2));
    expect((entries[0] as Map<String, dynamic>)['pantryItemId'], 'food-uuid-a');
    expect((entries[1] as Map<String, dynamic>)['pantryItemId'], 'food-uuid-b');
  });

  testWidgets(
    'Food Log day screen refetches when selecting a day and returning today',
    (WidgetTester tester) async {
      DateTime dateOnly(DateTime d) => DateTime(d.year, d.month, d.day);

      FlutterSecureStorage.setMockInitialValues({
        'healthy_session_token': 'day-nav-test',
        'healthy_api_base_url': 'https://foodlog.example',
      });
      addTearDown(() {
        PantryHttp.client = http.Client();
        mealsFoodLogSelectedDayNotifier.value = dateOnly(DateTime.now());
        mealsFoodLogDayRefreshSignal.value = 0;
      });

      final requestedDates = <String>[];
      PantryHttp.client = MockClient((request) async {
        if (request.method == 'GET' &&
            request.url.path.endsWith('/food-log/entries')) {
          final d = request.url.queryParameters['date'];
          if (d != null) {
            requestedDates.add(d);
          }
          return http.Response(jsonEncode({'entries': <dynamic>[]}), 200);
        }
        return http.Response('not found', 404);
      });

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(body: MealsFoodLogDayScreen(syncFabDay: false)),
        ),
      );
      await tester.pumpAndSettle();

      expect(requestedDates, hasLength(1));
      final today = dateOnly(DateTime.now());
      expect(requestedDates.single, DateFormat('yyyy-MM-dd').format(today));

      final tomorrow = today.add(const Duration(days: 1));
      await tester.tap(find.text('${tomorrow.day}').first);
      await tester.pumpAndSettle();

      expect(requestedDates, hasLength(2));
      expect(requestedDates[1], DateFormat('yyyy-MM-dd').format(tomorrow));

      await tester.tap(find.text('Today'));
      await tester.pumpAndSettle();

      expect(requestedDates, hasLength(3));
      expect(requestedDates[2], DateFormat('yyyy-MM-dd').format(today));
    },
  );
}
