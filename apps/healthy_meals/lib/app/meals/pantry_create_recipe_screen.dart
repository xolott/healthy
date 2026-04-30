import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:healthy_mobile_auth/healthy_mobile_auth.dart';

import '../../shared/widgets/shell_scaffold.dart';
import 'pantry_http.dart';

class _PantryOption {
  const _PantryOption({
    required this.id,
    required this.name,
    required this.itemType,
    required this.metadata,
  });

  final String id;
  final String name;
  final String itemType;
  final Map<String, dynamic> metadata;
}

class _IngRow {
  _IngRow({required this.pantryItemId, required String qty})
    : qtyCtrl = TextEditingController(text: qty),
      mode = 'base',
      unitKey = '',
      customLabel = '',
      recipeUsesBatchYield = true;

  String pantryItemId;
  final TextEditingController qtyCtrl;
  String mode;
  String unitKey;
  String customLabel;
  bool recipeUsesBatchYield;

  void dispose() {
    qtyCtrl.dispose();
  }
}

/// Create recipe from saved foods and/or nested recipes (POST `/pantry/items/recipe`).
class MealsPantryCreateRecipeScreen extends StatefulWidget {
  const MealsPantryCreateRecipeScreen({super.key, this.onDone});

  /// When set (e.g. shell FAB `OpenContainer`), invoked instead of [GoRouter.pop] after a successful save.
  final VoidCallback? onDone;

  @override
  State<MealsPantryCreateRecipeScreen> createState() =>
      _MealsPantryCreateRecipeScreenState();
}

