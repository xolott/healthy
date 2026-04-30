import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:healthy_meals/app/meals/pantry_catalog_item.dart';
import 'package:healthy_meals/app/meals/pantry_food_catalog_list_tile.dart';

PantryCatalogItem _sampleFood(String id, {required String iconKey}) {
  return PantryCatalogItem(
    id: id,
    name: 'Morning Oats',
    iconKey: iconKey,
    itemType: PantryCatalogItemType.food,
    brand: 'Test Mill',
    caloriesPerBase: 190,
    proteinGramsPerBase: 7,
    carbohydratesGramsPerBase: 32,
    fatGramsPerBase: 3.5,
    servingDescriptor: 'Per 50 g',
  );
}

void main() {
  testWidgets('Food pantry row shows headline nutrition and descriptor', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: PantryFoodCatalogListTile(
              item: _sampleFood('row-a', iconKey: 'food_bowl'),
              onTap: () {},
            ),
          ),
        ),
      ),
    );

    expect(find.text('Morning Oats'), findsOneWidget);
    expect(find.text('Test Mill'), findsOneWidget);
    expect(find.textContaining('190 kcal'), findsOneWidget);
    expect(find.textContaining('P 7g · C 32g · F 3.5g'), findsOneWidget);
    expect(find.text('Per 50 g'), findsOneWidget);
    expect(find.byType(HugeIcon), findsOneWidget);
    expect(find.byIcon(Icons.add), findsNothing);
  });

  testWidgets('Trailing add invokes only callback and not row tap', (
    WidgetTester tester,
  ) async {
    var rowTaps = 0;
    var addTaps = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: PantryFoodCatalogListTile(
              item: _sampleFood('row-b', iconKey: 'food_apple'),
              onTap: () => rowTaps++,
              onTrailingAddPressed: () => addTaps++,
            ),
          ),
        ),
      ),
    );

    await tester.tap(
      find.byKey(const ValueKey<String>('pantry-food-row-add-row-b')),
    );
    await tester.pump();
    expect(rowTaps, 0);
    expect(addTaps, 1);

    await tester.tap(find.text('Morning Oats'));
    await tester.pump();
    expect(rowTaps, 1);
    expect(addTaps, 1);
  });

  testWidgets('Fallback HugeIcon renders for unrecognized wire icon keys', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PantryFoodCatalogListTile(
            item: _sampleFood(
              'row-c',
              iconKey: '__unknown_stable_key_for_tests__',
            ),
            onTap: () {},
          ),
        ),
      ),
    );

    await tester.pump();
    expect(find.byType(HugeIcon), findsOneWidget);
    expect(find.text('Morning Oats'), findsOneWidget);
  });
}
