import 'package:flutter_test/flutter_test.dart';
import 'package:healthy_meals/app/meals/pantry_catalog_helpers.dart';

void main() {
  test('pantrySearchMatches respects empty query', () {
    expect(pantrySearchMatches('', name: 'Apple', brand: null), isTrue);
  });

  test('pantrySearchMatches matches name and brand', () {
    expect(pantrySearchMatches('oat', name: 'Morning Oats'), isTrue);
    expect(
      pantrySearchMatches('mill', name: 'Oats', brand: 'Test Mill'),
      isTrue,
    );
    expect(pantrySearchMatches('zz', name: 'Apple'), isFalse);
  });

  test(
    'pantrySearchMatches with null brand does not match brand-only query (recipe tab parity)',
    () {
      expect(pantrySearchMatches('mill', name: 'Chili', brand: null), isFalse);
    },
  );

  test(
    'foodListCaloriesFromMetadata reads nutrients.calories for food metadata',
    () {
      expect(
        foodListCaloriesFromMetadata({
          'kind': 'food',
          'nutrients': {'calories': 190},
        }),
        190,
      );
      expect(foodListCaloriesFromMetadata(null), isNull);
      expect(foodListCaloriesFromMetadata({'kind': 'recipe'}), isNull);
    },
  );

  test(
    'recipeListCaloriesPerServingFromMetadata reads nutrientsPerServing.calories',
    () {
      expect(
        recipeListCaloriesPerServingFromMetadata({
          'kind': 'recipe',
          'nutrientsPerServing': {'calories': 212},
        }),
        212,
      );
      expect(recipeListCaloriesPerServingFromMetadata(null), isNull);
      expect(
        recipeListCaloriesPerServingFromMetadata({'kind': 'food'}),
        isNull,
      );
    },
  );

  test('pantryBrandFromMetadata returns trimmed brand string', () {
    expect(pantryBrandFromMetadata({'brand': '  Acme  '}), 'Acme');
    expect(pantryBrandFromMetadata({}), isNull);
  });

  test(
    'foodNutrientGramsFromMetadata reads protein carbohydrates fat columns',
    () {
      expect(
        foodNutrientGramsFromMetadata(<String, dynamic>{
          'kind': 'recipe',
          'nutrients': {'protein': 1},
        }, 'protein'),
        isNull,
      );

      expect(
        foodNutrientGramsFromMetadata(<String, dynamic>{
          'kind': 'food',
          'nutrients': {'protein': 7, 'fat': 3.25, 'carbohydrates': 31},
        }, 'protein'),
        7,
      );
      expect(
        foodNutrientGramsFromMetadata(<String, dynamic>{
          'kind': 'food',
          'nutrients': {'protein': 7, 'fat': 3.25, 'carbohydrates': 31},
        }, 'carbohydrates'),
        31,
      );
      expect(
        foodNutrientGramsFromMetadata(<String, dynamic>{
          'kind': 'food',
          'nutrients': {'protein': 7, 'fat': 3.25, 'carbohydrates': 31},
        }, 'fat'),
        closeTo(3.25, 0.001),
      );
    },
  );

  test('foodServingDescriptorFromMetadata prefers baseAmount over grams', () {
    expect(
      foodServingDescriptorFromMetadata(<String, dynamic>{
        'kind': 'food',
        'baseAmount': {'value': 100, 'unit': 'ml'},
        'baseAmountGrams': 103,
      }),
      'Per 100 ml',
    );
    expect(
      foodServingDescriptorFromMetadata(<String, dynamic>{
        'kind': 'food',
        'baseAmountGrams': 40,
      }),
      'Per 40 g',
    );
    expect(
      foodServingDescriptorFromMetadata(<String, dynamic>{'kind': 'recipe'}),
      isNull,
    );
  });
}
