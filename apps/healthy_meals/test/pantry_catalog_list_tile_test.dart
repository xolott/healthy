import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:healthy_meals/app/meals/pantry_catalog_item.dart';
import 'package:healthy_meals/app/meals/pantry_catalog_list_tile.dart';

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

PantryCatalogItem _sampleRecipe({
  required String id,
  required String iconKey,
  List<String> ingredientIconKeys = const <String>[],
}) {
  return PantryCatalogItem(
    id: id,
    name: 'Chili bowl',
    iconKey: iconKey,
    itemType: PantryCatalogItemType.recipe,
    caloriesPerBase: 420,
    proteinGramsPerBase: 28,
    carbohydratesGramsPerBase: 40,
    fatGramsPerBase: 14,
    servingDescriptor: '1 plate',
    ingredientIconKeys: ingredientIconKeys,
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
            child: PantryCatalogListTile(
              item: _sampleFood('row-a', iconKey: 'food_bowl'),
              onTap: () {},
            ),
          ),
        ),
      ),
    );

    expect(find.textContaining('Morning Oats by Test Mill'), findsOneWidget);
    expect(find.text('190'), findsOneWidget);
    expect(find.text('7g P'), findsOneWidget);
    expect(find.text('32g C'), findsOneWidget);
    expect(find.text('3.5g F'), findsOneWidget);
    expect(find.text('Per 50 g'), findsOneWidget);
    expect(find.byType(HugeIcon), findsOneWidget);
    expect(find.byIcon(Icons.local_fire_department_outlined), findsOneWidget);
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
            child: PantryCatalogListTile(
              item: _sampleFood('row-b', iconKey: 'food_apple'),
              onTap: () => rowTaps++,
              onTrailingAddPressed: () => addTaps++,
            ),
          ),
        ),
      ),
    );

    await tester.tap(
      find.byKey(const ValueKey<String>('pantry-catalog-row-add-row-b')),
    );
    await tester.pump();
    expect(rowTaps, 0);
    expect(addTaps, 1);

    await tester.tap(find.textContaining('Morning Oats by Test Mill'));
    await tester.pump();
    expect(rowTaps, 1);
    expect(addTaps, 1);
  });

  testWidgets('Headline preserves source casing', (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PantryCatalogListTile(
            item: PantryCatalogItem(
              id: 'row-c',
              name: 'Greek yogurt',
              iconKey: 'food_bowl',
              itemType: PantryCatalogItemType.food,
              brand: 'Chobani',
              caloriesPerBase: 120,
              proteinGramsPerBase: 12,
              carbohydratesGramsPerBase: 4,
              fatGramsPerBase: 0,
              servingDescriptor: '170g cup',
            ),
            onTap: () {},
          ),
        ),
      ),
    );

    await tester.pump();
    expect(find.textContaining('Greek yogurt by Chobani'), findsOneWidget);
    expect(find.textContaining('GREEK YOGURT'), findsNothing);
  });

  testWidgets('Recipe row shows nutrition without food brand', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: PantryCatalogListTile(
              item: _sampleRecipe(id: 'rec-a', iconKey: 'recipe_pot'),
              onTap: () {},
            ),
          ),
        ),
      ),
    );

    expect(find.text('Chili bowl'), findsOneWidget);
    expect(find.text('420'), findsOneWidget);
    expect(find.text('28g P'), findsOneWidget);
    expect(find.text('40g C'), findsOneWidget);
    expect(find.text('14g F'), findsOneWidget);
    expect(find.text('1 plate'), findsOneWidget);
    expect(find.textContaining('by Test Mill'), findsNothing);
    expect(find.byType(HugeIcon), findsOneWidget);
  });
}
