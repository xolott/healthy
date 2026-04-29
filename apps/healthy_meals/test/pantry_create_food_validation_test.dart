import 'package:flutter_test/flutter_test.dart';
import 'package:healthy_meals/app/meals/pantry_create_food_validation.dart';

void main() {
  test('validatePantryCreateFoodForm requires name', () {
    expect(
      validatePantryCreateFoodForm(
        name: '',
        baseAmountRaw: '100',
        caloriesRaw: '1',
        proteinRaw: '0',
        fatRaw: '0',
        carbohydratesRaw: '0',
        iconKey: 'food_apple',
      ),
      'Name is required.',
    );
  });

  test('validatePantryCreateFoodForm rejects non-positive base amount', () {
    expect(
      validatePantryCreateFoodForm(
        name: 'X',
        baseAmountRaw: '0',
        caloriesRaw: '1',
        proteinRaw: '0',
        fatRaw: '0',
        carbohydratesRaw: '0',
        iconKey: 'food_apple',
      ),
      'Base amount must be a positive number.',
    );
  });

  test('validatePantryCreateFoodForm accepts valid rows', () {
    expect(
      validatePantryCreateFoodForm(
        name: 'Oats',
        baseAmountRaw: '40',
        caloriesRaw: '150',
        proteinRaw: '5',
        fatRaw: '2',
        carbohydratesRaw: '25',
        iconKey: 'food_bowl',
      ),
      isNull,
    );
  });
}
