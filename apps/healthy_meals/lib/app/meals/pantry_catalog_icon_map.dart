import 'package:hugeicons/hugeicons.dart';

/// Maps stable Pantry [wirePantryIconKey] values from the API to stroke-rounded
/// Hugeicons glyphs. Unknown keys resolve to [_fallbackPantryHugeIcon].
List<List<dynamic>> pantryHugeIconStrokeData(String wirePantryIconKey) {
  switch (wirePantryIconKey) {
    case 'food_apple':
      return HugeIcons.strokeRoundedApple01;
    case 'food_banana':
      return HugeIcons.strokeRoundedBanana;
    case 'food_bread':
      return HugeIcons.strokeRoundedBread01;
    case 'food_bowl':
      return HugeIcons.strokeRoundedRiceBowl01;
    case 'food_carrot':
      return HugeIcons.strokeRoundedCarrot;
    case 'food_cheese':
      return HugeIcons.strokeRoundedCheese;
    case 'food_egg':
      return HugeIcons.strokeRoundedEgg;
    case 'food_fish':
      return HugeIcons.strokeRoundedFishFood;
    case 'food_meat':
      return HugeIcons.strokeRoundedSteak;
    case 'food_milk':
      return HugeIcons.strokeRoundedMilkCarton;
    case 'food_nut':
      return HugeIcons.strokeRoundedNut;
    case 'food_pepper':
      return HugeIcons.strokeRoundedTaco01;
    case 'recipe_pot':
      return HugeIcons.strokeRoundedPot01;
    case 'recipe_sauce':
      return HugeIcons.strokeRoundedHoney01;
    case 'recipe_soup':
      return HugeIcons.strokeRoundedRiceBowl02;
    default:
      return _fallbackPantryHugeIcon;
  }
}

/// Default glyph when the server sends a key the client does not map yet.
final List<List<dynamic>> _fallbackPantryHugeIcon =
    HugeIcons.strokeRoundedNaturalFood;