class _MealsPantryCreateRecipeScreenState
    extends State<MealsPantryCreateRecipeScreen> {
  bool _loading = true;
  String? _refError;
  String? _formError;
  bool _submitting = false;

  final _nameCtrl = TextEditingController();
  final _servingsCtrl = TextEditingController();
  final _servingLabelCtrl = TextEditingController();
  final List<String> _iconKeys = [];
  String _iconKey = '';

  final List<_PantryOption> _pantryCatalog = [];
  final List<_IngRow> _rows = [];

  @override
  void dispose() {
    _nameCtrl.dispose();
    _servingsCtrl.dispose();
    _servingLabelCtrl.dispose();
    for (final r in _rows) {
      r.dispose();
    }
    super.dispose();
  }

  Future<String> _resolveBaseUrl() async {
    final u = await ApiBaseUrlStore.read();
    return u?.trim().replaceAll(RegExp(r'/+$'), '') ?? '';
  }

  bool _foodHasOptions(Map<String, dynamic> meta) {
    final so = meta['servingOptions'];
    return so is List<dynamic> && so.isNotEmpty;
  }

  List<String> _unitKeys(Map<String, dynamic> meta) {
    final so = meta['servingOptions'];
    if (so is! List<dynamic>) {
      return [];
    }
    final out = <String>[];
    for (final e in so) {
      if (e is Map<String, dynamic> &&
          e['kind'] == 'unit' &&
          e['unit'] is String) {
        out.add(e['unit'] as String);
      }
    }
    return out;
  }

  List<String> _customLabels(Map<String, dynamic> meta) {
    final so = meta['servingOptions'];
    if (so is! List<dynamic>) {
      return [];
    }
    final out = <String>[];
    for (final e in so) {
      if (e is Map<String, dynamic> &&
          e['kind'] == 'custom' &&
          e['label'] is String) {
        out.add(e['label'] as String);
      }
    }
    return out;
  }

  Map<String, dynamic>? _metaForId(String id) {
    for (final p in _pantryCatalog) {
      if (p.id == id) {
        return p.metadata;
      }
    }
    return null;
  }

  void _syncRowMode(_IngRow row) {
    final meta = _metaForId(row.pantryItemId);
    if (meta == null) {
      return;
    }
    if (meta['kind'] == 'recipe') {
      row.mode = row.recipeUsesBatchYield ? 'base' : 'unit';
      row.unitKey = 'serving';
      return;
    }
    if (!_foodHasOptions(meta)) {
      row.mode = 'base';
      return;
    }
    final units = _unitKeys(meta);
    final labels = _customLabels(meta);
    if (row.mode == 'unit' && units.isEmpty && labels.isNotEmpty) {
      row.mode = 'custom';
    }
    if (row.mode == 'custom' && labels.isEmpty && units.isNotEmpty) {
      row.mode = 'unit';
    }
    if (row.mode == 'base') {
      row.mode = units.isNotEmpty ? 'unit' : 'custom';
    }
    if (row.mode == 'unit' &&
        units.isNotEmpty &&
        !units.contains(row.unitKey)) {
      row.unitKey = units.first;
    }
    if (row.mode == 'custom' &&
        labels.isNotEmpty &&
        !labels.contains(row.customLabel)) {
      row.customLabel = labels.first;
    }
  }

  @override
  void initState() {
    super.initState();
    _hydrate();
  }

  Future<void> _hydrate() async {
    setState(() {
      _loading = true;
      _refError = null;
    });
    final base = await _resolveBaseUrl();
    final token = await readSessionToken();
    if (base.isEmpty || token == null || token.isEmpty) {
      setState(() {
        _loading = false;
        _refError = 'Not signed in or server URL missing.';
      });
      return;
    }
    try {
      final refUri = Uri.parse('$base/pantry/reference');
      final refRes = await PantryHttp.get(
        refUri,
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
        },
      );
      if (refRes.statusCode != 200) {
        setState(() {
          _loading = false;
          _refError = 'Unable to load reference.';
        });
        return;
      }
      final refBody = jsonDecode(refRes.body);
      if (refBody is! Map<String, dynamic>) {
        throw const FormatException('ref');
      }
      final iconKeys = refBody['iconKeys'];
      if (iconKeys is List<dynamic>) {
        _iconKeys
          ..clear()
          ..addAll(iconKeys.whereType<String>());
        if (_iconKeys.isNotEmpty) {
          _iconKey = _iconKeys.first;
        }
      }

      Future<Map<String, dynamic>> fetchItems(String itemType) async {
        final uri = Uri.parse(
          '$base/pantry/items',
        ).replace(queryParameters: {'itemType': itemType});
        final res = await PantryHttp.get(
          uri,
          headers: {
            'Authorization': 'Bearer $token',
            'Accept': 'application/json',
          },
        );
        if (res.statusCode != 200) {
          throw FormatException(itemType);
        }
        final body = jsonDecode(res.body);
        if (body is! Map<String, dynamic>) {
          throw const FormatException('items');
        }
        return body;
      }

      final foodBody = await fetchItems('food');
      final recipeBody = await fetchItems('recipe');

      _pantryCatalog.clear();

      final foodItems = foodBody['items'];
      if (foodItems is List<dynamic>) {
        for (final e in foodItems) {
          if (e is! Map<String, dynamic>) {
            continue;
          }
          final id = e['id'];
          final name = e['name'];
          final meta = e['metadata'];
          final itemType = e['itemType'];
          if (id is String &&
              name is String &&
              meta is Map<String, dynamic> &&
              meta['kind'] == 'food' &&
              itemType == 'food') {
            _pantryCatalog.add(
              _PantryOption(
                id: id,
                name: name,
                itemType: 'food',
                metadata: Map<String, dynamic>.from(meta),
              ),
            );
          }
        }
      }

      final recipeItems = recipeBody['items'];
      if (recipeItems is List<dynamic>) {
        for (final e in recipeItems) {
          if (e is! Map<String, dynamic>) {
            continue;
          }
          final id = e['id'];
          final name = e['name'];
          final meta = e['metadata'];
          final itemType = e['itemType'];
          if (id is String &&
              name is String &&
              meta is Map<String, dynamic> &&
              meta['kind'] == 'recipe' &&
              itemType == 'recipe') {
            _pantryCatalog.add(
              _PantryOption(
                id: id,
                name: name,
                itemType: 'recipe',
                metadata: Map<String, dynamic>.from(meta),
              ),
            );
          }
        }
      }

      for (final r in _rows) {
        r.dispose();
      }
      _rows.clear();
      if (_pantryCatalog.isNotEmpty) {
        final r = _IngRow(pantryItemId: _pantryCatalog.first.id, qty: '1');
        _syncRowMode(r);
        _rows.add(r);
      }

      setState(() {
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _loading = false;
        _refError = 'Unable to load screen.';
      });
    }
  }

  void _addRow() {
    if (_pantryCatalog.isEmpty) {
      return;
    }
    setState(() {
      final r = _IngRow(pantryItemId: _pantryCatalog.first.id, qty: '1');
      _syncRowMode(r);
      _rows.add(r);
    });
  }

  void _removeRow(int i) {
    if (_rows.length <= 1) {
      return;
    }
    setState(() {
      _rows[i].dispose();
      _rows.removeAt(i);
    });
  }

  Future<void> _submit() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      setState(() => _formError = 'Name is required.');
      return;
    }
    if (_iconKey.isEmpty) {
      setState(() => _formError = 'Choose an icon.');
      return;
    }
    final servN = num.tryParse(_servingsCtrl.text.trim());
    if (servN == null || servN <= 0) {
      setState(() => _formError = 'Servings must be a positive number.');
      return;
    }
    if (_rows.isEmpty) {
      setState(() => _formError = 'Add at least one ingredient.');
      return;
    }

    final ingredients = <Map<String, dynamic>>[];
    for (var i = 0; i < _rows.length; i++) {
      final row = _rows[i];
      final meta = _metaForId(row.pantryItemId);
      if (meta == null) {
        setState(() => _formError = 'Each ingredient needs a pantry item.');
        return;
      }
      final q = num.tryParse(row.qtyCtrl.text.trim());
      if (q == null || q <= 0) {
        setState(
          () => _formError = 'Each ingredient needs a positive quantity.',
        );
        return;
      }

      if (meta['kind'] == 'recipe') {
        final servingOption = row.recipeUsesBatchYield
            ? <String, dynamic>{'kind': 'base'}
            : <String, dynamic>{'kind': 'unit', 'unit': 'serving'};
        ingredients.add({
          'recipeId': row.pantryItemId,
          'quantity': q,
          'servingOption': servingOption,
        });
      } else {
        Map<String, dynamic> servingOption;
        if (!_foodHasOptions(meta)) {
          servingOption = {'kind': 'base'};
        } else if (row.mode == 'unit') {
          servingOption = {'kind': 'unit', 'unit': row.unitKey};
        } else {
          servingOption = {'kind': 'custom', 'label': row.customLabel};
        }
        ingredients.add({
          'foodId': row.pantryItemId,
          'quantity': q,
          'servingOption': servingOption,
        });
      }
    }

    final base = await _resolveBaseUrl();
    final token = await readSessionToken();
    if (base.isEmpty || token == null || token.isEmpty) {
      setState(() => _formError = 'Not signed in or server URL missing.');
      return;
    }

    final label = _servingLabelCtrl.text.trim();
    final payload = <String, dynamic>{
      'name': name,
      'iconKey': _iconKey,
      'servings': servN,
      'ingredients': ingredients,
    };
    if (label.isNotEmpty) {
      payload['servingLabel'] = label;
    }

    setState(() {
      _formError = null;
      _submitting = true;
    });
    try {
      final uri = Uri.parse('$base/pantry/items/recipe');
      final res = await PantryHttp.post(
        uri,
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: jsonEncode(payload),
      );
      if (res.statusCode == 201 && mounted) {
        if (widget.onDone != null) {
          widget.onDone!();
        } else {
          context.pop(true);
        }
        return;
      }
      if (res.statusCode == 400) {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic> &&
            decoded['error'] == 'invalid_input' &&
            decoded['message'] is String) {
          setState(() => _formError = decoded['message'] as String);
        } else {
          setState(() => _formError = 'Unable to save recipe.');
        }
      } else {
        setState(() => _formError = 'Unable to save recipe.');
      }
    } catch (_) {
      setState(() => _formError = 'Unable to save recipe.');
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return ShellScaffold(
      title: 'Add recipe',
      child: _loading
          ? const Center(child: Text('Loading…'))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_refError != null)
                    Text(_refError!, style: const TextStyle(color: Colors.red))
                  else ...[
                    if (_formError != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(
                          _formError!,
                          key: const Key('pantry-create-recipe-error'),
                          style: const TextStyle(color: Colors.red),
                        ),
                      ),
                    if (_pantryCatalog.isEmpty)
                      const Text(
                        'Save at least one food or recipe in your pantry first.',
                      )
                    else ...[
                      TextField(
                        controller: _nameCtrl,
                        decoration: const InputDecoration(labelText: 'Name'),
                        key: const Key('pantry-create-recipe-name'),
                      ),
                      const SizedBox(height: 8),
                      InputDecorator(
                        decoration: const InputDecoration(labelText: 'Icon'),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            key: const Key('pantry-create-recipe-icon'),
                            value: _iconKey.isEmpty ? null : _iconKey,
                            isExpanded: true,
                            isDense: true,
                            items: _iconKeys
                                .map(
                                  (k) => DropdownMenuItem(
                                    value: k,
                                    child: Text(
                                      k,
                                      style: const TextStyle(fontSize: 13),
                                    ),
                                  ),
                                )
                                .toList(),
                            onChanged: _iconKeys.isEmpty
                                ? null
                                : (v) {
                                    if (v != null) {
                                      setState(() => _iconKey = v);
                                    }
                                  },
                          ),
                        ),
                      ),
                      TextField(
                        controller: _servingsCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Servings (yield)',
                        ),
                        keyboardType: TextInputType.number,
                        key: const Key('pantry-create-recipe-servings'),
                      ),
                      TextField(
                        controller: _servingLabelCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Serving label (optional)',
                          hintText: 'defaults to serving',
                        ),
                        key: const Key('pantry-create-recipe-serving-label'),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Ingredients',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                      ...List.generate(_rows.length, (i) {
                        final row = _rows[i];
                        final meta = _metaForId(row.pantryItemId) ?? {};
                        final isRecipe = meta['kind'] == 'recipe';
                        final hasOpt = !isRecipe && _foodHasOptions(meta);
                        return Card(
                          margin: const EdgeInsets.symmetric(vertical: 6),
                          child: Padding(
                            padding: const EdgeInsets.all(8),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                DropdownButton<String>(
                                  value: row.pantryItemId.isEmpty
                                      ? null
                                      : row.pantryItemId,
                                  isExpanded: true,
                                  items: _pantryCatalog
                                      .map(
                                        (p) => DropdownMenuItem(
                                          value: p.id,
                                          child: Text(
                                            p.itemType == 'recipe'
                                                ? '${p.name} (recipe)'
                                                : p.name,
                                            style: const TextStyle(
                                              fontSize: 13,
                                            ),
                                          ),
                                        ),
                                      )
                                      .toList(),
                                  onChanged: (v) {
                                    if (v == null) {
                                      return;
                                    }
                                    setState(() {
                                      row.pantryItemId = v;
                                      row.recipeUsesBatchYield = true;
                                      _syncRowMode(row);
                                    });
                                  },
                                ),
                                TextField(
                                  controller: row.qtyCtrl,
                                  decoration: const InputDecoration(
                                    labelText: 'Quantity',
                                  ),
                                  keyboardType: TextInputType.number,
                                ),
                                if (isRecipe)
                                  DropdownButton<bool>(
                                    value: row.recipeUsesBatchYield,
                                    isExpanded: true,
                                    items: const [
                                      DropdownMenuItem(
                                        value: true,
                                        child: Text('Full recipe yield'),
                                      ),
                                      DropdownMenuItem(
                                        value: false,
                                        child: Text('Per labeled serving'),
                                      ),
                                    ],
                                    onChanged: (v) {
                                      if (v == null) {
                                        return;
                                      }
                                      setState(() {
                                        row.recipeUsesBatchYield = v;
                                        _syncRowMode(row);
                                      });
                                    },
                                  ),
                                if (!isRecipe && !hasOpt)
                                  const Padding(
                                    padding: EdgeInsets.only(top: 4),
                                    child: Text(
                                      'Uses this food’s base amount.',
                                      style: TextStyle(
                                        color: Colors.black54,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ),
                                if (!isRecipe && hasOpt) ...[
                                  DropdownButton<String>(
                                    value: row.mode,
                                    isExpanded: true,
                                    items: const [
                                      DropdownMenuItem(
                                        value: 'unit',
                                        child: Text('Predefined unit'),
                                      ),
                                      DropdownMenuItem(
                                        value: 'custom',
                                        child: Text('Custom label'),
                                      ),
                                    ],
                                    onChanged: (v) {
                                      if (v == null) {
                                        return;
                                      }
                                      setState(() {
                                        row.mode = v;
                                        _syncRowMode(row);
                                      });
                                    },
                                  ),
                                  if (row.mode == 'unit')
                                    DropdownButton<String>(
                                      value: row.unitKey.isEmpty
                                          ? null
                                          : row.unitKey,
                                      isExpanded: true,
                                      items: _unitKeys(meta)
                                          .map(
                                            (u) => DropdownMenuItem(
                                              value: u,
                                              child: Text(u),
                                            ),
                                          )
                                          .toList(),
                                      onChanged: (v) {
                                        if (v != null) {
                                          setState(() => row.unitKey = v);
                                        }
                                      },
                                    )
                                  else
                                    DropdownButton<String>(
                                      value: row.customLabel.isEmpty
                                          ? null
                                          : row.customLabel,
                                      isExpanded: true,
                                      items: _customLabels(meta)
                                          .map(
                                            (l) => DropdownMenuItem(
                                              value: l,
                                              child: Text(l),
                                            ),
                                          )
                                          .toList(),
                                      onChanged: (v) {
                                        if (v != null) {
                                          setState(() => row.customLabel = v);
                                        }
                                      },
                                    ),
                                ],
                                if (_rows.length > 1)
                                  TextButton(
                                    onPressed: () => _removeRow(i),
                                    child: const Text('Remove'),
                                  ),
                              ],
                            ),
                          ),
                        );
                      }),
                      TextButton(
                        onPressed: _addRow,
                        child: const Text('Add ingredient'),
                      ),
                      const SizedBox(height: 12),
                      FilledButton(
                        key: const Key('pantry-create-recipe-submit'),
                        onPressed: _submitting ? null : _submit,
                        child: const Text('Save recipe'),
                      ),
                    ],
                  ],
                ],
              ),
            ),
    );
  }
}
