import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:healthy_mobile_auth/healthy_mobile_auth.dart';
import 'package:intl/intl.dart';

import 'meals_food_log_shell_sync.dart';
import 'pantry_catalog_helpers.dart';
import 'pantry_catalog_item.dart';
import 'pantry_http.dart';
import 'pantry_infinite_catalog_list.dart';
import 'reference_food_log_picker.dart';
import 'reference_food_log_wire.dart';

sealed class _FoodLogDraftEntry {
  const _FoodLogDraftEntry();
}

final class _DraftPantryEntry extends _FoodLogDraftEntry {
  const _DraftPantryEntry({
    required this.item,
    required this.quantity,
    required this.selectedServingIndex,
  });

  final PantryCatalogItem item;
  final double quantity;
  final int selectedServingIndex;
}

final class _DraftReferenceEntry extends _FoodLogDraftEntry {
  const _DraftReferenceEntry({
    required this.detail,
    required this.quantity,
    required this.servingChoiceIndex,
    required this.consumedGrams,
  });

  final ReferenceFoodDetailForLog detail;
  final double quantity;
  final int servingChoiceIndex;
  final double consumedGrams;
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

({double cal, double protein, double carbs, double fat})? _draftTotalsForPantry(
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

({double cal, double protein, double carbs, double fat})? _draftEntryTotals(
  _FoodLogDraftEntry d,
) {
  return switch (d) {
    _DraftPantryEntry(
      :final item,
      :final quantity,
      :final selectedServingIndex,
    ) =>
      _draftTotalsForPantry(item, quantity, selectedServingIndex),
    _DraftReferenceEntry(:final detail, :final consumedGrams) =>
      foodLogNutrientsForConsumedGrams(
        baseAmountGrams: detail.baseAmountGrams,
        caloriesPerBase: detail.calories,
        proteinPerBase: detail.proteinGrams,
        carbohydratesPerBase: detail.carbohydratesGrams,
        fatPerBase: detail.fatGrams,
        consumedGramsTotal: consumedGrams,
      ),
  };
}

/// Composer: log Pantry Foods, Recipes, or Reference Foods as Food Log Entries.
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
  PantryCatalogItem? _pantryItem;
  ReferenceFoodDetailForLog? _referenceDetail;
  int _selectedServingIndex = 0;
  int _referenceServingChoiceIndex = 0;
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
    final qty = _parseQuantity();
    final ref = _referenceDetail;
    if (ref != null) {
      if (qty == null ||
          !referenceServingChoiceValid(ref, _referenceServingChoiceIndex)) {
        return null;
      }
      final grams = referenceConsumedGramsForChoice(
        detail: ref,
        choiceIndex: _referenceServingChoiceIndex,
        quantity: qty,
      );
      if (grams == null) {
        return null;
      }
      final totals = foodLogNutrientsForConsumedGrams(
        baseAmountGrams: ref.baseAmountGrams,
        caloriesPerBase: ref.calories,
        proteinPerBase: ref.proteinGrams,
        carbohydratesPerBase: ref.carbohydratesGrams,
        fatPerBase: ref.fatGrams,
        consumedGramsTotal: grams,
      );
      if (totals == null) {
        return null;
      }
      return _DraftReferenceEntry(
        detail: ref,
        quantity: qty,
        servingChoiceIndex: _referenceServingChoiceIndex,
        consumedGrams: grams,
      );
    }

    final item = _pantryItem;
    if (item == null ||
        qty == null ||
        !_hasValidServingFor(item, _selectedServingIndex)) {
      return null;
    }
    if (_servingWireFor(item, _selectedServingIndex) == null) {
      return null;
    }
    if (_draftTotalsForPantry(item, qty, _selectedServingIndex) == null) {
      return null;
    }
    return _DraftPantryEntry(
      item: item,
      quantity: qty,
      selectedServingIndex: _selectedServingIndex,
    );
  }

