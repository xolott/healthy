import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:healthy_mobile_auth/healthy_mobile_auth.dart';

import '../../shared/widgets/shell_scaffold.dart';
import 'pantry_create_food_validation.dart';

/// Form to add a Food to the authenticated user's Pantry (matches admin POST `/pantry/items/food`).
class MealsPantryCreateFoodScreen extends StatefulWidget {
  const MealsPantryCreateFoodScreen({super.key});

  @override
  State<MealsPantryCreateFoodScreen> createState() => _MealsPantryCreateFoodScreenState();
}

class _MealsPantryCreateFoodScreenState extends State<MealsPantryCreateFoodScreen> {
  final _nameCtrl = TextEditingController();
  final _brandCtrl = TextEditingController();
  final _baseCtrl = TextEditingController();
  final _calCtrl = TextEditingController();
  final _proteinCtrl = TextEditingController();
  final _fatCtrl = TextEditingController();
  final _carbsCtrl = TextEditingController();

  String _baseUnit = 'g';
  List<String> _iconKeys = [];
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
      final res = await http.get(
        uri,
        headers: {'Authorization': 'Bearer $token', 'Accept': 'application/json'},
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
      final keys = raw.map((e) => e is String ? e : null).whereType<String>().toList();
      setState(() {
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

    setState(() {
      _formError = null;
      _submitting = true;
    });

    final base = await _resolveBaseUrl();
    final token = await readSessionToken();
    if (base.isEmpty || token == null || token.isEmpty) {
      setState(() {
        _submitting = false;
        _formError = 'Not signed in or server URL missing.';
      });
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

    try {
      final res = await http.post(
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
                    Text(_referenceError!, style: const TextStyle(color: Colors.red)),
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
                      decoration: const InputDecoration(labelText: 'Brand (optional)'),
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
                                  child: Text(k, style: const TextStyle(fontSize: 13)),
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
                            decoration: const InputDecoration(labelText: 'Base amount'),
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
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
                      decoration: const InputDecoration(labelText: 'Calories (kcal)'),
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      key: const Key('pantry-create-food-calories'),
                    ),
                    TextField(
                      controller: _proteinCtrl,
                      decoration: const InputDecoration(labelText: 'Protein (g)'),
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      key: const Key('pantry-create-food-protein'),
                    ),
                    TextField(
                      controller: _fatCtrl,
                      decoration: const InputDecoration(labelText: 'Fat (g)'),
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      key: const Key('pantry-create-food-fat'),
                    ),
                    TextField(
                      controller: _carbsCtrl,
                      decoration: const InputDecoration(labelText: 'Carbohydrates (g)'),
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      key: const Key('pantry-create-food-carbs'),
                    ),
                    const SizedBox(height: 16),
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
