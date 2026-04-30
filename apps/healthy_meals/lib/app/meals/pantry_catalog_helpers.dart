// Pure helpers for Pantry catalog search and Food row fields from list API metadata.

bool pantrySearchMatches(String query, {required String name, String? brand}) {
  final q = query.trim().toLowerCase();
  if (q.isEmpty) {
    return true;
  }
  if (name.toLowerCase().contains(q)) {
    return true;
  }
  if (brand != null && brand.toLowerCase().contains(q)) {
    return true;
  }
  return false;
}

String? pantryBrandFromMetadata(Map<String, dynamic>? metadata) {
  if (metadata == null) {
    return null;
  }
  final b = metadata['brand'];
  if (b is String && b.trim().isNotEmpty) {
    return b.trim();
  }
  return null;
}

double? foodListCaloriesFromMetadata(Map<String, dynamic>? metadata) {
  if (metadata == null) {
    return null;
  }
  if (metadata['kind'] != 'food') {
    return null;
  }
  final nutrients = metadata['nutrients'];
  if (nutrients is! Map<String, dynamic>) {
    return null;
  }
  final cal = nutrients['calories'];
  if (cal is num) {
    return cal.toDouble();
  }
  return null;
}

double? foodNutrientGramsFromMetadata(
  Map<String, dynamic>? metadata,
  String nutrientWireKey,
) {
  if (metadata == null || metadata['kind'] != 'food') {
    return null;
  }
  final nutrients = metadata['nutrients'];
  if (nutrients is! Map<String, dynamic>) {
    return null;
  }
  final v = nutrients[nutrientWireKey];
  if (v is num) {
    return v.toDouble();
  }
  return null;
}

/// Human-readable nutrient base (matches list [nutrients]) from [baseAmount] or
/// [baseAmountGrams].
String? foodServingDescriptorFromMetadata(Map<String, dynamic>? metadata) {
  if (metadata == null || metadata['kind'] != 'food') {
    return null;
  }
  final base = metadata['baseAmount'];
  if (base is Map) {
    final m = Map<String, dynamic>.from(base);
    final rawV = m['value'];
    final unitRaw = m['unit'];
    if (rawV is num && unitRaw is String && unitRaw.trim().isNotEmpty) {
      final unit = unitRaw.trim();
      final vStr = rawV % 1 == 0 ? rawV.toInt().toString() : rawV.toString();
      return 'Per $vStr $unit';
    }
  }
  final grams = metadata['baseAmountGrams'];
  if (grams is num) {
    final g = grams.toDouble();
    final gStr = g % 1 == 0 ? g.toInt().toString() : g.toString();
    return 'Per $gStr g';
  }
  return null;
}

/// Calories per recipe serving (list cards), from `nutrientsPerServing`.
double? recipeListCaloriesPerServingFromMetadata(
  Map<String, dynamic>? metadata,
) {
  if (metadata == null) {
    return null;
  }
  if (metadata['kind'] != 'recipe') {
    return null;
  }
  final nps = metadata['nutrientsPerServing'];
  if (nps is! Map<String, dynamic>) {
    return null;
  }
  final cal = nps['calories'];
  if (cal is num) {
    return cal.toDouble();
  }
  return null;
}
