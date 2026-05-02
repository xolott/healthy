import 'dart:convert';
import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';
import 'package:healthy_mobile_auth/healthy_mobile_auth.dart';

import 'pantry_http.dart';

/// One Reference Food serving row from GET `/reference-foods/:id`.
@immutable
class ReferenceFoodServingWire {
  const ReferenceFoodServingWire({
    required this.label,
    required this.gramWeight,
  });

  final String label;
  final double? gramWeight;

  static ReferenceFoodServingWire? tryParse(dynamic e) {
    if (e is! Map) {
      return null;
    }
    final m = Map<String, dynamic>.from(e);
    final label = m['label'];
    final gw = m['gramWeight'];
    if (label is! String || label.trim().isEmpty) {
      return null;
    }
    double? gramWeight;
    if (gw == null) {
      gramWeight = null;
    } else if (gw is num) {
      gramWeight = gw.toDouble();
    } else {
      return null;
    }
    return ReferenceFoodServingWire(
      label: label.trim(),
      gramWeight: gramWeight,
    );
  }
}

/// Full Reference Food payload for logging (GET `/reference-foods/:id` → `food`).
@immutable
class ReferenceFoodDetailForLog {
  const ReferenceFoodDetailForLog({
    required this.id,
    required this.source,
    required this.sourceFoodId,
    required this.displayName,
    required this.brand,
    required this.foodClass,
    required this.iconKey,
    required this.baseAmountGrams,
    required this.calories,
    required this.proteinGrams,
    required this.fatGrams,
    required this.carbohydratesGrams,
    required this.servings,
  });

  final String id;
  final String source;
  final String sourceFoodId;
  final String displayName;
  final String? brand;
  final String? foodClass;
  final String iconKey;
  final double baseAmountGrams;
  final double calories;
  final double proteinGrams;
  final double fatGrams;
  final double carbohydratesGrams;
  final List<ReferenceFoodServingWire> servings;

  static ReferenceFoodDetailForLog? tryParseFood(Map<String, dynamic>? food) {
    if (food == null) {
      return null;
    }
    final id = food['id'];
    final source = food['source'];
    final sourceFoodId = food['sourceFoodId'];
    final displayName = food['displayName'];
    final iconKey = food['iconKey'];
    final baseG = food['baseAmountGrams'];
    final cal = food['calories'];
    final p = food['proteinGrams'];
    final fat = food['fatGrams'];
    final carb = food['carbohydratesGrams'];
    final servingsRaw = food['servings'];
    if (id is! String ||
        source is! String ||
        sourceFoodId is! String ||
        displayName is! String ||
        iconKey is! String ||
        baseG is! num ||
        cal is! num ||
        p is! num ||
        fat is! num ||
        carb is! num ||
        servingsRaw is! List) {
      return null;
    }
    final brand = food['brand'];
    final foodClass = food['foodClass'];
    final servings = <ReferenceFoodServingWire>[];
    for (final e in servingsRaw) {
      final s = ReferenceFoodServingWire.tryParse(e);
      if (s != null) {
        servings.add(s);
      }
    }
    return ReferenceFoodDetailForLog(
      id: id,
      source: source,
      sourceFoodId: sourceFoodId,
      displayName: displayName.trim().isEmpty ? 'Food' : displayName.trim(),
      brand: brand is String && brand.trim().isNotEmpty ? brand.trim() : null,
      foodClass: foodClass is String && foodClass.trim().isNotEmpty
          ? foodClass.trim()
          : null,
      iconKey: iconKey.trim().isEmpty ? 'food_bowl' : iconKey.trim(),
      baseAmountGrams: baseG.toDouble(),
      calories: cal.toDouble(),
      proteinGrams: p.toDouble(),
      fatGrams: fat.toDouble(),
      carbohydratesGrams: carb.toDouble(),
      servings: servings,
    );
  }
}

/// Lightweight search card from GET `/reference-foods/search`.
@immutable
class ReferenceFoodSearchCard {
  const ReferenceFoodSearchCard({
    required this.id,
    required this.source,
    required this.sourceFoodId,
    required this.displayName,
    required this.brand,
    required this.foodClass,
    required this.servingPreviewLabel,
    required this.servingPreviewGrams,
    required this.macrosBaseAmountGrams,
    required this.macrosCalories,
    required this.macrosProteinGrams,
    required this.macrosFatGrams,
    required this.macrosCarbohydratesGrams,
  });

