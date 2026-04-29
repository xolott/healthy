import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:healthy_mobile_auth/healthy_mobile_auth.dart';

import '../../shared/widgets/shell_scaffold.dart';

/// Food detail: macros per base amount and optional serving options (GET `/pantry/items/:id`).
class MealsPantryFoodDetailScreen extends StatefulWidget {
  const MealsPantryFoodDetailScreen({super.key, required this.itemId});

  final String itemId;

  @override
  State<MealsPantryFoodDetailScreen> createState() => _MealsPantryFoodDetailScreenState();
}

class _MealsPantryFoodDetailScreenState extends State<MealsPantryFoodDetailScreen> {
  bool _loading = true;
  String? _error;
  String _name = '';
  String? _brand;
  double? _baseGrams;
  Map<String, double>? _nutrients;
  List<dynamic>? _servingOptions;
  final Map<String, String> _unitDisplayNames = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<String> _resolveBaseUrl() async {
    final u = await ApiBaseUrlStore.read();
    return u?.trim().replaceAll(RegExp(r'/+$'), '') ?? '';
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
        _error = 'Missing food id.';
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
      _unitDisplayNames.clear();
      final refUri = Uri.parse('$base/pantry/reference');
      final refRes = await http.get(
        refUri,
        headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'},
      );
      if (refRes.statusCode == 200) {
        final refBody = jsonDecode(refRes.body);
        if (refBody is Map<String, dynamic>) {
          final units = refBody['servingUnits'];
          if (units is List<dynamic>) {
            for (final u in units) {
              if (u is Map<String, dynamic>) {
                final k = u['key'];
                final d = u['displayName'];
                if (k is String && d is String) {
                  _unitDisplayNames[k] = d;
                }
              }
            }
          }
        }
      }

      final uri = Uri.parse('$base/pantry/items/${widget.itemId}');
      final res = await http.get(
        uri,
        headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'},
      );
      if (res.statusCode != 200) {
        setState(() {
          _loading = false;
          _error = res.statusCode == 404 ? 'Food not found.' : 'Unable to load food.';
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
      if (item['itemType'] != 'food') {
        setState(() {
          _loading = false;
          _error = 'This pantry item is not a food.';
        });
        return;
      }
      final meta = item['metadata'];
      if (meta is! Map<String, dynamic>) {
        throw const FormatException('metadata');
      }
      if (meta['kind'] != 'food') {
        setState(() {
          _loading = false;
          _error = 'This pantry item is not a food.';
        });
        return;
      }
      final baseG = meta['baseAmountGrams'];
      if (baseG is! num) {
        throw const FormatException('base');
      }
      final n = meta['nutrients'];
      if (n is! Map<String, dynamic>) {
        throw const FormatException('nutrients');
      }
      final nutrients = <String, double>{};
      for (final key in ['calories', 'protein', 'fat', 'carbohydrates']) {
        final v = n[key];
        if (v is num) {
          nutrients[key] = v.toDouble();
        }
      }
      if (nutrients.length != 4) {
        throw const FormatException('nutrients shape');
      }

      final nm = item['name'];
      if (nm is! String) {
        throw const FormatException('name');
      }
      final brand = meta['brand'];
      final so = meta['servingOptions'];

      setState(() {
        _name = nm;
        _brand = brand is String && brand.trim().isNotEmpty ? brand : null;
        _baseGrams = baseG.toDouble();
        _nutrients = nutrients;
        _servingOptions = so is List<dynamic> ? so : null;
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _loading = false;
        _error = 'Unable to load food.';
      });
    }
  }

  String _servingLabel(Map<String, dynamic> o) {
    if (o['kind'] == 'custom' && o['label'] is String) {
      return o['label'] as String;
    }
    if (o['kind'] == 'unit' && o['unit'] is String) {
      final u = o['unit'] as String;
      return _unitDisplayNames[u] ?? u;
    }
    return '?';
  }

  Map<String, double> _scaleToGrams(double targetG) {
    final n = _nutrients!;
    final b = _baseGrams!;
    final f = targetG / b;
    return {
      'calories': n['calories']! * f,
      'protein': n['protein']! * f,
      'fat': n['fat']! * f,
      'carbohydrates': n['carbohydrates']! * f,
    };
  }

  @override
  Widget build(BuildContext context) {
    return ShellScaffold(
      title: 'Food',
      child: _loading
          ? const Center(child: Padding(padding: EdgeInsets.all(24), child: Text('Loading…')))
          : _error != null
          ? Padding(
              padding: const EdgeInsets.all(16),
              child: Text(_error!, key: const Key('pantry-food-detail-error'), style: const TextStyle(color: Colors.red)),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextButton(
                    key: const Key('pantry-food-detail-back'),
                    onPressed: () => context.pop(),
                    child: const Text('← Pantry'),
                  ),
                  const SizedBox(height: 8),
                  Text(_name, style: Theme.of(context).textTheme.headlineSmall),
                  if (_brand != null) ...[
                    const SizedBox(height: 4),
                    Text(_brand!, style: const TextStyle(color: Colors.black54)),
                  ],
                  const SizedBox(height: 16),
                  Text(
                    'Per ${_baseGrams!.toStringAsFixed(0)} g (base)',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  Text('Calories: ${_nutrients!['calories']} kcal'),
                  Text('Protein: ${_nutrients!['protein']} g'),
                  Text('Fat: ${_nutrients!['fat']} g'),
                  Text('Carbohydrates: ${_nutrients!['carbohydrates']} g'),
                  const SizedBox(height: 20),
                  if (_servingOptions != null && _servingOptions!.isNotEmpty) ...[
                    const Text('Serving options', style: TextStyle(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    ..._servingOptions!.asMap().entries.map((entry) {
                      final i = entry.key;
                      final raw = entry.value;
                      if (raw is! Map<String, dynamic>) {
                        return const SizedBox.shrink();
                      }
                      final grams = raw['grams'];
                      if (grams is! num) {
                        return const SizedBox.shrink();
                      }
                      final g = grams.toDouble();
                      final scaled = _scaleToGrams(g);
                      final label = _servingLabel(raw);
                      return Padding(
                        key: ValueKey<int>(i),
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Text(
                          '$label (${g}g): ${scaled['calories']!.toStringAsFixed(1)} kcal, '
                          'P ${scaled['protein']!.toStringAsFixed(2)} g, '
                          'F ${scaled['fat']!.toStringAsFixed(2)} g, '
                          'C ${scaled['carbohydrates']!.toStringAsFixed(2)} g',
                        ),
                      );
                    }),
                  ] else
                    const Text(
                      'No extra serving options.',
                      key: Key('pantry-food-detail-no-servings'),
                      style: TextStyle(color: Colors.black45),
                    ),
                ],
              ),
            ),
    );
  }
}
