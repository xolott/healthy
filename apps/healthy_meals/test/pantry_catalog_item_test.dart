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
}
