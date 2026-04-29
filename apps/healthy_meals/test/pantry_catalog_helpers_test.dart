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

  test('pantryBrandFromMetadata returns trimmed brand string', () {
    expect(pantryBrandFromMetadata({'brand': '  Acme  '}), 'Acme');
    expect(pantryBrandFromMetadata({}), isNull);
  });
}