  final String id;
  final String source;
  final String sourceFoodId;
  final String displayName;
  final String? brand;
  final String? foodClass;
  final String? servingPreviewLabel;
  final double? servingPreviewGrams;
  final double macrosBaseAmountGrams;
  final double macrosCalories;
  final double macrosProteinGrams;
  final double macrosFatGrams;
  final double macrosCarbohydratesGrams;

  static ReferenceFoodSearchCard? tryParse(dynamic e) {
    if (e is! Map) {
      return null;
    }
    final row = Map<String, dynamic>.from(e);
    final id = row['id'];
    final source = row['source'];
    final sourceFoodId = row['sourceFoodId'];
    final displayName = row['displayName'];
    final macrosRaw = row['macros'];
    if (id is! String ||
        source is! String ||
        sourceFoodId is! String ||
        displayName is! String ||
        macrosRaw is! Map) {
      return null;
    }
    final macros = Map<String, dynamic>.from(macrosRaw);
    final mBase = macros['baseAmountGrams'];
    final mCal = macros['calories'];
    final mP = macros['proteinGrams'];
    final mF = macros['fatGrams'];
    final mC = macros['carbohydratesGrams'];
    if (mBase is! num ||
        mCal is! num ||
        mP is! num ||
        mF is! num ||
        mC is! num) {
      return null;
    }
    final brand = row['brand'];
    final foodClass = row['foodClass'];
    String? previewLabel;
    double? previewGrams;
    final sp = row['servingPreview'];
    if (sp is Map) {
      final spMap = Map<String, dynamic>.from(sp);
      final lbl = spMap['label'];
      final gw = spMap['gramWeight'];
      if (lbl is String && lbl.trim().isNotEmpty) {
        previewLabel = lbl.trim();
      }
      if (gw is num) {
        previewGrams = gw.toDouble();
      }
    }
    return ReferenceFoodSearchCard(
      id: id,
      source: source,
      sourceFoodId: sourceFoodId,
      displayName: displayName.trim().isEmpty ? 'Food' : displayName.trim(),
      brand: brand is String && brand.trim().isNotEmpty ? brand.trim() : null,
      foodClass: foodClass is String && foodClass.trim().isNotEmpty
          ? foodClass.trim()
          : null,
      servingPreviewLabel: previewLabel,
      servingPreviewGrams: previewGrams,
      macrosBaseAmountGrams: mBase.toDouble(),
      macrosCalories: mCal.toDouble(),
      macrosProteinGrams: mP.toDouble(),
      macrosFatGrams: mF.toDouble(),
      macrosCarbohydratesGrams: mC.toDouble(),
    );
  }
}

Future<String> referenceFoodLogResolveBaseUrl() async {
  final base = await ApiBaseUrlStore.read();
  return base?.trim().replaceAll(RegExp(r'/+$'), '') ?? '';
}

String _referenceFoodSearchBodySnippet(String body) {
  const maxLen = 400;
  final t = body.trim();
  if (t.length <= maxLen) {
    return t;
  }
  return '${t.substring(0, maxLen)}…';
}

/// GET `/reference-foods/search?q=`. Returns items, or `null` on hard failure.
Future<List<ReferenceFoodSearchCard>?> fetchReferenceFoodSearch({
  required String baseUrl,
  required String token,
  required String query,
}) async {
  final q = query.trim();
  if (q.isEmpty || baseUrl.isEmpty || token.isEmpty) {
    return [];
  }
  final uri = Uri.parse(
    '$baseUrl/reference-foods/search',
  ).replace(queryParameters: <String, String>{'q': q});
  try {
    final res = await PantryHttp.get(
      uri,
      headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'},
    );
    if (res.statusCode == 503) {
      developer.log(
        'Reference food search failed: service unavailable (HTTP 503)',
        name: 'reference_food.search',
      );
      return null;
    }
    if (res.statusCode != 200) {
      developer.log(
        'Reference food search failed: HTTP ${res.statusCode}',
        name: 'reference_food.search',
        error: _referenceFoodSearchBodySnippet(res.body),
      );
      return [];
    }
    dynamic decodedRaw;
    try {
      decodedRaw = jsonDecode(res.body);
    } catch (e, s) {
      developer.log(
        'Reference food search failed: response was not valid JSON',
        name: 'reference_food.search',
        error: e,
        stackTrace: s,
      );
      return [];
    }
    if (decodedRaw is! Map) {
      developer.log(
        'Reference food search failed: expected JSON object, got '
        '${decodedRaw.runtimeType}',
        name: 'reference_food.search',
      );
      return [];
    }
    final decoded = Map<String, dynamic>.from(decodedRaw);
    final items = decoded['items'];
    if (items is! List) {
      developer.log(
        'Reference food search failed: "items" missing or not a list',
        name: 'reference_food.search',
      );
      return [];
    }
    final out = <ReferenceFoodSearchCard>[];
    for (final e in items) {
      final c = ReferenceFoodSearchCard.tryParse(e);
      if (c != null) {
        out.add(c);
      }
    }
    return out;
  } catch (e, s) {
    developer.log(
      'Reference food search failed: network or transport error',
      name: 'reference_food.search',
      error: e,
      stackTrace: s,
    );
    return null;
  }
}

