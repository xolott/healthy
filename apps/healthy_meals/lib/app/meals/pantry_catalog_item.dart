import 'pantry_catalog_helpers.dart';

enum PantryCatalogItemType { food, recipe }

extension PantryCatalogItemTypeWire on PantryCatalogItemType {
  String get wireValue =>
      this == PantryCatalogItemType.food ? 'food' : 'recipe';
}

/// A selectable predefined or custom pantry serving for Food logging/composer UI.
sealed class FoodServingOptionPick {
  const FoodServingOptionPick({required this.gramsPerServing});

  final double gramsPerServing;

  Map<String, dynamic> toServingOptionWire();

  /// Short label shown in serving dropdowns (unit key or custom label).
  String get pickerDisplayLabel;
}

final class FoodServingUnitPick extends FoodServingOptionPick {
  const FoodServingUnitPick({
    required super.gramsPerServing,
    required this.unitKey,
  });

  final String unitKey;

  @override
  Map<String, dynamic> toServingOptionWire() => <String, dynamic>{
    'kind': 'unit',
    'unit': unitKey,
  };

  @override
  String get pickerDisplayLabel => unitKey;
}

final class FoodServingCustomPick extends FoodServingOptionPick {
  const FoodServingCustomPick({
    required super.gramsPerServing,
    required this.customLabel,
  });

  final String customLabel;

  @override
  Map<String, dynamic> toServingOptionWire() => <String, dynamic>{
    'kind': 'custom',
    'label': customLabel,
  };

  @override
  String get pickerDisplayLabel => customLabel;
}

class PantryCatalogItem {
  const PantryCatalogItem({
    required this.id,
    required this.name,
    required this.iconKey,
    required this.itemType,
    this.brand,
    this.caloriesPerBase,
    this.proteinGramsPerBase,
    this.carbohydratesGramsPerBase,
    this.fatGramsPerBase,
    this.servingDescriptor,
    this.baseAmountGrams,
    this.ingredientIconKeys = const <String>[],
    this.foodServingOptions = const <FoodServingOptionPick>[],
    this.recipeYieldCalories,
    this.recipeYieldProteinGrams,
    this.recipeYieldCarbohydratesGrams,
    this.recipeYieldFatGrams,
    this.recipeServingLabel,
  });

  final String id;
  final String name;
  final String iconKey;
  final PantryCatalogItemType itemType;
  final String? brand;
  final double? caloriesPerBase;
  final double? proteinGramsPerBase;
  final double? carbohydratesGramsPerBase;
  final double? fatGramsPerBase;
  final String? servingDescriptor;

  /// Food metadata [baseAmountGrams]; used to scale nutrients for serving picks.
  final double? baseAmountGrams;

  /// Recipe list metadata: icons derived from ingredients; when empty, use
  /// [iconKey] for the leading tile icon.
  final List<String> ingredientIconKeys;

  /// Non-empty when this food defines optional serving sizes (unit/custom).
  final List<FoodServingOptionPick> foodServingOptions;

  /// Recipe full-yield totals from `metadata.nutrients` (one batch).
  final double? recipeYieldCalories;
  final double? recipeYieldProteinGrams;
  final double? recipeYieldCarbohydratesGrams;
  final double? recipeYieldFatGrams;

  /// Recipe `metadata.servingLabel`, e.g. bowlful; defaults in wire data to "serving".
  final String? recipeServingLabel;
}

({double cal, double protein, double carbs, double fat})?
_recipeYieldNutrientsFromMetadata(Map<String, dynamic>? metadata) {
  if (metadata == null || metadata['kind'] != 'recipe') {
    return null;
  }
  final nutrients = metadata['nutrients'];
  if (nutrients is! Map<String, dynamic>) {
    return null;
  }
  final cal = nutrients['calories'];
  final protein = nutrients['protein'];
  final fat = nutrients['fat'];
  final carb = nutrients['carbohydrates'];
  if (cal is! num || protein is! num || fat is! num || carb is! num) {
    return null;
  }
  return (
    cal: cal.toDouble(),
    protein: protein.toDouble(),
    carbs: carb.toDouble(),
    fat: fat.toDouble(),
  );
}

String? _recipeServingLabelFromMetadata(Map<String, dynamic>? metadata) {
  if (metadata == null || metadata['kind'] != 'recipe') {
    return null;
  }
  final raw = metadata['servingLabel'];
  if (raw is String && raw.trim().isNotEmpty) {
    return raw.trim();
  }
  return 'serving';
}