  /// Entries that will be sent on save, or `null` if the batch is empty or
  /// the staged line is incomplete or invalid.
  List<_FoodLogDraftEntry>? _entriesForBatch() {
    final out = List<_FoodLogDraftEntry>.from(_drafts);
    if (_pantryItem != null || _referenceDetail != null) {
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
      final t = _draftEntryTotals(d);
      if (t == null) {
        return null;
      }
      cal += t.cal;
      protein += t.protein;
      carbs += t.carbs;
      fat += t.fat;
      any = true;
    }
    final q = _parseQuantity();
    final pantry = _pantryItem;
    final ref = _referenceDetail;
    if (pantry != null && q != null) {
      final t = _draftTotalsForPantry(pantry, q, _selectedServingIndex);
      if (t == null) {
        return null;
      }
      cal += t.cal;
      protein += t.protein;
      carbs += t.carbs;
      fat += t.fat;
      any = true;
    } else if (ref != null && q != null) {
      if (!referenceServingChoiceValid(ref, _referenceServingChoiceIndex)) {
        return null;
      }
      final grams = referenceConsumedGramsForChoice(
        detail: ref,
        choiceIndex: _referenceServingChoiceIndex,
        quantity: q,
      );
      if (grams == null) {
        return null;
      }
      final t = foodLogNutrientsForConsumedGrams(
        baseAmountGrams: ref.baseAmountGrams,
        caloriesPerBase: ref.calories,
        proteinPerBase: ref.proteinGrams,
        carbohydratesPerBase: ref.carbohydratesGrams,
        fatPerBase: ref.fatGrams,
        consumedGramsTotal: grams,
      );
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
      _pantryItem = null;
      _referenceDetail = null;
      _selectedServingIndex = 0;
      _referenceServingChoiceIndex = 0;
      _quantityController.text = '1';
    });
  }

  void _removeDraftAt(int index) {
    setState(() {
      final next = List<_FoodLogDraftEntry>.from(_drafts)..removeAt(index);
      _drafts = next;
    });
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

  Future<void> _openItemPicker() async {
    final picked = await Navigator.of(context).push<Object?>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (ctx) => const _FoodLogItemPickerPage(),
      ),
    );
    if (!mounted || picked == null) {
      return;
    }
    if (picked is PantryCatalogItem) {
      setState(() {
        _pantryItem = picked;
        _referenceDetail = null;
        _selectedServingIndex = 0;
        _referenceServingChoiceIndex = 0;
      });
      return;
    }
    if (picked is ReferenceFoodDetailForLog) {
      setState(() {
        _referenceDetail = picked;
        _pantryItem = null;
        _selectedServingIndex = 0;
        _referenceServingChoiceIndex = 0;
        _quantityController.text = '1';
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
      switch (e) {
        case _DraftPantryEntry(
          :final item,
          :final quantity,
          :final selectedServingIndex,
        ):
          final serving = _servingWireFor(item, selectedServingIndex);
          if (serving == null) {
            return;
          }
          wireRows.add(<String, dynamic>{
            'pantryItemId': item.id,
            'quantity': quantity,
            'servingOption': serving,
          });
        case _DraftReferenceEntry(:final detail, :final consumedGrams):
          wireRows.add(<String, dynamic>{
            'referenceFoodId': detail.id,
            'grams': consumedGrams,
          });
      }
    }

    final base = await ApiBaseUrlStore.read();
    final trimmed = base?.trim().replaceAll(RegExp(r'/+$'), '') ?? '';
    final token = await readSessionToken();
    if (!mounted) {
      return;
    }
    if (trimmed.isEmpty) {
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
    final uri = Uri.parse('$trimmed/food-log/entries/batch');
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
    return switch (d) {
      _DraftPantryEntry(
        :final item,
        :final quantity,
        :final selectedServingIndex,
      ) =>
        () {
          final qtyStr = _formatQuantityDouble(quantity);
          final unitPhrase = _unitPhraseForTotals(item, selectedServingIndex);
          final lines = _draftTotalsForPantry(
            item,
            quantity,
            selectedServingIndex,
          );
          final kcalStr = lines == null ? '—' : '${lines.cal.round()}';
          return '$qtyStr $unitPhrase · $kcalStr kcal';
        }(),
      _DraftReferenceEntry(
        :final detail,
        :final quantity,
        :final servingChoiceIndex,
        :final consumedGrams,
      ) =>
        () {
          final totals = foodLogNutrientsForConsumedGrams(
            baseAmountGrams: detail.baseAmountGrams,
            caloriesPerBase: detail.calories,
            proteinPerBase: detail.proteinGrams,
            carbohydratesPerBase: detail.carbohydratesGrams,
            fatPerBase: detail.fatGrams,
            consumedGramsTotal: consumedGrams,
          );
          final kcalStr = totals == null ? '—' : '${totals.cal.round()}';
          final qtyStr = _formatQuantityDouble(quantity);
          final gramsIdx = referenceServingChoiceCount(detail) - 1;
          if (servingChoiceIndex == gramsIdx) {
            return '$qtyStr g · $kcalStr kcal';
          }
          final label = referenceServingChoiceLabel(detail, servingChoiceIndex);
          return '$qtyStr × $label · $kcalStr kcal';
        }(),
    };
  }

  String _draftTitleLine(_FoodLogDraftEntry d) {
    return switch (d) {
      _DraftPantryEntry(:final item) =>
        item.itemType == PantryCatalogItemType.food &&
                item.brand != null &&
                item.brand!.isNotEmpty
            ? '${item.name} · ${item.brand}'
            : item.name,
      _DraftReferenceEntry(:final detail) =>
        detail.brand != null && detail.brand!.isNotEmpty
            ? '${detail.displayName} · ${detail.brand}'
            : detail.displayName,
    };
  }

  String _quantityFieldLabel() {
    final pantry = _pantryItem;
    final ref = _referenceDetail;
    if (pantry == null && ref == null) {
      return 'Quantity';
    }
    if (ref != null) {
      final gramsIdx = referenceServingChoiceCount(ref) - 1;
      if (_referenceServingChoiceIndex == gramsIdx) {
        return 'Grams consumed';
      }
      return 'Quantity';
    }
    if (pantry!.itemType == PantryCatalogItemType.recipe) {
      return _selectedServingIndex == 0
          ? 'Quantity (full recipes)'
          : 'Quantity (servings)';
    }
    if (pantry.foodServingOptions.isNotEmpty) {
      return 'Quantity (servings)';
    }
    return 'Quantity (base servings)';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final pantry = _pantryItem;
    final ref = _referenceDetail;
    final combined = _combinedMealTotals();
    final mealCount = _drafts.length + (_stagedDraftEntry() != null ? 1 : 0);
    final batchOk = _entriesForBatch();
    final canSave = batchOk != null && !_saving;
    final refChoiceCount = ref != null ? referenceServingChoiceCount(ref) : 0;

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
                title: Text(_draftTitleLine(_drafts[i])),
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
              _drafts.isEmpty
                  ? 'Food, recipe, or catalog'
                  : 'Add food, recipe, or catalog',
            ),
            subtitle: Text(
              pantry == null && ref == null
                  ? 'Pantry or reference catalog (not added to Pantry)'
                  : pantry != null
                  ? pantry.itemType == PantryCatalogItemType.food &&
                            pantry.brand != null &&
                            pantry.brand!.isNotEmpty
                        ? '${pantry.name} · ${pantry.brand}'
                        : pantry.name
                  : ref!.brand != null && ref.brand!.isNotEmpty
                  ? '${ref.displayName} · ${ref.brand}'
                  : ref.displayName,
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: _openItemPicker,
          ),
          if (ref != null && refChoiceCount > 0) ...[
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
                  value: _referenceServingChoiceIndex.clamp(
                    0,
                    refChoiceCount - 1,
                  ),
                  items: [
                    for (var i = 0; i < refChoiceCount; i++)
                      DropdownMenuItem<int>(
                        value: i,
                        child: Text(referenceServingChoiceLabel(ref, i)),
                      ),
                  ],
                  onChanged: (v) {
                    if (v == null) {
                      return;
                    }
                    setState(() => _referenceServingChoiceIndex = v);
                  },
                ),
              ),
            ),
          ],
          if (pantry != null &&
              pantry.itemType == PantryCatalogItemType.recipe) ...[
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
                        pantry.servingDescriptor != null
                            ? 'Full recipe (${pantry.servingDescriptor})'
                            : 'Full recipe',
                      ),
                    ),
                    DropdownMenuItem<int>(
                      value: 1,
                      child: Text(
                        'Per ${pantry.recipeServingLabel ?? 'serving'}',
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
          ] else if (pantry != null &&
              pantry.foodServingOptions.isNotEmpty) ...[
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
                    pantry.foodServingOptions.length - 1,
                  ),
                  items: [
                    for (var i = 0; i < pantry.foodServingOptions.length; i++)
                      DropdownMenuItem<int>(
                        value: i,
                        child: Text(
                          pantry.foodServingOptions[i].pickerDisplayLabel,
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
              labelText: _quantityFieldLabel(),
              border: const OutlineInputBorder(),
            ),
            onChanged: (_) => setState(() {}),
          ),
          if ((pantry != null || ref != null) &&
              _stagedDraftEntry() != null) ...[
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
          if (pantry == null && ref == null && _drafts.isEmpty)
            Text(
              'Select a food, recipe, or catalog item to see nutrition.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: scheme.onSurfaceVariant,
              ),
            )
          else if (pantry == null && ref == null && _drafts.isNotEmpty) ...[
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
                    : () {
                        final only = _drafts.single;
                        return switch (only) {
                          _DraftPantryEntry(
                            :final item,
                            :final quantity,
                            :final selectedServingIndex,
                          ) =>
                            'Totals for ${_formatQuantityDouble(quantity)} '
                                '${_unitPhraseForTotals(item, selectedServingIndex)}, '
                                'scaled by your choice.',
                          _DraftReferenceEntry(
                            :final detail,
                            :final quantity,
                            :final servingChoiceIndex,
                          ) =>
                            'Totals for ${_formatQuantityDouble(quantity)} '
                                '${referenceUnitPhraseForChoice(detail, servingChoiceIndex)}, '
                                'scaled by your choice.',
                        };
                      }(),
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
          if (ref != null) ...[
            Text(
              'Catalog reference · ${ref.source}',
              style: theme.textTheme.bodySmall?.copyWith(
                color: scheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Per ${_formatQuantityDouble(ref.baseAmountGrams)} g: '
              '${_fmtNut(ref.calories)} kcal · '
              'P ${_fmtNut(ref.proteinGrams)} g · '
              'C ${_fmtNut(ref.carbohydratesGrams)} g · '
              'F ${_fmtNut(ref.fatGrams)} g',
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
                          '${referenceUnitPhraseForChoice(ref, _referenceServingChoiceIndex)}, '
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
          if (pantry != null) ...[
            if (!_hasValidServingFor(pantry, _selectedServingIndex))
              Text(
                'Choose a valid serving.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: scheme.error,
                ),
              )
            else if (pantry.itemType == PantryCatalogItemType.recipe) ...[
              if (_selectedServingIndex == 0 &&
                  (pantry.recipeYieldCalories == null ||
                      pantry.recipeYieldProteinGrams == null ||
                      pantry.recipeYieldCarbohydratesGrams == null ||
                      pantry.recipeYieldFatGrams == null))
                Text(
                  'Full-yield nutrition is missing for this recipe.',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: scheme.error,
                  ),
                )
              else if (_selectedServingIndex == 1 &&
                  (pantry.caloriesPerBase == null ||
                      pantry.proteinGramsPerBase == null ||
                      pantry.carbohydratesGramsPerBase == null ||
                      pantry.fatGramsPerBase == null))
                Text(
                  'Per-serving nutrition is incomplete for this recipe.',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: scheme.error,
                  ),
                )
              else if (_selectedServingIndex == 0)
                Text(
                  'One full recipe: '
                  '${_fmtNut(pantry.recipeYieldCalories)} kcal · '
                  'P ${_fmtNut(pantry.recipeYieldProteinGrams)} g · '
                  'C ${_fmtNut(pantry.recipeYieldCarbohydratesGrams)} g · '
                  'F ${_fmtNut(pantry.recipeYieldFatGrams)} g',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                )
              else
                Text(
                  'Per ${pantry.recipeServingLabel ?? 'serving'}: '
                  '${_fmtNut(pantry.caloriesPerBase)} kcal · '
                  'P ${_fmtNut(pantry.proteinGramsPerBase)} g · '
                  'C ${_fmtNut(pantry.carbohydratesGramsPerBase)} g · '
                  'F ${_fmtNut(pantry.fatGramsPerBase)} g',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
            ] else if (pantry.servingDescriptor != null)
              Text(
                'Per ${pantry.servingDescriptor}: '
                '${_fmtNut(pantry.caloriesPerBase)} kcal · '
                'P ${_fmtNut(pantry.proteinGramsPerBase)} g · '
                'C ${_fmtNut(pantry.carbohydratesGramsPerBase)} g · '
                'F ${_fmtNut(pantry.fatGramsPerBase)} g',
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
                          '${_unitPhraseForTotals(pantry, _selectedServingIndex)}, '
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
            ] else if (pantry.itemType != PantryCatalogItemType.recipe ||
                ((_selectedServingIndex == 0 &&
                        pantry.recipeYieldCalories != null) ||
                    (_selectedServingIndex == 1 &&
                        pantry.caloriesPerBase != null)))
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

class _FoodLogItemPickerPage extends StatelessWidget {
  const _FoodLogItemPickerPage();

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
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
              Tab(text: 'Catalog', key: Key('food-log-picker-tab-reference')),
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
                onTapItem: _popWithPantryItem,
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
                onTapItem: _popWithPantryItem,
              ),
            ),
            ReferenceFoodLogCatalogPane(),
          ],
        ),
      ),
    );
  }

  static void _popWithPantryItem(BuildContext context, PantryCatalogItem item) {
    Navigator.of(context).pop(item);
  }
}