/// GET `/reference-foods/:id`. Returns detail or `null` if unavailable / not found.
Future<ReferenceFoodDetailForLog?> fetchReferenceFoodDetail({
  required String baseUrl,
  required String token,
  required String referenceFoodId,
}) async {
  if (baseUrl.isEmpty || token.isEmpty || referenceFoodId.trim().isEmpty) {
    return null;
  }
  final uri = Uri.parse('$baseUrl/reference-foods/${referenceFoodId.trim()}');
  final res = await PantryHttp.get(
    uri,
    headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'},
  );
  if (res.statusCode != 200) {
    return null;
  }
  final decodedRaw = jsonDecode(res.body);
  if (decodedRaw is! Map) {
    return null;
  }
  final decoded = Map<String, dynamic>.from(decodedRaw);
  final foodRaw = decoded['food'];
  if (foodRaw is! Map) {
    return null;
  }
  return ReferenceFoodDetailForLog.tryParseFood(
    Map<String, dynamic>.from(foodRaw),
  );
}

/// Servings that can scale logged grams (positive [ReferenceFoodServingWire.gramWeight]).
List<ReferenceFoodServingWire> referenceLoggableServings(
  ReferenceFoodDetailForLog d,
) {
  return d.servings
      .where((s) => s.gramWeight != null && s.gramWeight! > 0)
      .toList(growable: false);
}

int referenceServingChoiceCount(ReferenceFoodDetailForLog d) =>
    referenceLoggableServings(d).length + 2;

String referenceServingChoiceLabel(
  ReferenceFoodDetailForLog detail,
  int choiceIndex,
) {
  final servings = referenceLoggableServings(detail);
  if (choiceIndex >= 0 && choiceIndex < servings.length) {
    return servings[choiceIndex].label;
  }
  final baseIdx = servings.length;
  if (choiceIndex == baseIdx) {
    final g = detail.baseAmountGrams;
    final gs = g == g.roundToDouble() ? '${g.toInt()}' : g.toStringAsFixed(1);
    return 'Base ($gs g)';
  }
  return 'Grams (direct)';
}

String referenceUnitPhraseForChoice(
  ReferenceFoodDetailForLog d,
  int choiceIndex,
) {
  final servings = referenceLoggableServings(d);
  if (choiceIndex >= 0 && choiceIndex < servings.length) {
    return 'serving unit(s)';
  }
  if (choiceIndex == servings.length) {
    return 'base serving(s)';
  }
  return 'g';
}

double? referenceConsumedGramsForChoice({
  required ReferenceFoodDetailForLog detail,
  required int choiceIndex,
  required double quantity,
}) {
  if (!(quantity > 0)) {
    return null;
  }
  final servings = referenceLoggableServings(detail);
  if (choiceIndex >= 0 && choiceIndex < servings.length) {
    final g = servings[choiceIndex].gramWeight!;
    return g * quantity;
  }
  final baseIdx = servings.length;
  if (choiceIndex == baseIdx) {
    if (!(detail.baseAmountGrams > 0)) {
      return null;
    }
    return detail.baseAmountGrams * quantity;
  }
  final gramsIdx = baseIdx + 1;
  if (choiceIndex == gramsIdx) {
    return quantity;
  }
  return null;
}

bool referenceServingChoiceValid(
  ReferenceFoodDetailForLog detail,
  int choiceIndex,
) {
  final max = referenceServingChoiceCount(detail);
  return choiceIndex >= 0 && choiceIndex < max;
}
