import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:healthy_mobile_auth/healthy_mobile_auth.dart';
import 'package:intl/intl.dart';

import 'meals_food_log_shell_sync.dart';
import 'pantry_catalog_helpers.dart';
import 'pantry_catalog_item.dart';
import 'pantry_http.dart';
import 'pantry_infinite_catalog_list.dart';

/// Composer: log Pantry Foods or Recipes as Food Log Entries (serving-aware).
class MealsFoodLogEntryComposerScreen extends StatefulWidget {
  const MealsFoodLogEntryComposerScreen({super.key, required this.onDone});

  final VoidCallback onDone;

  @override
  State<MealsFoodLogEntryComposerScreen> createState() =>
      _MealsFoodLogEntryComposerScreenState();
}

class _MealsFoodLogEntryComposerScreenState
    extends State<MealsFoodLogEntryComposerScreen> {
  late DateTime _consumedAt;
  final TextEditingController _quantityController = TextEditingController(
    text: '1',
  );
  PantryCatalogItem? _item;
  int _selectedServingIndex = 0;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    final day = mealsFoodLogSelectedDayNotifier.value;
    _consumedAt = DateTime(
      day.year,
      day.month,
      day.day,
      now.hour,
      now.minute,
      now.second,
    );
  }

  @override
  void dispose() {
    _quantityController.dispose();
    super.dispose();
  }

  double? _parseQuantity() {
    final raw = _quantityController.text.trim();
    final v = double.tryParse(raw);
    if (v == null || v <= 0 || v.isNaN || v.isInfinite) {
      return null;
    }
    return v;
  }

  bool _hasValidServingSelection(PantryCatalogItem item) {
    if (item.itemType == PantryCatalogItemType.recipe) {
      return _selectedServingIndex >= 0 && _selectedServingIndex <= 1;
    }
    final opts = item.foodServingOptions;
    if (opts.isEmpty) {
      return true;
    }
    return _selectedServingIndex >= 0 && _selectedServingIndex < opts.length;
  }

  Map<String, dynamic>? _servingOptionWire(PantryCatalogItem item) {
    if (item.itemType == PantryCatalogItemType.recipe) {
      if (_selectedServingIndex == 0) {
        return <String, dynamic>{'kind': 'base'};
      }
      if (_selectedServingIndex == 1) {
        return <String, dynamic>{'kind': 'unit', 'unit': 'serving'};
      }
      return null;
    }
    final opts = item.foodServingOptions;
    if (opts.isEmpty) {
      return <String, dynamic>{'kind': 'base'};
    }
    if (!_hasValidServingSelection(item)) {
      return null;
    }
    return opts[_selectedServingIndex].toServingOptionWire();
  }

  ({double cal, double protein, double carbs, double fat})? _draftTotals() {
    final item = _item;
    final q = _parseQuantity();
    if (item == null || q == null) {
      return null;
    }
    if (item.itemType == PantryCatalogItemType.recipe) {
      if (!_hasValidServingSelection(item)) {
        return null;
      }
      if (_selectedServingIndex == 0) {
        final c = item.recipeYieldCalories;
        final p = item.recipeYieldProteinGrams;
        final carb = item.recipeYieldCarbohydratesGrams;
        final f = item.recipeYieldFatGrams;
        if (c == null || p == null || carb == null || f == null) {
          return null;
        }
        return (cal: c * q, protein: p * q, carbs: carb * q, fat: f * q);
      }
      final c = item.caloriesPerBase;
      final p = item.proteinGramsPerBase;
      final carb = item.carbohydratesGramsPerBase;
      final f = item.fatGramsPerBase;
      if (c == null || p == null || carb == null || f == null) {
        return null;
      }
      return (cal: c * q, protein: p * q, carbs: carb * q, fat: f * q);
    }

    final baseG = item.baseAmountGrams;
    final c = item.caloriesPerBase;
    final p = item.proteinGramsPerBase;
    final carb = item.carbohydratesGramsPerBase;
    final fat = item.fatGramsPerBase;
    if (baseG == null ||
        c == null ||
        p == null ||
        carb == null ||
        fat == null) {
      return null;
    }

    final double consumedGramsTotal;
    final opts = item.foodServingOptions;
    if (opts.isEmpty) {
      consumedGramsTotal = baseG * q;
    } else {
      if (!_hasValidServingSelection(item)) {
        return null;
      }
      consumedGramsTotal = opts[_selectedServingIndex].gramsPerServing * q;
    }

    return foodLogNutrientsForConsumedGrams(
      baseAmountGrams: baseG,
      caloriesPerBase: c,
      proteinPerBase: p,
      carbohydratesPerBase: carb,
      fatPerBase: fat,
      consumedGramsTotal: consumedGramsTotal,
    );
  }

  Future<String> _resolveBaseUrl() async {
    final base = await ApiBaseUrlStore.read();
    return base?.trim().replaceAll(RegExp(r'/+$'), '') ?? '';
  }

  Future<void> _pickDateTime() async {
    if (!mounted) {
      return;
    }
    final d = await showDatePicker(
      context: context,
      initialDate: _dateOnly(_consumedAt),
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (d == null || !mounted) {
      return;
    }
    final t = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_consumedAt),
    );
    if (t == null || !mounted) {
      return;
    }
    setState(() {
      _consumedAt = DateTime(d.year, d.month, d.day, t.hour, t.minute);
    });
  }

  DateTime _dateOnly(DateTime x) => DateTime(x.year, x.month, x.day);

  Future<void> _openPantryPicker() async {
    final picked = await Navigator.of(context).push<PantryCatalogItem>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (ctx) => const _FoodLogPantryPickerPage(),
      ),
    );
    if (picked != null && mounted) {
      setState(() {
        _item = picked;
        _selectedServingIndex = 0;
      });
    }
  }

  Future<void> _save() async {
    final item = _item;
    final qty = _parseQuantity();
    if (item == null ||
        qty == null ||
        _saving ||
        !_hasValidServingSelection(item)) {
      return;
    }
    final serving = _servingOptionWire(item);
    if (serving == null) {
      return;
    }
    final base = await _resolveBaseUrl();
    final token = await readSessionToken();
    if (!mounted) {
      return;
    }
    if (base.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Server URL is not configured.')),
      );
      return;
    }
    if (token == null || token.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Not signed in.')));
      return;
    }
    setState(() => _saving = true);
    final uri = Uri.parse('$base/food-log/entries/batch');
    final bodyMap = <String, dynamic>{
      'consumedAt': _consumedAt.toIso8601String(),
      'consumedDate': DateFormat('yyyy-MM-dd').format(_consumedAt),
      'entries': <Map<String, dynamic>>[
        {'pantryItemId': item.id, 'quantity': qty, 'servingOption': serving},
      ],
    };
    try {
      final res = await PantryHttp.post(
        uri,
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: jsonEncode(bodyMap),
      );
      if (!mounted) {
        return;
      }
      setState(() => _saving = false);
      if (res.statusCode == 201) {
        widget.onDone();
        return;
      }
      var msg = 'Could not save entry.';
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic>) {
          final m = decoded['message'];
          if (m is String && m.isNotEmpty) {
            msg = m;
          }
        }
      } catch (_) {}
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    } catch (_) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Could not save entry.')));
      }
    }
  }

  static String _fmtNut(num? v) {
    if (v == null) {
      return '—';
    }
    if (v == v.roundToDouble()) {
      return '${v.toInt()}';
    }
    return v.toStringAsFixed(1);
  }

  static String _formatQuantityForSummary(String raw) {
    final t = raw.trim();
    if (t.isEmpty) {
      return '—';
    }
    final v = double.tryParse(t);
    if (v == null) {
      return t;
    }
    if (v == v.roundToDouble()) {
      return '${v.toInt()}';
    }
    return v.toStringAsFixed(1);
  }

  String _quantityFieldLabel(PantryCatalogItem? item) {
    if (item == null) {
      return 'Quantity';
    }
    if (item.itemType == PantryCatalogItemType.recipe) {
      return _selectedServingIndex == 0
          ? 'Quantity (full recipes)'
          : 'Quantity (servings)';
    }
    if (item.foodServingOptions.isNotEmpty) {
      return 'Quantity (servings)';
    }
    return 'Quantity (base servings)';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final item = _item;
    final totals = _draftTotals();
    final canSave =
        item != null &&
        _parseQuantity() != null &&
        !_saving &&
        _hasValidServingSelection(item) &&
        totals != null;

    return Scaffold(
      appBar: AppBar(
        title: const Text('New entry'),
        actions: [
          TextButton(
            onPressed: canSave ? _save : null,
            child: _saving
                ? SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: scheme.primary,
                    ),
                  )
                : const Text('Save'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('When'),
            subtitle: Text(DateFormat.yMMMd().add_jm().format(_consumedAt)),
            trailing: const Icon(Icons.edit_calendar_outlined),
            onTap: _pickDateTime,
          ),
          const Divider(),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Food or recipe'),
            subtitle: Text(
              item == null
                  ? 'Choose from your Pantry'
                  : item.itemType == PantryCatalogItemType.food &&
                        item.brand != null &&
                        item.brand!.isNotEmpty
                  ? '${item.name} · ${item.brand}'
                  : item.name,
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: _openPantryPicker,
          ),
          if (item != null &&
              item.itemType == PantryCatalogItemType.recipe) ...[
            const SizedBox(height: 16),
            Text('Serving', style: theme.textTheme.titleSmall),
            const SizedBox(height: 8),
            InputDecorator(
              key: const Key('food-log-composer-serving'),
              decoration: const InputDecoration(border: OutlineInputBorder()),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<int>(
                  isExpanded: true,
                  menuMaxHeight: 320,
                  value: _selectedServingIndex.clamp(0, 1),
                  items: [
                    DropdownMenuItem<int>(
                      value: 0,
                      child: Text(
                        item.servingDescriptor != null
                            ? 'Full recipe (${item.servingDescriptor})'
                            : 'Full recipe',
                      ),
                    ),
                    DropdownMenuItem<int>(
                      value: 1,
                      child: Text(
                        'Per ${item.recipeServingLabel ?? 'serving'}',
                      ),
                    ),
                  ],
                  onChanged: (v) {
                    if (v == null) {
                      return;
                    }
                    setState(() => _selectedServingIndex = v);
                  },
                ),
              ),
            ),
          ] else if (item != null && item.foodServingOptions.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text('Serving', style: theme.textTheme.titleSmall),
            const SizedBox(height: 8),
            InputDecorator(
              key: const Key('food-log-composer-serving'),
              decoration: const InputDecoration(border: OutlineInputBorder()),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<int>(
                  isExpanded: true,
                  menuMaxHeight: 320,
                  value: _selectedServingIndex.clamp(
                    0,
                    item.foodServingOptions.length - 1,
                  ),
                  items: [
                    for (var i = 0; i < item.foodServingOptions.length; i++)
                      DropdownMenuItem<int>(
                        value: i,
                        child: Text(
                          item.foodServingOptions[i].pickerDisplayLabel,
                        ),
                      ),
                  ],
                  onChanged: (v) {
                    if (v == null) {
                      return;
                    }
                    setState(() => _selectedServingIndex = v);
                  },
                ),
              ),
            ),
          ],
          const SizedBox(height: 16),
          TextField(
            key: const Key('food-log-composer-quantity'),
            controller: _quantityController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: _quantityFieldLabel(item),
              border: const OutlineInputBorder(),
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 24),
          Text('Summary', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          if (item == null)
            Text(
              'Select a food or recipe to see nutrition.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: scheme.onSurfaceVariant,
              ),
            )
          else ...[
            if (!_hasValidServingSelection(item))
              Text(
                'Choose a valid serving.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: scheme.error,
                ),
              )
            else if (item.itemType == PantryCatalogItemType.recipe) ...[
              if (_selectedServingIndex == 0 &&
                  (item.recipeYieldCalories == null ||
                      item.recipeYieldProteinGrams == null ||
                      item.recipeYieldCarbohydratesGrams == null ||
                      item.recipeYieldFatGrams == null))
                Text(
                  'Full-yield nutrition is missing for this recipe.',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: scheme.error,
                  ),
                )
              else if (_selectedServingIndex == 1 &&
                  (item.caloriesPerBase == null ||
                      item.proteinGramsPerBase == null ||
                      item.carbohydratesGramsPerBase == null ||
                      item.fatGramsPerBase == null))
                Text(
                  'Per-serving nutrition is incomplete for this recipe.',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: scheme.error,
                  ),
                )
              else if (_selectedServingIndex == 0)
                Text(
                  'One full recipe: '
                  '${_fmtNut(item.recipeYieldCalories)} kcal · '
                  'P ${_fmtNut(item.recipeYieldProteinGrams)} g · '
                  'C ${_fmtNut(item.recipeYieldCarbohydratesGrams)} g · '
                  'F ${_fmtNut(item.recipeYieldFatGrams)} g',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                )
              else
                Text(
                  'Per ${item.recipeServingLabel ?? 'serving'}: '
                  '${_fmtNut(item.caloriesPerBase)} kcal · '
                  'P ${_fmtNut(item.proteinGramsPerBase)} g · '
                  'C ${_fmtNut(item.carbohydratesGramsPerBase)} g · '
                  'F ${_fmtNut(item.fatGramsPerBase)} g',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
            ] else if (item.servingDescriptor != null)
              Text(
                'Per ${item.servingDescriptor}: '
                '${_fmtNut(item.caloriesPerBase)} kcal · '
                'P ${_fmtNut(item.proteinGramsPerBase)} g · '
                'C ${_fmtNut(item.carbohydratesGramsPerBase)} g · '
                'F ${_fmtNut(item.fatGramsPerBase)} g',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
              ),
            const SizedBox(height: 12),
            if (totals != null) ...[
              Text(
                'Totals for ${_formatQuantityForSummary(_quantityController.text)} '
                '${item.itemType == PantryCatalogItemType.recipe ? (_selectedServingIndex == 0 ? 'full recipe(s)' : 'serving(s)') : (item.foodServingOptions.isEmpty ? 'base serving(s)' : 'serving unit(s)')}, '
                'scaled by your choice.',
                style: theme.textTheme.labelLarge,
              ),
              const SizedBox(height: 8),
              Text(
                '${totals.cal.round()} kcal total',
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Protein ${_fmtNut(totals.protein)} g · '
                'Carbs ${_fmtNut(totals.carbs)} g · '
                'Fat ${_fmtNut(totals.fat)} g',
                style: theme.textTheme.bodyLarge,
              ),
            ] else if (item.itemType != PantryCatalogItemType.recipe ||
                ((_selectedServingIndex == 0 &&
                        item.recipeYieldCalories != null) ||
                    (_selectedServingIndex == 1 &&
                        item.caloriesPerBase != null)))
              Text(
                'Nutrition data is incomplete for this item.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: scheme.error,
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _FoodLogPantryPickerPage extends StatelessWidget {
  const _FoodLogPantryPickerPage();

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        key: const Key('food-log-food-picker'),
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.close),
            onPressed: () => Navigator.of(context).pop(),
          ),
          title: const Text('Choose item'),
          bottom: const TabBar(
            tabs: <Widget>[
              Tab(text: 'Foods', key: Key('food-log-picker-tab-foods')),
              Tab(text: 'Recipes', key: Key('food-log-picker-tab-recipes')),
            ],
          ),
        ),
        body: const TabBarView(
          children: <Widget>[
            SafeArea(
              child: PantryInfiniteCatalogList(
                itemType: PantryCatalogItemType.food,
                searchFieldKey: Key('food-log-picker-search-food'),
                searchHint: 'Search foods by name or brand...',
                emptyMessage:
                    'No foods yet. Add foods in Pantry before logging.',
                noMatchesMessage: 'No foods match your search.',
                onTapItem: _popWithItem,
              ),
            ),
            SafeArea(
              child: PantryInfiniteCatalogList(
                itemType: PantryCatalogItemType.recipe,
                searchFieldKey: Key('food-log-picker-search-recipe'),
                searchHint: 'Search recipes by name...',
                emptyMessage:
                    'No recipes yet. Add recipes in Pantry before logging.',
                noMatchesMessage: 'No recipes match your search.',
                onTapItem: _popWithItem,
              ),
            ),
          ],
        ),
      ),
    );
  }

  static void _popWithItem(BuildContext context, PantryCatalogItem item) {
    Navigator.of(context).pop(item);
  }
}