List<FoodServingOptionPick> _foodServingPicksFromMetadata(
  Map<String, dynamic>? metadata,
) {
  if (metadata == null || metadata['kind'] != 'food') {
    return const <FoodServingOptionPick>[];
  }
  final raw = metadata['servingOptions'];
  if (raw is! List<dynamic>) {
    return const <FoodServingOptionPick>[];
  }
  final out = <FoodServingOptionPick>[];
  for (final e in raw) {
    if (e is! Map) {
      continue;
    }
    final x = Map<String, dynamic>.from(e);
    final kind = x['kind'];
    final grams = x['grams'];
    if (grams is! num) {
      continue;
    }
    final g = grams.toDouble();
    if (g <= 0 || !g.isFinite) {
      continue;
    }
    if (kind == 'unit' && x['unit'] is String) {
      final u = (x['unit'] as String).trim();
      if (u.isEmpty) {
        continue;
      }
      out.add(FoodServingUnitPick(gramsPerServing: g, unitKey: u));
    } else if (kind == 'custom' && x['label'] is String) {
      final l = (x['label'] as String).trim();
      if (l.isEmpty) {
        continue;
      }
      out.add(FoodServingCustomPick(gramsPerServing: g, customLabel: l));
    }
  }
  return out;
}

double? _foodBaseAmountGramsFromMetadata(Map<String, dynamic>? metadata) {
  if (metadata == null || metadata['kind'] != 'food') {
    return null;
  }
  final g = metadata['baseAmountGrams'];
  if (g is num) {
    final v = g.toDouble();
    if (v > 0 && v.isFinite) {
      return v;
    }
  }
  return null;
}

PantryCatalogItem? parsePantryCatalogItem(dynamic e) {
  if (e is! Map<String, dynamic>) {
    return null;
  }
  final id = e['id'];
  final name = e['name'];
  final iconKey = e['iconKey'];
  final itemType = e['itemType'];
  final rawMeta = e['metadata'];
  Map<String, dynamic>? metaMap;
  if (rawMeta is Map<String, dynamic>) {
    metaMap = rawMeta;
  } else if (rawMeta is Map) {
    metaMap = Map<String, dynamic>.from(rawMeta);
  }
  if (id is! String ||
      name is! String ||
      iconKey is! String ||
      itemType is! String) {
    return null;
  }
  final parsedType = itemType == 'food'
      ? PantryCatalogItemType.food
      : itemType == 'recipe'
      ? PantryCatalogItemType.recipe
      : null;
  if (parsedType == null) {
    return null;
  }

  double? cal;
  double? protein;
  double? carbohydrates;
  double? fat;
  String? servingDescriptor;
  var ingredientKeys = const <String>[];
  double? baseAmountGrams;
  var foodServings = const <FoodServingOptionPick>[];
  double? recipeYieldCal;
  double? recipeYieldProtein;
  double? recipeYieldCarbs;
  double? recipeYieldFat;
  String? recipeServingLabel;
  if (parsedType == PantryCatalogItemType.food) {
    cal = foodListCaloriesFromMetadata(metaMap);
    protein = foodNutrientGramsFromMetadata(metaMap, 'protein');
    carbohydrates = foodNutrientGramsFromMetadata(metaMap, 'carbohydrates');
    fat = foodNutrientGramsFromMetadata(metaMap, 'fat');
    servingDescriptor = foodServingDescriptorFromMetadata(metaMap);
    baseAmountGrams = _foodBaseAmountGramsFromMetadata(metaMap);
    foodServings = _foodServingPicksFromMetadata(metaMap);
  } else {
    cal = recipeListCaloriesPerServingFromMetadata(metaMap);
    protein = recipeNutrientGramsFromMetadata(metaMap, 'protein');
    carbohydrates = recipeNutrientGramsFromMetadata(metaMap, 'carbohydrates');
    fat = recipeNutrientGramsFromMetadata(metaMap, 'fat');
    servingDescriptor = recipeServingDescriptorFromMetadata(metaMap);
    ingredientKeys = ingredientIconKeysFromRecipeMetadata(metaMap);
    final y = _recipeYieldNutrientsFromMetadata(metaMap);
    if (y != null) {
      recipeYieldCal = y.cal;
      recipeYieldProtein = y.protein;
      recipeYieldCarbs = y.carbs;
      recipeYieldFat = y.fat;
    }
    recipeServingLabel = _recipeServingLabelFromMetadata(metaMap);
  }

  return PantryCatalogItem(
    id: id,
    name: name,
    iconKey: iconKey,
    itemType: parsedType,
    brand: parsedType == PantryCatalogItemType.food
        ? pantryBrandFromMetadata(metaMap)
        : null,
    caloriesPerBase: cal,
    proteinGramsPerBase: protein,
    carbohydratesGramsPerBase: carbohydrates,
    fatGramsPerBase: fat,
    servingDescriptor: servingDescriptor,
    baseAmountGrams: baseAmountGrams,
    ingredientIconKeys: ingredientKeys,
    foodServingOptions: foodServings,
    recipeYieldCalories: recipeYieldCal,
    recipeYieldProteinGrams: recipeYieldProtein,
    recipeYieldCarbohydratesGrams: recipeYieldCarbs,
    recipeYieldFatGrams: recipeYieldFat,
    recipeServingLabel: recipeServingLabel,
  );
}
