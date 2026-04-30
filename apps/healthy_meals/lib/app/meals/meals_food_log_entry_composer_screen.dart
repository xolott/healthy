import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:healthy_mobile_auth/healthy_mobile_auth.dart';
import 'package:intl/intl.dart';

import 'meals_food_log_shell_sync.dart';
import 'pantry_catalog_helpers.dart';
import 'pantry_catalog_item.dart';
import 'pantry_http.dart';
import 'pantry_infinite_catalog_list.dart';

@immutable
class _FoodLogDraftEntry {
  const _FoodLogDraftEntry({
    required this.item,
    required this.quantity,
    required this.selectedServingIndex,
  });

  final PantryCatalogItem item;
  final double quantity;
  final int selectedServingIndex;
}

bool _hasValidServingFor(PantryCatalogItem item, int selectedServingIndex) {
  if (item.itemType == PantryCatalogItemType.recipe) {
    return selectedServingIndex >= 0 && selectedServingIndex <= 1;
  }
  final opts = item.foodServingOptions;
  if (opts.isEmpty) {
    return true;
  }
  return selectedServingIndex >= 0 && selectedServingIndex < opts.length;
}

Map<String, dynamic>? _servingWireFor(
  PantryCatalogItem item,
  int selectedServingIndex,
) {
  if (item.itemType == PantryCatalogItemType.recipe) {
    if (selectedServingIndex == 0) {
      return <String, dynamic>{'kind': 'base'};
    }
    if (selectedServingIndex == 1) {
      return <String, dynamic>{'kind': 'unit', 'unit': 'serving'};
    }
    return null;
  }
  final opts = item.foodServingOptions;
  if (opts.isEmpty) {
    return <String, dynamic>{'kind': 'base'};
  }
  if (!_hasValidServingFor(item, selectedServingIndex)) {
    return null;
  }
  return opts[selectedServingIndex].toServingOptionWire();
}

