import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:healthy_mobile_auth/healthy_mobile_auth.dart';

import '../../shared/widgets/shell_scaffold.dart';
import 'pantry_http.dart';
import 'pantry_create_food_validation.dart';

class _ServingUnitWire {
  const _ServingUnitWire({required this.key, required this.displayName});
  final String key;
  final String displayName;
}

class _ServingRowState {
  _ServingRowState({required this.custom, required String unitFallback})
    : unitKey = unitFallback,
      labelCtrl = TextEditingController(),
      gramsCtrl = TextEditingController();

  bool custom;
  String unitKey;
  final TextEditingController labelCtrl;
  final TextEditingController gramsCtrl;

  void dispose() {
    labelCtrl.dispose();
    gramsCtrl.dispose();
  }
}

/// Form to add a Food to the authenticated user's Pantry (matches admin POST `/pantry/items/food`).
class MealsPantryCreateFoodScreen extends StatefulWidget {
  const MealsPantryCreateFoodScreen({super.key, this.onDone});

  /// When set (e.g. shell FAB `OpenContainer`), invoked instead of [GoRouter.pop] after a successful save.
  final VoidCallback? onDone;

  @override
  State<MealsPantryCreateFoodScreen> createState() =>
      _MealsPantryCreateFoodScreenState();
}

