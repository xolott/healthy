import 'package:flutter_test/flutter_test.dart';
import 'package:healthy_meals/app/meals/pantry_catalog_item.dart';

void main() {
  test('parsePantryCatalogItem reads recipe list metadata and omits brand', () {
    final item = parsePantryCatalogItem(<String, dynamic>{
      'id': 'rid',
      'name': 'Stew',
      'iconKey': 'recipe_pot',
      'itemType': 'recipe',
      'metadata': <String, dynamic>{
        'kind': 'recipe',
        'servings': 1,
        'servingLabel': 'plate',
        'nutrientsPerServing': <String, dynamic>{
          'calories': 300,
          'protein': 20,
          'fat': 12,
          'carbohydrates': 18,
        },
        'ingredientIconKeys': <String>['food_bowl', 'food_egg'],
        'brand': 'Should not show',
      },
    });

    expect(item, isNotNull);
    expect(item!.itemType, PantryCatalogItemType.recipe);
    expect(item.brand, isNull);
    expect(item.caloriesPerBase, 300);
    expect(item.proteinGramsPerBase, 20);
    expect(item.fatGramsPerBase, 12);
    expect(item.carbohydratesGramsPerBase, 18);
    expect(item.servingDescriptor, '1 plate');
    expect(item.ingredientIconKeys, <String>['food_bowl', 'food_egg']);
  });

  test('parsePantryCatalogItem recipe tolerates empty ingredientIconKeys', () {
    final item = parsePantryCatalogItem(<String, dynamic>{
      'id': 'r2',
      'name': 'Soup',
      'iconKey': 'recipe_soup',
      'itemType': 'recipe',
      'metadata': <String, dynamic>{
        'kind': 'recipe',
        'servings': 2,
        'servingLabel': 'serving',
        'nutrientsPerServing': <String, dynamic>{
          'calories': 100,
          'protein': 5,
          'fat': 2,
          'carbohydrates': 10,
        },
        'ingredientIconKeys': <String>[],
      },
    });

    expect(item!.ingredientIconKeys, isEmpty);
    expect(item.iconKey, 'recipe_soup');
    expect(item.servingDescriptor, '2 servings');
  });

  test(
    'parsePantryCatalogItem reads food servingOptions and baseAmountGrams',
    () {
      final item = parsePantryCatalogItem(<String, dynamic>{
        'id': 'f-bread',
        'name': 'Bread',
        'iconKey': 'food_bowl',
        'itemType': 'food',
        'metadata': <String, dynamic>{
          'kind': 'food',
          'nutrients': <String, dynamic>{
            'calories': 250,
            'protein': 9,
            'fat': 3,
            'carbohydrates': 45,
          },
          'baseAmountGrams': 100,
          'servingOptions': <Map<String, dynamic>>[
            {'kind': 'unit', 'unit': 'slice', 'grams': 50},
            {'kind': 'custom', 'label': 'half loaf', 'grams': 200},
          ],
        },
      });

      expect(item, isNotNull);
      expect(item!.baseAmountGrams, 100);
      expect(item.foodServingOptions, hasLength(2));
      expect(item.foodServingOptions[0], isA<FoodServingUnitPick>());
      expect(
        (item.foodServingOptions[0] as FoodServingUnitPick).unitKey,
        'slice',
      );
      expect(
        (item.foodServingOptions[0] as FoodServingUnitPick).gramsPerServing,
        50,
      );
      expect(item.foodServingOptions[1], isA<FoodServingCustomPick>());
      expect(
        (item.foodServingOptions[1] as FoodServingCustomPick).customLabel,
        'half loaf',
      );
    },
  );
}
