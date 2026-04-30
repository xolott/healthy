import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:healthy_meals/app/meals/meals_food_log_day_screen.dart';
import 'package:healthy_meals/app/meals/meals_food_log_entry_composer_screen.dart';
import 'package:healthy_meals/app/meals/pantry_http.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test('FoodLogEntryListItem.tryParse accepts list wire shape', () {
    final row = FoodLogEntryListItem.tryParse({
      'id': 'a',
      'displayName': 'Oats',
      'calories': 150.0,
      'proteinGrams': 5,
      'fatGrams': 2.5,
      'carbohydratesGrams': 27,
      'consumedDate': '2026-04-29',
    });
    expect(row, isNotNull);
    expect(row!.displayName, 'Oats');
    expect(row.calories, 150.0);
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

    await tester.tap(find.text('Food'));
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
}