class _MealsPantryCreateFoodScreenState
    extends State<MealsPantryCreateFoodScreen> {
  final _nameCtrl = TextEditingController();
  final _brandCtrl = TextEditingController();
  final _baseCtrl = TextEditingController();
  final _calCtrl = TextEditingController();
  final _proteinCtrl = TextEditingController();
  final _fatCtrl = TextEditingController();
  final _carbsCtrl = TextEditingController();

  String _baseUnit = 'g';
  List<String> _iconKeys = [];
  final List<_ServingUnitWire> _servingUnits = [];
  final List<_ServingRowState> _servingRows = [];
  String _iconKey = '';
  String? _referenceError;
  String? _formError;
  bool _loadingRef = true;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadReference();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _brandCtrl.dispose();
    _baseCtrl.dispose();
    _calCtrl.dispose();
    _proteinCtrl.dispose();
    _fatCtrl.dispose();
    _carbsCtrl.dispose();
    for (final r in _servingRows) {
      r.dispose();
    }
    super.dispose();
  }

  Future<String> _resolveBaseUrl() async {
    final u = await ApiBaseUrlStore.read();
    return u?.trim().replaceAll(RegExp(r'/+$'), '') ?? '';
  }

  Future<void> _loadReference() async {
    setState(() {
      _loadingRef = true;
      _referenceError = null;
    });
    final base = await _resolveBaseUrl();
    if (base.isEmpty) {
      setState(() {
        _loadingRef = false;
        _referenceError = 'Server URL is not configured.';
      });
      return;
    }
    final token = await readSessionToken();
    if (token == null || token.isEmpty) {
      setState(() {
        _loadingRef = false;
        _referenceError = 'Not signed in.';
      });
      return;
    }
    try {
      final uri = Uri.parse('$base/pantry/reference');
      final res = await PantryHttp.get(
        uri,
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
        },
      );
      if (res.statusCode != 200) {
        setState(() {
          _loadingRef = false;
          _referenceError = 'Unable to load icon list.';
        });
        return;
      }
      final body = jsonDecode(res.body);
      if (body is! Map<String, dynamic>) {
        throw const FormatException('reference');
      }
      final raw = body['iconKeys'];
      if (raw is! List<dynamic>) {
        throw const FormatException('iconKeys');
      }
      final keys = raw
          .map((e) => e is String ? e : null)
          .whereType<String>()
          .toList();

      final suRaw = body['servingUnits'];
      final servingUnits = <_ServingUnitWire>[];
      if (suRaw is List<dynamic>) {
        for (final e in suRaw) {
          if (e is Map<String, dynamic>) {
            final k = e['key'];
            final d = e['displayName'];
            if (k is String && d is String) {
              servingUnits.add(_ServingUnitWire(key: k, displayName: d));
            }
          }
        }
      }

      setState(() {
        _servingUnits
          ..clear()
          ..addAll(servingUnits);
        _iconKeys = keys;
        if (_iconKey.isEmpty && keys.isNotEmpty) {
          _iconKey = keys.first;
        }
        _loadingRef = false;
      });
    } catch (_) {
      setState(() {
        _loadingRef = false;
        _referenceError = 'Unable to load Pantry reference.';
      });
    }
  }

  String? _appendServingOptionsPayload(Map<String, dynamic> payload) {
    final out = <Map<String, dynamic>>[];
    final allowed = _servingUnits.map((e) => e.key).toSet();

    for (final r in _servingRows) {
      final gRaw = r.gramsCtrl.text.trim();
      final labelTrim = r.labelCtrl.text.trim();
      final blank = r.custom
          ? (gRaw.isEmpty && labelTrim.isEmpty)
          : gRaw.isEmpty;
      if (blank) {
        continue;
      }

      final g = num.tryParse(gRaw);
      if (g == null || !g.isFinite || g <= 0) {
        return 'Each serving option needs a positive mass in grams.';
      }
      if (r.custom) {
        if (labelTrim.isEmpty) {
          return 'Custom servings need a label.';
        }
        out.add(<String, dynamic>{
          'kind': 'custom',
          'label': labelTrim,
          'grams': g,
        });
      } else {
        if (!allowed.contains(r.unitKey)) {
          return 'Choose a predefined serving unit for each serving row.';
        }
        out.add(<String, dynamic>{
          'kind': 'unit',
          'unit': r.unitKey,
          'grams': g,
        });
      }
    }
    if (out.isNotEmpty) {
      payload['servingOptions'] = out;
    }
    return null;
  }

  void _addServingRow() {
    setState(() {
      final custom = _servingUnits.isEmpty;
      final u = _servingUnits.isNotEmpty ? _servingUnits.first.key : 'slice';
      _servingRows.add(_ServingRowState(custom: custom, unitFallback: u));
    });
  }

  void _removeServingRow(int index) {
    setState(() {
      _servingRows[index].dispose();
      _servingRows.removeAt(index);
    });
  }

  Future<void> _submit() async {
    final localErr = validatePantryCreateFoodForm(
      name: _nameCtrl.text,
      baseAmountRaw: _baseCtrl.text,
      caloriesRaw: _calCtrl.text,
      proteinRaw: _proteinCtrl.text,
      fatRaw: _fatCtrl.text,
      carbohydratesRaw: _carbsCtrl.text,
      iconKey: _iconKey,
    );
    if (localErr != null) {
      setState(() => _formError = localErr);
      return;
    }

    final base = await _resolveBaseUrl();
    final token = await readSessionToken();
    if (base.isEmpty || token == null || token.isEmpty) {
      setState(() => _formError = 'Not signed in or server URL missing.');
      return;
    }

    final baseVal = num.parse(_baseCtrl.text.trim());
    final uri = Uri.parse('$base/pantry/items/food');
    final nutrients = {
      'calories': num.parse(_calCtrl.text.trim()),
      'protein': num.parse(_proteinCtrl.text.trim()),
      'fat': num.parse(_fatCtrl.text.trim()),
      'carbohydrates': num.parse(_carbsCtrl.text.trim()),
    };
    final brand = _brandCtrl.text.trim();
    final payload = <String, dynamic>{
      'name': _nameCtrl.text.trim(),
      'iconKey': _iconKey,
      'baseAmount': {'value': baseVal, 'unit': _baseUnit},
      'nutrients': nutrients,
    };
    if (brand.isNotEmpty) {
      payload['brand'] = brand;
    }

    final servingsErr = _appendServingOptionsPayload(payload);
    if (servingsErr != null) {
      setState(() => _formError = servingsErr);
      return;
    }

    setState(() {
      _formError = null;
      _submitting = true;
    });

    try {
      final res = await PantryHttp.post(
        uri,
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: jsonEncode(payload),
      );
      if (res.statusCode == 201) {
        if (mounted) {
          if (widget.onDone != null) {
            widget.onDone!();
          } else {
            context.pop(true);
          }
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
          setState(() => _formError = 'Unable to save food.');
        }
      } else {
        setState(() => _formError = 'Unable to save food.');
      }
    } catch (_) {
      setState(() => _formError = 'Unable to save food.');
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return ShellScaffold(
      title: 'Add food',
      child: _loadingRef
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text('Loading…'),
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_referenceError != null)
                    Text(
                      _referenceError!,
                      style: const TextStyle(color: Colors.red),
                    ),
                  if (_referenceError == null) ...[
                    if (_formError != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(
                          _formError!,
                          key: const Key('pantry-create-food-error'),
                          style: const TextStyle(color: Colors.red),
                        ),
                      ),
                    TextField(
                      controller: _nameCtrl,
                      decoration: const InputDecoration(labelText: 'Name'),
                      textInputAction: TextInputAction.next,
                      key: const Key('pantry-create-food-name'),
                    ),
                    TextField(
                      controller: _brandCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Brand (optional)',
                      ),
                      textInputAction: TextInputAction.next,
                      key: const Key('pantry-create-food-brand'),
                    ),
                    const SizedBox(height: 8),
                    InputDecorator(
                      decoration: const InputDecoration(labelText: 'Icon'),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          key: const Key('pantry-create-food-icon'),
                          value: _iconKey.isEmpty ? null : _iconKey,
                          isExpanded: true,
                          isDense: true,
                          items: _iconKeys
                              .map(
                                (k) => DropdownMenuItem<String>(
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
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _baseCtrl,
                            decoration: const InputDecoration(
                              labelText: 'Base amount',
                            ),
                            keyboardType: const TextInputType.numberWithOptions(
                              decimal: true,
                            ),
                            key: const Key('pantry-create-food-base-value'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        DropdownButton<String>(
                          key: const Key('pantry-create-food-base-unit'),
                          value: _baseUnit,
                          items: const [
                            DropdownMenuItem(value: 'g', child: Text('g')),
                            DropdownMenuItem(value: 'oz', child: Text('oz')),
                          ],
                          onChanged: (v) {
                            if (v != null) {
                              setState(() => _baseUnit = v);
                            }
                          },
                        ),
                      ],
                    ),
                    TextField(
                      controller: _calCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Calories (kcal)',
                      ),
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      key: const Key('pantry-create-food-calories'),
                    ),
                    TextField(
                      controller: _proteinCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Protein (g)',
                      ),
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      key: const Key('pantry-create-food-protein'),
                    ),
                    TextField(
                      controller: _fatCtrl,
                      decoration: const InputDecoration(labelText: 'Fat (g)'),
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      key: const Key('pantry-create-food-fat'),
                    ),
                    TextField(
                      controller: _carbsCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Carbohydrates (g)',
                      ),
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      key: const Key('pantry-create-food-carbs'),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Serving options (optional)',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Predefined units need a gram mass per serving; custom rows need a label and grams.',
                      style: TextStyle(fontSize: 12, color: Colors.black45),
                    ),
                    const SizedBox(height: 8),
                    ...List<Widget>.generate(_servingRows.length, (i) {
                      final r = _servingRows[i];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: DropdownButtonFormField<bool>(
                                    value: _servingUnits.isEmpty
                                        ? true
                                        : r.custom,
                                    decoration: const InputDecoration(
                                      labelText: 'Type',
                                    ),
                                    items: _servingUnits.isEmpty
                                        ? const [
                                            DropdownMenuItem(
                                              value: true,
                                              child: Text('Custom label'),
                                            ),
                                          ]
                                        : const [
                                            DropdownMenuItem(
                                              value: false,
                                              child: Text('Predefined unit'),
                                            ),
                                            DropdownMenuItem(
                                              value: true,
                                              child: Text('Custom label'),
                                            ),
                                          ],
                                    onChanged: _servingUnits.isEmpty
                                        ? null
                                        : (v) {
                                            if (v != null) {
                                              setState(() {
                                                r.custom = v;
                                                if (!v &&
                                                    _servingUnits.isNotEmpty) {
                                                  r.unitKey =
                                                      _servingUnits.first.key;
                                                }
                                              });
                                            }
                                          },
                                  ),
                                ),
                                IconButton(
                                  onPressed: () => _removeServingRow(i),
                                  icon: const Icon(Icons.delete_outline),
                                  tooltip: 'Remove',
                                ),
                              ],
                            ),
                            if (!r.custom && _servingUnits.isNotEmpty)
                              DropdownButtonFormField<String>(
                                value: r.unitKey,
                                decoration: const InputDecoration(
                                  labelText: 'Unit',
                                ),
                                items: _servingUnits
                                    .map(
                                      (u) => DropdownMenuItem<String>(
                                        value: u.key,
                                        child: Text(
                                          u.displayName,
                                          style: const TextStyle(fontSize: 13),
                                        ),
                                      ),
                                    )
                                    .toList(),
                                onChanged: (v) {
                                  if (v != null) {
                                    setState(() => r.unitKey = v);
                                  }
                                },
                              ),
                            if (r.custom)
                              TextField(
                                controller: r.labelCtrl,
                                decoration: const InputDecoration(
                                  labelText: 'Label',
                                ),
                              ),
                            TextField(
                              controller: r.gramsCtrl,
                              decoration: const InputDecoration(
                                labelText: 'Grams per serving',
                              ),
                              keyboardType:
                                  const TextInputType.numberWithOptions(
                                    decimal: true,
                                  ),
                            ),
                          ],
                        ),
                      );
                    }),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        key: const Key('pantry-create-food-add-serving'),
                        onPressed: _addServingRow,
                        icon: const Icon(Icons.add),
                        label: const Text('Add serving option'),
                      ),
                    ),
                    const SizedBox(height: 8),
                    FilledButton(
                      key: const Key('pantry-create-food-submit'),
                      onPressed: _submitting ? null : _submit,
                      child: Text(_submitting ? 'Saving…' : 'Save food'),
                    ),
                  ],
                ],
              ),
            ),
    );
  }
}
