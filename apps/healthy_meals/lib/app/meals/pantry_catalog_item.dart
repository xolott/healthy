import 'pantry_catalog_helpers.dart';

enum PantryCatalogItemType { food, recipe }

extension PantryCatalogItemTypeWire on PantryCatalogItemType {
  String get wireValue =>
      this == PantryCatalogItemType.food ? 'food' : 'recipe';
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
    this.ingredientIconKeys = const <String>[],
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

  /// Recipe list metadata: icons derived from ingredients; when empty, use
  /// [iconKey] for the leading tile icon.
  final List<String> ingredientIconKeys;
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
  if (parsedType == PantryCatalogItemType.food) {
    cal = foodListCaloriesFromMetadata(metaMap);
    protein = foodNutrientGramsFromMetadata(metaMap, 'protein');
    carbohydrates = foodNutrientGramsFromMetadata(metaMap, 'carbohydrates');
    fat = foodNutrientGramsFromMetadata(metaMap, 'fat');
    servingDescriptor = foodServingDescriptorFromMetadata(metaMap);
  } else {
    cal = recipeListCaloriesPerServingFromMetadata(metaMap);
    protein = recipeNutrientGramsFromMetadata(metaMap, 'protein');
    carbohydrates = recipeNutrientGramsFromMetadata(metaMap, 'carbohydrates');
    fat = recipeNutrientGramsFromMetadata(metaMap, 'fat');
    servingDescriptor = recipeServingDescriptorFromMetadata(metaMap);
    ingredientKeys = ingredientIconKeysFromRecipeMetadata(metaMap);
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
    ingredientIconKeys: ingredientKeys,
  );
}