({double cal, double protein, double carbs, double fat})? _draftTotalsFor(
  PantryCatalogItem item,
  double q,
  int selectedServingIndex,
) {
  if (!_hasValidServingFor(item, selectedServingIndex)) {
    return null;
  }
  if (item.itemType == PantryCatalogItemType.recipe) {
    if (selectedServingIndex == 0) {
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
  if (baseG == null || c == null || p == null || carb == null || fat == null) {
    return null;
  }

  final double consumedGramsTotal;
  final opts = item.foodServingOptions;
  if (opts.isEmpty) {
    consumedGramsTotal = baseG * q;
  } else {
    consumedGramsTotal = opts[selectedServingIndex].gramsPerServing * q;
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
  List<_FoodLogDraftEntry> _drafts = const [];
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

  _FoodLogDraftEntry? _stagedDraftEntry() {
    final item = _item;
    final qty = _parseQuantity();
    if (item == null ||
        qty == null ||
        !_hasValidServingFor(item, _selectedServingIndex)) {
      return null;
    }
    if (_servingWireFor(item, _selectedServingIndex) == null) {
      return null;
    }
    if (_draftTotalsFor(item, qty, _selectedServingIndex) == null) {
      return null;
    }
    return _FoodLogDraftEntry(
      item: item,
      quantity: qty,
      selectedServingIndex: _selectedServingIndex,
    );
  }

  /// Entries that will be sent on save, or `null` if the batch is empty or
  /// the staged line is incomplete or invalid.
  List<_FoodLogDraftEntry>? _entriesForBatch() {
    final out = List<_FoodLogDraftEntry>.from(_drafts);
    if (_item != null) {
      final staged = _stagedDraftEntry();
      if (staged == null) {
        return null;
      }
      out.add(staged);
    }
    if (out.isEmpty) {
      return null;
    }
    return out;
  }

  ({double cal, double protein, double carbs, double fat})?
  _combinedMealTotals() {
    double cal = 0;
    double protein = 0;
    double carbs = 0;
    double fat = 0;
    var any = false;
    for (final d in _drafts) {
      final t = _draftTotalsFor(d.item, d.quantity, d.selectedServingIndex);
      if (t == null) {
        return null;
      }
      cal += t.cal;
      protein += t.protein;
      carbs += t.carbs;
      fat += t.fat;
      any = true;
    }
    final item = _item;
    final q = _parseQuantity();
    if (item != null && q != null) {
      final t = _draftTotalsFor(item, q, _selectedServingIndex);
      if (t == null) {
        return null;
      }
      cal += t.cal;
      protein += t.protein;
      carbs += t.carbs;
      fat += t.fat;
      any = true;
    }
    if (!any) {
      return null;
    }
    return (cal: cal, protein: protein, carbs: carbs, fat: fat);
  }

  void _addStagedToDrafts() {
    final staged = _stagedDraftEntry();
    if (staged == null) {
      return;
    }
    setState(() {
      _drafts = List<_FoodLogDraftEntry>.from(_drafts)..add(staged);
      _item = null;
      _selectedServingIndex = 0;
      _quantityController.text = '1';
    });
  }

  void _removeDraftAt(int index) {
    setState(() {
      final next = List<_FoodLogDraftEntry>.from(_drafts)..removeAt(index);
      _drafts = next;
    });
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
    final entries = _entriesForBatch();
    if (entries == null || _saving) {
      return;
    }
    final wireRows = <Map<String, dynamic>>[];
    for (final e in entries) {
      final serving = _servingWireFor(e.item, e.selectedServingIndex);
      if (serving == null) {
        return;
      }
      wireRows.add(<String, dynamic>{
        'pantryItemId': e.item.id,
        'quantity': e.quantity,
        'servingOption': serving,
      });
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
      'entries': wireRows,
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

  static String _formatQuantityDouble(double v) {
    if (v == v.roundToDouble()) {
      return '${v.toInt()}';
    }
    return v.toStringAsFixed(1);
  }

  static String _unitPhraseForTotals(PantryCatalogItem item, int servingIndex) {
    if (item.itemType == PantryCatalogItemType.recipe) {
      return servingIndex == 0 ? 'full recipe(s)' : 'serving(s)';
    }
    if (item.foodServingOptions.isEmpty) {
      return 'base serving(s)';
    }
    return 'serving unit(s)';
  }

  String _draftLineSubtitle(_FoodLogDraftEntry d) {
    final it = d.item;
    final qtyStr = _formatQuantityDouble(d.quantity);
    final unitPhrase = _unitPhraseForTotals(it, d.selectedServingIndex);
    final lines = _draftTotalsFor(it, d.quantity, d.selectedServingIndex);
    final kcalStr = lines == null ? '—' : '${lines.cal.round()}';
    return '$qtyStr $unitPhrase · $kcalStr kcal';
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
    final combined = _combinedMealTotals();
    final mealCount = _drafts.length + (_stagedDraftEntry() != null ? 1 : 0);
    final batchOk = _entriesForBatch();
    final canSave = batchOk != null && !_saving;

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
          if (_drafts.isNotEmpty) ...[
            Text('In this meal', style: theme.textTheme.titleSmall),
            const SizedBox(height: 4),
            for (var i = 0; i < _drafts.length; i++) ...[
              ListTile(
                key: ValueKey<Object>('food-log-draft-$i'),
                contentPadding: EdgeInsets.zero,
                title: Text(
                  _drafts[i].item.itemType == PantryCatalogItemType.food &&
                          _drafts[i].item.brand != null &&
                          _drafts[i].item.brand!.isNotEmpty
                      ? '${_drafts[i].item.name} · ${_drafts[i].item.brand}'
                      : _drafts[i].item.name,
                ),
                subtitle: Text(_draftLineSubtitle(_drafts[i])),
                trailing: IconButton(
                  tooltip: 'Remove',
                  icon: Icon(
                    Icons.remove_circle_outline,
                    color: scheme.onSurfaceVariant,
                  ),
                  onPressed: () => _removeDraftAt(i),
                ),
              ),
            ],
            const Divider(),
          ],
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(
              _drafts.isEmpty ? 'Food or recipe' : 'Add food or recipe',
            ),
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
          if (item != null && _stagedDraftEntry() != null) ...[
            const SizedBox(height: 16),
            FilledButton.icon(
              key: const Key('food-log-composer-add-to-meal'),
              onPressed: _addStagedToDrafts,
              icon: const Icon(Icons.add),
              label: const Text('Add to this meal'),
            ),
          ],
          const SizedBox(height: 24),
          Text('Summary', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          if (item == null && _drafts.isEmpty)
            Text(
              'Select a food or recipe to see nutrition.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: scheme.onSurfaceVariant,
              ),
            )
          else if (item == null && _drafts.isNotEmpty) ...[
            if (combined == null)
              Text(
                'Complete each item above to update meal totals.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
              )
            else ...[
              Text(
                mealCount > 1
                    ? 'Meal totals ($mealCount items)'
                    : 'Totals for '
                          '${_formatQuantityDouble(_drafts.single.quantity)} '
                          '${_unitPhraseForTotals(_drafts.single.item, _drafts.single.selectedServingIndex)}, '
                          'scaled by your choice.',
                style: theme.textTheme.labelLarge,
              ),
              const SizedBox(height: 8),
              Text(
                '${combined.cal.round()} kcal total',
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Protein ${_fmtNut(combined.protein)} g · '
                'Carbs ${_fmtNut(combined.carbs)} g · '
                'Fat ${_fmtNut(combined.fat)} g',
                style: theme.textTheme.bodyLarge,
              ),
            ],
          ],
          if (_item != null) ...[
            if (!_hasValidServingFor(_item!, _selectedServingIndex))
              Text(
                'Choose a valid serving.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: scheme.error,
                ),
              )
            else if (_item!.itemType == PantryCatalogItemType.recipe) ...[
              if (_selectedServingIndex == 0 &&
                  (_item!.recipeYieldCalories == null ||
                      _item!.recipeYieldProteinGrams == null ||
                      _item!.recipeYieldCarbohydratesGrams == null ||
                      _item!.recipeYieldFatGrams == null))
                Text(
                  'Full-yield nutrition is missing for this recipe.',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: scheme.error,
                  ),
                )
              else if (_selectedServingIndex == 1 &&
                  (_item!.caloriesPerBase == null ||
                      _item!.proteinGramsPerBase == null ||
                      _item!.carbohydratesGramsPerBase == null ||
                      _item!.fatGramsPerBase == null))
                Text(
                  'Per-serving nutrition is incomplete for this recipe.',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: scheme.error,
                  ),
                )
              else if (_selectedServingIndex == 0)
                Text(
                  'One full recipe: '
                  '${_fmtNut(_item!.recipeYieldCalories)} kcal · '
                  'P ${_fmtNut(_item!.recipeYieldProteinGrams)} g · '
                  'C ${_fmtNut(_item!.recipeYieldCarbohydratesGrams)} g · '
                  'F ${_fmtNut(_item!.recipeYieldFatGrams)} g',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                )
              else
                Text(
                  'Per ${_item!.recipeServingLabel ?? 'serving'}: '
                  '${_fmtNut(_item!.caloriesPerBase)} kcal · '
                  'P ${_fmtNut(_item!.proteinGramsPerBase)} g · '
                  'C ${_fmtNut(_item!.carbohydratesGramsPerBase)} g · '
                  'F ${_fmtNut(_item!.fatGramsPerBase)} g',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
            ] else if (_item!.servingDescriptor != null)
              Text(
                'Per ${_item!.servingDescriptor}: '
                '${_fmtNut(_item!.caloriesPerBase)} kcal · '
                'P ${_fmtNut(_item!.proteinGramsPerBase)} g · '
                'C ${_fmtNut(_item!.carbohydratesGramsPerBase)} g · '
                'F ${_fmtNut(_item!.fatGramsPerBase)} g',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
              ),
            const SizedBox(height: 12),
            if (combined != null) ...[
              Text(
                mealCount > 1
                    ? 'Meal totals ($mealCount items)'
                    : 'Totals for ${_formatQuantityForSummary(_quantityController.text)} '
                          '${_unitPhraseForTotals(_item!, _selectedServingIndex)}, '
                          'scaled by your choice.',
                style: theme.textTheme.labelLarge,
              ),
              const SizedBox(height: 8),
              Text(
                '${combined.cal.round()} kcal total',
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Protein ${_fmtNut(combined.protein)} g · '
                'Carbs ${_fmtNut(combined.carbs)} g · '
                'Fat ${_fmtNut(combined.fat)} g',
                style: theme.textTheme.bodyLarge,
              ),
            ] else if (_item!.itemType != PantryCatalogItemType.recipe ||
                ((_selectedServingIndex == 0 &&
                        _item!.recipeYieldCalories != null) ||
                    (_selectedServingIndex == 1 &&
                        _item!.caloriesPerBase != null)))
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
