import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:healthy_mobile_auth/healthy_mobile_auth.dart';

import '../../shared/widgets/shell_scaffold.dart';

/// Recipe detail: computed totals and ingredients (GET `/pantry/items/:id`).
class MealsPantryRecipeDetailScreen extends StatefulWidget {
  const MealsPantryRecipeDetailScreen({super.key, required this.itemId});

  final String itemId;

  @override
  State<MealsPantryRecipeDetailScreen> createState() => _MealsPantryRecipeDetailScreenState();
}

class _MealsPantryRecipeDetailScreenState extends State<MealsPantryRecipeDetailScreen> {
  bool _loading = true;
  String? _error;
  String _name = '';
  String _iconKey = '';
  double? _servings;
  String _servingLabel = '';
  Map<String, double>? _nutrientsTotal;
  Map<String, double>? _nutrientsPerServing;
  List<Map<String, dynamic>> _ingredients = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<String> _resolveBaseUrl() async {
    final u = await ApiBaseUrlStore.read();
    return u?.trim().replaceAll(RegExp(r'/+$'), '') ?? '';
  }

  Map<String, double>? _parseNutrients(Map<String, dynamic>? o) {
    if (o == null) {
      return null;
    }
    final c = o['calories'];
    final p = o['protein'];
    final f = o['fat'];
    final carb = o['carbohydrates'];
    if (c is! num || p is! num || f is! num || carb is! num) {
      return null;
    }
    return {
      'calories': c.toDouble(),
      'protein': p.toDouble(),
      'fat': f.toDouble(),
      'carbohydrates': carb.toDouble(),
    };
  }

  String _servingOptionLabel(Map<String, dynamic> o) {
    final k = o['kind'];
    if (k == 'base') {
      return 'base';
    }
    if (k == 'unit' && o['unit'] is String) {
      return o['unit'] as String;
    }
    if (k == 'custom' && o['label'] is String) {
      return o['label'] as String;
    }
    return '$k';
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final base = await _resolveBaseUrl();
    if (base.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Server URL is not configured.';
      });
      return;
    }
    if (widget.itemId.trim().isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Missing recipe id.';
      });
      return;
    }
    final token = await readSessionToken();
    if (token == null || token.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Not signed in.';
      });
      return;
    }

    try {
      final uri = Uri.parse('$base/pantry/items/${widget.itemId}');
      final res = await http.get(
        uri,
        headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'},
      );
      if (res.statusCode != 200) {
        setState(() {
          _loading = false;
          _error = res.statusCode == 404 ? 'Recipe not found.' : 'Unable to load recipe.';
        });
        return;
      }
      final body = jsonDecode(res.body);
      if (body is! Map<String, dynamic>) {
        throw const FormatException('detail');
      }
      final item = body['item'];
      if (item is! Map<String, dynamic>) {
        throw const FormatException('item');
      }
      if (item['itemType'] != 'recipe') {
        setState(() {
          _loading = false;
          _error = 'This pantry item is not a recipe.';
        });
        return;
      }
      final meta = item['metadata'];
      if (meta is! Map<String, dynamic> || meta['kind'] != 'recipe') {
        setState(() {
          _loading = false;
          _error = 'Recipe data is incomplete.';
        });
        return;
      }
      final servings = meta['servings'];
      final label = meta['servingLabel'];
      if (servings is! num || label is! String) {
        setState(() {
          _loading = false;
          _error = 'Recipe data is incomplete.';
        });
        return;
      }
      final total = _parseNutrients(meta['nutrients'] as Map<String, dynamic>?);
      final per = _parseNutrients(meta['nutrientsPerServing'] as Map<String, dynamic>?);
      if (total == null || per == null) {
        setState(() {
          _loading = false;
          _error = 'Recipe data is incomplete.';
        });
        return;
      }

      final ingRaw = item['ingredients'];
      final ingredients = <Map<String, dynamic>>[];
      if (ingRaw is List<dynamic>) {
        for (final e in ingRaw) {
          if (e is Map<String, dynamic>) {
            ingredients.add(e);
          }
        }
      }

      setState(() {
        _loading = false;
        _name = item['name'] as String? ?? '';
        _iconKey = item['iconKey'] as String? ?? '';
        _servings = servings.toDouble();
        _servingLabel = label;
        _nutrientsTotal = total;
        _nutrientsPerServing = per;
        _ingredients = ingredients;
      });
    } catch (_) {
      setState(() {
        _loading = false;
        _error = 'Unable to load recipe.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return ShellScaffold(
      title: 'Recipe',
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextButton(
              key: const Key('pantry-recipe-detail-back'),
              onPressed: () => context.pop(),
              child: const Text('← Pantry'),
            ),
            if (_loading) const Text('Loading…'),
            if (_error != null)
              Text(
                _error!,
                key: const Key('pantry-recipe-detail-error'),
                style: const TextStyle(color: Colors.red),
              ),
            if (!_loading && _error == null) ...[
              Text(_name, style: Theme.of(context).textTheme.titleLarge),
              Text(_iconKey, style: const TextStyle(fontFamily: 'monospace', fontSize: 11)),
              if (_servings != null)
                Text(
                  'Makes ${_servings!.toStringAsFixed(_servings!.truncateToDouble() == _servings! ? 0 : 1)} $_servingLabel${_servings == 1 ? '' : 's'}',
                  style: const TextStyle(color: Colors.black54),
                ),
              const SizedBox(height: 16),
              const Text('Full recipe', style: TextStyle(fontWeight: FontWeight.w600)),
              if (_nutrientsTotal != null) ...[
                Text('Calories: ${_nutrientsTotal!['calories']!.toStringAsFixed(0)} kcal'),
                Text('Protein: ${_nutrientsTotal!['protein']!.toStringAsFixed(1)} g'),
                Text('Fat: ${_nutrientsTotal!['fat']!.toStringAsFixed(1)} g'),
                Text('Carbs: ${_nutrientsTotal!['carbohydrates']!.toStringAsFixed(1)} g'),
              ],
              const SizedBox(height: 12),
              Text('Per $_servingLabel', style: const TextStyle(fontWeight: FontWeight.w600)),
              if (_nutrientsPerServing != null) ...[
                Text('Calories: ${_nutrientsPerServing!['calories']!.toStringAsFixed(0)} kcal'),
                Text('Protein: ${_nutrientsPerServing!['protein']!.toStringAsFixed(1)} g'),
                Text('Fat: ${_nutrientsPerServing!['fat']!.toStringAsFixed(1)} g'),
                Text('Carbs: ${_nutrientsPerServing!['carbohydrates']!.toStringAsFixed(1)} g'),
              ],
              if (_ingredients.isNotEmpty) ...[
                const SizedBox(height: 16),
                const Text('Ingredients', style: TextStyle(fontWeight: FontWeight.w600)),
                ..._ingredients.map((ing) {
                  final name = ing['displayName'] as String? ?? ing['foodName'] as String? ?? '';
                  final q = ing['quantity'];
                  final so = ing['servingOption'];
                  final qStr = q is num ? q.toString() : '?';
                  final soMap = so is Map<String, dynamic> ? so : <String, dynamic>{};
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Text('$name × $qStr (${_servingOptionLabel(soMap)})'),
                  );
                }),
              ],
            ],
          ],
        ),
      ),
    );
  }
}
