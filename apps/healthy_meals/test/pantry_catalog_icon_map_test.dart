import 'package:flutter_test/flutter_test.dart';
import 'package:healthy_meals/app/meals/pantry_catalog_icon_map.dart';
import 'package:hugeicons/hugeicons.dart';

void main() {
  test('maps canonical PANTRY_ICON_KEYS wires to Hugeicons stroke glyphs', () {
    expect(
      pantryHugeIconStrokeData('food_bowl'),
      same(HugeIcons.strokeRoundedRiceBowl01),
    );
    expect(
      pantryHugeIconStrokeData('recipe_pot'),
      same(HugeIcons.strokeRoundedPot01),
    );
  });

  test('unknown wire keys reuse the pantry fallback Hugeicon', () {
    expect(
      pantryHugeIconStrokeData('not_registered'),
      same(HugeIcons.strokeRoundedNaturalFood),
    );
  });
}
